import {S3Service} from "../services/s3.js";
import { configStore } from "../config/config.js";
import { Request, Response } from "express";
import HelperFunctions from "../helpers/helper.js";
import QueueManager from "../queues/queue-manager.js";

class JobController {
  private readonly DOWNLOAD_THRESHOLD_IN_GB = parseInt(process.env.DOWNLOAD_THRESHOLD_IN_GB || "5", 10);
  private s3Config = configStore.getS3Config();
  private s3Client = new S3Service(
    this.s3Config.region,
    this.s3Config.bucketName,
    this.s3Config.accessKeyId,
    this.s3Config.secretAccessKey
  );
  private helperFunctions = new HelperFunctions();
  private queueManager = QueueManager.getInstance();

  public async createDownloadJob(req: Request, res: Response): Promise<void> {
    try {
      const { s3Key } = req.body;

      if (!s3Key) {
        res.status(400).json({ error: "Folder Path is required to begin the download" });
        return;
      }

      const {humanReadableSize: sizeOfFolder} = await this.s3Client.getTotalSizeOfObjects(s3Key);
      const sizeToCompareWithThreshold = this.helperFunctions.getSizeInGB(sizeOfFolder);
      const jobId = this.helperFunctions.generateJobId(s3Key, sizeToCompareWithThreshold > this.DOWNLOAD_THRESHOLD_IN_GB);

      const jobData = {
        s3Key,
        sizeOfFolder,
        thresholdValueInGB: this.DOWNLOAD_THRESHOLD_IN_GB,
        createdAt: this.helperFunctions.getHumanRedableCurrentDateAndTime(),
        jobId
      };

      const isLargeDownload = sizeToCompareWithThreshold > this.DOWNLOAD_THRESHOLD_IN_GB;
      const queueName = isLargeDownload ? "large-downloads" : "small-downloads";
      const jobType = isLargeDownload ? "large-download" : "small-download";

      await this.queueManager.addJob(queueName, jobType, jobId, jobData);

      res.status(201).json({
        message: `${isLargeDownload ? "Large" : "Small"} download job created successfully`,
        ...jobData,
        isLargeDownload
      });
    } catch (error) {
      console.error("Error creating download job:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  public async getJobDetails(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        res.status(400).json({ error: "Job ID is required" });
        return;
      }

      const jobDetails = await this.queueManager.getJobDetails(jobId);

      if (!jobDetails) {
        res.status(404).json({ error: "Job not found" });
        return;
      }

      res.status(200).json({ message: "Job details retrieved successfully", jobDetails });
    } catch (error) {
      console.error("Error retrieving job details:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  public async deleteJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        res.status(400).json({ error: "Job ID is required" });
        return;
      }

      const deleted = await this.queueManager.deleteJob(jobId);

      if (!deleted) {
        res.status(404).json({ error: "Job not found" });
        return;
      }

      res.status(200).json({ message: "Job deleted successfully" });
    } catch (error) {
      console.error("Error deleting job:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export default JobController;