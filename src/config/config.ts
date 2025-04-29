import dotenv from 'dotenv';

dotenv.config();


class Config {


    readonly jobOptionsForQueues = {
        attempts: parseInt(process.env.JOB_ATTEMPTS || '3'),
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: { age: 3600, count: 10 }, 
        removeOnFail: { age: 3600, count: 10 },   
    }

    readonly redis = {
        connectionTimeout: parseInt(process.env.REDIS_CONNECTION_TIMEOUT || '60000'),
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
    };

    readonly s3 = {
        region: process.env.AWS_S3_REGION || 'us-east-1',
        bucketName: process.env.AWS_S3_BUCKET || 'your-bucket-name',
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID || 'your-access-key-id',
        secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY || 'your-secret-access-key',
        exportDestinationPath: process.env.AWS_S3_EXPORT_DESTINATION_PATH || 'exports/',
        generatePresignedUrl: process.env.AWS_S3_GENERATE_PRESIGNED_URL === 'true',
        presignedUrlExpiration: parseInt(process.env.AWS_S3_PRESIGNED_URL_EXPIRATION || '3600'), // 1 hour
    };

    readonly database = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'app',
    };


    public getRedisConfig() {
        return this.redis;
    }

    public getS3Config() {
        return this.s3;
    }

    public getJobOptionsForQueues() {
        return this.jobOptionsForQueues;
    }
}

export const configStore = new Config();
