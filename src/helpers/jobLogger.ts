import { Job } from "bullmq";

class JobLogger {
    public logJobStart(job: Job): void {
        const message = `Processing job ${job.id}...`;
        console.log(message);
        job.log(message);
    }

    public logJobSuccess(job: Job, result: any): void {
        job.log(`Job ${job.id} completed successfully: ${JSON.stringify(result)}`);

        const hasDownloadUrl = result && result.downloadUrl;
        console.log(
            `Job ${job.id} completed ${hasDownloadUrl ? 'with download URL' : 'but no files were found'}`
        );
    }

    public logJobError(job: Job, error: unknown): void {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Job ${job.id} failed: ${errorMessage}`);
        job.log(`Error: ${errorMessage}`);
    }
}

export { JobLogger };