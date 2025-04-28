import { Job } from "bullmq";
import { JobLogger } from "./jobLogger.js";
import {S3Service} from "../services/s3.js";
import { configStore } from "../config/config.js";

class S3ZipJobProcessor {
    private readonly logger: JobLogger;
    private readonly s3Config = configStore.getS3Config();
    private readonly S3_DESTINATION_PATH = this.s3Config.exportDestinationPath;

    private readonly s3Service = new S3Service(
        this.s3Config.region,
        this.s3Config.bucketName,
        this.s3Config.accessKeyId,
        this.s3Config.secretAccessKey
    )

    constructor() {
        this.logger = new JobLogger();
    }

    public async processJob(job: Job): Promise<any> {
        
        this.logger.logJobStart(job);

        try {
            const result = await this.s3Service.zipAndStreamFolderToS3(this.S3_DESTINATION_PATH, job);
            console.log("Job result: ", result);
            this.logger.logJobSuccess(job, result);
            return result;
        } catch (error) {
            this.logger.logJobError(job, error);
            throw error;
        }
    }

}

export { S3ZipJobProcessor };