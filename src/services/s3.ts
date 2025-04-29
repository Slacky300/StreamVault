
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Job } from 'bullmq';
import HelperFunctions from '../helpers/helper.js';
import { finished, Readable } from 'stream';
import archiver from 'archiver';
import MemoryManager from '../managers/memoryManager.js';
import ArchiveManager from '../managers/archiveManager.js';
import S3Uploader from '../managers/s3UploadManager.js';
import pLimit from 'p-limit';
import { configStore } from '../config/config.js';

class S3Service {
    private s3Client: S3Client;
    private bucketName: string;
    private readonly helper = new HelperFunctions();
    private readonly MAX_CONCURRENT_OPERATIONS = 1;
    private readonly CHUNK_SIZE = 5;
    private readonly config = configStore.getS3Config();

    constructor(region: string, bucketName: string, accessKeyId: string, secretAccessKey: string) {
        this.s3Client = new S3Client({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
        this.bucketName = bucketName;

        
    }

    public async getTotalSizeOfObjects(prefix?: string): Promise<{ humanReadableSize: string; noOfFiles: number }> {
        let totalSize = 0;
        let continuationToken: string | undefined = undefined;
        try {
            let objects: any[] = [];
            do {
                const command: ListObjectsV2Command = new ListObjectsV2Command({
                    Bucket: this.bucketName,
                    Prefix: prefix,
                    ContinuationToken: continuationToken,
                });
                const response = await this.s3Client.send(command);
                const currentObjects = response.Contents || [];
                objects = [...objects, ...currentObjects];

                for (const object of currentObjects) {
                    if (object.Size) {
                        totalSize += object.Size;
                    }
                }

                continuationToken = response.NextContinuationToken;
            } while (continuationToken);
            const humanReadableSize = this.helper.getHumanReadableSize(totalSize);
            return { humanReadableSize, noOfFiles: objects.length };
        } catch (error) {
            console.error('Error calculating total size:', error);
            throw error;
        }
    }

    public async listObjects(prefix?: string): Promise<any> {
        let allObjects: any[] = [];
        let continuationToken: string | undefined = undefined;

        try {
            do {
                const command: ListObjectsV2Command = new ListObjectsV2Command({
                    Bucket: this.bucketName,
                    Prefix: prefix,
                    ContinuationToken: continuationToken,
                });
                const response = await this.s3Client.send(command);
                const objects = response.Contents || [];
                allObjects = [...allObjects, ...objects];
                continuationToken = response.NextContinuationToken;
            } while (continuationToken);

            return allObjects;
        } catch (error) {
            console.error('Error listing objects:', error);
            throw error;
        }
    }

    public async generatePresignedUrl(key: string, expiresIn: number): Promise<string> {
        if (!key) {
            throw new Error('Key is required to generate presigned URL');
        }

        if (!expiresIn || expiresIn <= 0) {
            throw new Error('Expiration time must be a positive number');
        }

        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        try {
            const url = await getSignedUrl(this.s3Client, command, { expiresIn });
            return url;
        } catch (error) {
            console.error('Error generating presigned URL:', error);
            throw error;
        }
    }

    public async zipAndStreamFolderToS3(s3DestinationPath: string, job: Job): Promise<{ downloadUrl: string; status: string; totalSize: string; noOfFiles: number }> {
        job.log(`Starting to zip and stream folder to S3: ${s3DestinationPath}`);
        
        const memoryManager = new MemoryManager(job);
        const archiveManager = new ArchiveManager(job);
        const s3Uploader = new S3Uploader(this.s3Client, this.bucketName, job);
        
        memoryManager.startMemoryMonitoring();
        
        try {
            const folderInfo = await this.getSourceFolderInfo(job);
            
            const { archive, passThrough } = archiveManager.createArchiveStream();
            
            const uploadPromise = s3Uploader.uploadStream(passThrough, job.data.s3Key);
            
            await this.processFilesIntoArchive(folderInfo.files, archive, job, memoryManager);
            
            job.log(`[${job.id}] All files processed, finalizing archive...`);
            await archive.finalize();
            
            job.log(`[${job.id}] Waiting for S3 upload to complete`);
            const s3URL = await uploadPromise;
            
            job.log(`[${job.id}] Export completed successfully. File available at s3://${this.bucketName}/${s3DestinationPath}`);

            const generatePresignedUrl = this.config.generatePresignedUrl;
            let presignedUrl: string | undefined = undefined;
            if (generatePresignedUrl) {
                const presignedUrlExpiration = this.config.presignedUrlExpiration;
                presignedUrl = await this.generatePresignedUrl(this.helper.extractKeyFromS3Url(s3URL), presignedUrlExpiration);
                job.log(`[${job.id}] Presigned URL generated: ${presignedUrl}`);
            }
            


            const result = {
                downloadUrl: generatePresignedUrl ? presignedUrl || '' : s3URL,
                status: "completed",
                totalSize: folderInfo.totalSize,
                noOfFiles: folderInfo.noOfFiles,

            }
            return result;
        } catch (error) {
            job.log(`[${job.id}] Error during export: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        } finally {
            memoryManager.stopMemoryMonitoring();
        }
    }

    private async getSourceFolderInfo(job: Job): Promise<{ files: any[], totalSize: string, noOfFiles: number }> {
        const files = await this.listObjects(job.data.s3Key);
        const { humanReadableSize, noOfFiles } = await this.getTotalSizeOfObjects(job.data.s3Key);
        
        job.log(`Total size of folder: ${humanReadableSize}, Number of files: ${noOfFiles}`);
        
        return {
            files,
            totalSize: humanReadableSize,
            noOfFiles
        };
    }

    private async processFilesIntoArchive(
        files: any[], 
        archive: archiver.Archiver, 
        job: Job,
        memoryManager: MemoryManager
    ): Promise<void> {

        const sortedFiles = [...files].sort((a, b) => a.Size - b.Size);
        const noOfFiles = sortedFiles.length;
        let processedCount = 0;
        
        job.log(`[${job.id}] Processing files and adding to archive`);
        
        const limit = pLimit(this.MAX_CONCURRENT_OPERATIONS);
        
        for (let i = 0; i < noOfFiles; i += this.CHUNK_SIZE) {

            await memoryManager.checkMemoryAndPause();
            
            const chunk = sortedFiles.slice(i, i + this.CHUNK_SIZE);
            
            await Promise.all(chunk.map(file => {
                return limit(async () => {
                    await this.addFileToArchive(file, archive, job);
                    
                    processedCount++;
                    if (processedCount % Math.max(1, Math.floor(noOfFiles / 100)) === 0 || processedCount === noOfFiles) {
                        let percentage = Math.round((processedCount / noOfFiles) * 100);
                        await job.updateProgress(percentage);
                    }
                });
            }));
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    private async addFileToArchive(file: any, archive: archiver.Archiver, job: Job): Promise<void> {
        const key = file.Key;
        try {
            const fileName = key.replace(job.data.prefix, '').replace(/^\//, '');
            
            if (file.Size > 100 * 1024 * 1024) {
                job.log(`[${job.id}] Processing large file (${this.helper.formatBytes(file.Size)}): ${fileName}`);
            }
            
            const getObjectCmd = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });
            
            const s3Object = await this.s3Client.send(getObjectCmd);
            
            if (!s3Object.Body) {
                throw new Error(`Failed to retrieve object body for key: ${key}`);
            }
            
            await this.streamFileWithTimeout(s3Object, fileName, archive, job, file.Size);
            
        } catch (error) {
            console.error(`[${job.id}] Error processing file ${key}:`, error);
            throw error;
        }
    }

    private async streamFileWithTimeout(
        s3Object: any, 
        fileName: string, 
        archive: archiver.Archiver, 
        job: Job,
        fileSize: number
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const nodeStream = s3Object.Body.transformToWebStream();
                const readableStream = Readable.from(nodeStream as AsyncIterable<any>);
                
                archive.append(readableStream, { name: fileName });
                
                finished(readableStream, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
                
                const timeoutMs = Math.max(60000, Math.ceil(fileSize / (100 * 1024 * 1024)) * 60000);
                
                const timeout = setTimeout(() => {
                    reject(new Error(`Stream timeout after ${timeoutMs / 1000}s for file ${fileName}`));
                }, timeoutMs);
                
                finished(readableStream, () => {
                    clearTimeout(timeout);
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }
}

export { S3Service };