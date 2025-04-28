import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Job } from "bullmq";
import HelperFunctions from "../helpers/helper.js";
import { PassThrough } from "stream";
import { configStore } from "../config/config.js";

class S3Uploader {
    private readonly PART_SIZE_FOR_UPLOAD = 20 * 1024 * 1024; // 20MB
    private readonly helper = new HelperFunctions();

    constructor(
        private readonly s3Client: S3Client,
        private readonly bucketName: string,
        private readonly job: Job
    ) {}

    private readonly s3Config = configStore.getS3Config();

    public async uploadStream(stream: PassThrough, s3Key: string): Promise<string> {

        //check if there's a trailing slash at the end of the s3Key and remove it
        if (s3Key.endsWith('/')) {
            s3Key = s3Key.slice(0, -1);
        }
        //check if there's a leading slash at the beginning of the s3Key and remove it
        if (s3Key.startsWith('/')) {
            s3Key = s3Key.slice(1);
        }
        const sanitizedKey = `exports/${s3Key}`.replace(/[^a-zA-Z0-9_\-\/\.]/g, '-');

        const upload = new Upload({
            client: this.s3Client,
            params: {
                Bucket: this.bucketName,
                Key: sanitizedKey,
                Body: stream,
                ContentType: 'application/zip',
            },
            partSize: this.PART_SIZE_FOR_UPLOAD,
            queueSize: 4,
            leavePartsOnError: false
        });

        this.setupUploadProgressHandler(upload);
        
        try {
            await upload.done();
            return `https://${this.bucketName}.s3.${this.s3Config.region}.amazonaws.com/${sanitizedKey}`;
        } catch (error) {
            this.job.log(`[${this.job.id}] Upload error: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    private setupUploadProgressHandler(upload: Upload): void {
        upload.on('httpUploadProgress', (progress) => {
            if (progress.loaded && progress.total) {
                const percentage = Math.floor((progress.loaded / progress.total) * 100);
                if (percentage % 5 === 0 && percentage > 0) {
                    this.job.log(`[${this.job.id}] S3 upload progress: ${percentage}% (${this.helper.formatBytes(progress.loaded)}/${this.helper.formatBytes(progress.total)})`);
                }
            }
        });
    }
}

export default S3Uploader;