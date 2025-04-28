import { Job } from "bullmq";
import HelperFunctions from "../helpers/helper.js";

class MemoryManager {
    private readonly MAX_MEMORY_THRESHOLD = 1024 * 1024 * 512; // 512MB
    private readonly helper = new HelperFunctions();
    private memoryMonitorInterval: NodeJS.Timeout | null = null;

    constructor(private readonly job: Job) {}

    public async checkMemoryAndPause(): Promise<void> {
        if (process.memoryUsage().heapUsed > this.MAX_MEMORY_THRESHOLD) {
            this.job.log(`[ZIP-${this.job.id}] Memory threshold reached, pausing for archive to process...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    public startMemoryMonitoring(): void {
        this.memoryMonitorInterval = this.helper.monitorMemoryUsageOfAJob(this.job.id ?? "unknown-job-id");
    }

    public stopMemoryMonitoring(): void {
        if (this.memoryMonitorInterval) {
            clearInterval(this.memoryMonitorInterval);
            this.memoryMonitorInterval = null;
        }
    }
}

export default MemoryManager;
