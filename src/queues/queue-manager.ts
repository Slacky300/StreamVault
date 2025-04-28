import { Queue, JobsOptions, Job } from 'bullmq';
import { configStore } from '../config/config.js';

interface JobData {
  jobId: string;
  name: string;
  data: unknown;
  attempts: number;
  backoff: { type: string; delay: number };
  removeOnComplete: boolean;
  removeOnFail: boolean;
  result: unknown;
  failReason?: unknown;
  progress?: number;
  state?: string;
}

class QueueManager {
  private static instance: QueueManager;
  private queues: Map<string, Queue>;
  private readonly redisConfig: { host: string; port: number; password?: string };
  private readonly jobOptions: JobsOptions;

  private constructor() {
    this.queues = new Map();
    this.redisConfig = configStore.getRedisConfig();
    this.jobOptions = configStore.getJobOptionsForQueues();
    
    this.getQueue("large-downloads");
    this.getQueue("small-downloads");
  }

  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  public getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: {
          host: this.redisConfig.host,
          port: this.redisConfig.port,
          password: this.redisConfig.password,
        },
        defaultJobOptions: this.jobOptions,
      });
      this.queues.set(queueName, queue);
    }
    return this.queues.get(queueName)!;
  }

  public async addJob(queueName: string, name: string, jobId: string, data: unknown): Promise<void> {
    try {
      const queue = this.getQueue(queueName);
      await queue.add(name, data, {
        jobId,
        attempts: this.jobOptions.attempts,
        backoff: this.jobOptions.backoff,
        removeOnComplete: this.jobOptions.removeOnComplete,
        removeOnFail: this.jobOptions.removeOnFail,
      });
      
      console.log(`Job ${name} with ID ${jobId} added to queue ${queueName}.`);
    } catch (error) {
      console.error(`Error adding job to queue ${queueName}:`, error);
      throw new Error(`Failed to add job ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async getJobDetails(jobId: string): Promise<JobData | null> {

    for (const [queueName, queue] of this.queues.entries()) {
      try {
        const job = await queue.getJob(jobId);
        
        if (job) {
          const jobState = await job.getState();
          const jobProgress = job.progress || 0;

          let jobResult: unknown = null;
          if (jobState === 'completed') {
            jobResult = await job.returnValue;
          }

          let failReason: unknown = null;
          if (jobState === 'failed') {
            failReason = await job.failedReason;
          }

          const jobData: JobData = {
            jobId: job.id,
            name: job.name,
            data: job.data,
            attempts: job.opts.attempts || 0,
            backoff: job.opts.backoff || { type: 'none', delay: 0 },
            removeOnComplete: job.opts.removeOnComplete || false,
            removeOnFail: job.opts.removeOnFail || false,
            result: jobResult,
            progress: jobProgress,
            state: jobState,
            failReason,
          };

          console.log(`Job ${jobId} found in queue ${queueName}`);
          return jobData;
        }
      } catch (error) {
        console.error(`Error checking job in queue ${queueName}:`, error);
      }
    }
    
    console.log(`Job ${jobId} not found in any queue`);
    return null;
  }

  public async deleteJob(jobId: string): Promise<boolean> {

    for (const [queueName, queue] of this.queues.entries()) {
      try {
        const job = await queue.getJob(jobId);
        
        if (job) {
          await job.remove();
          console.log(`Job ${jobId} deleted from queue ${queueName}`);
          return true;
        }
      } catch (error) {
        console.error(`Error deleting job from queue ${queueName}:`, error);
      }
    }
    
    console.log(`Job ${jobId} not found in any queue for deletion`);
    return false;
  }


  public async processJob(job: Job){
    
  }

  public async closeAllQueues(): Promise<void> {
    for (const [queueName, queue] of this.queues.entries()) {
      try {
        await queue.close();
        console.log(`Queue ${queueName} closed successfully`);
      } catch (error) {
        console.error(`Error closing queue ${queueName}:`, error);
      }
    }
    this.queues.clear();
  }
}

export default QueueManager;