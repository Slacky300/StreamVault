import { Job, Worker } from "bullmq";
import { WorkerConfigManager } from "../config/worker.js";
import { S3ZipJobProcessor } from "../helpers/jobProcessor.js";

class S3ZipWorkerFactory {

    private readonly configManager: WorkerConfigManager;
    private readonly jobProcessor: S3ZipJobProcessor;


    constructor(private readonly queueName: string) {

        this.queueName = queueName;
        this.configManager = new WorkerConfigManager();
        this.jobProcessor = new S3ZipJobProcessor();
    }

    public createWorker(): Worker {
        const workerOptions = this.configManager.getWorkerOptions();

        return new Worker(
            this.queueName,
            async (job: Job) => {
                const result = await this.jobProcessor.processJob(job);
                return result;
            },
            workerOptions
        );
    }
}


export { S3ZipWorkerFactory };