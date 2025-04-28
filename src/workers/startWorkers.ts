import { S3ZipWorkerFactory } from "./workerForDownload.js";

const smallDownloadWorker = new S3ZipWorkerFactory('small-downloads');
const largeDownloadWorker = new S3ZipWorkerFactory('large-downloads');

const createAllWorkers = () => {
    try {
        const smallW = smallDownloadWorker.createWorker();
        smallW.on('completed', (job) => {
            console.log(`Job ${job.id} completed successfully!`);
        });
        smallW.on('failed', (job, err) => { 
            console.error(`Job ${job?.id} failed with error: ${err.message}`);
        });
        smallW.on('progress', (job, progress) => {
            console.log(`Job ${job.id} progress: ${progress}%`);
        });
        smallW.on('active', (job) => {
            console.log(`Job ${job.id} is now active!`);
        });

        largeDownloadWorker.createWorker();
    } catch (error) {
        console.error("Error creating workers:", error);
    }
}




createAllWorkers();