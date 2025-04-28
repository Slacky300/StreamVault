import { Worker, Job } from 'bullmq';
import { WorkerOptions } from 'bullmq';
import { configStore } from './config.js';

class WorkerConfigManager {
    private readonly defaultConcurrency = 1;

    constructor(private readonly env: NodeJS.ProcessEnv = process.env) { }

    public getWorkerOptions(): WorkerOptions {
        return {
            concurrency: this.getConcurrency(),
            connection: this.getRedisConnection()
        };
    }

    private getConcurrency(): number {
        const concurrencyStr = this.env.WORKER_CONCURRENCY;
        if (!concurrencyStr) return this.defaultConcurrency;

        const concurrency = parseInt(concurrencyStr);
        return isNaN(concurrency) ? this.defaultConcurrency : concurrency;
    }

    private getRedisConnection() {
        const config = configStore.getRedisConfig();
        return {
            host: config.host,
            port: config.port,
            password: config.password,
        };
    }
}

export {WorkerConfigManager};