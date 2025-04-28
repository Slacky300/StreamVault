import { Job } from "bullmq";
import HelperFunctions from "../helpers/helper.js";
import archiver from "archiver";
import { PassThrough } from "stream";

class ArchiveManager {
    private readonly ZIP_LEVEL = 6; 
    private readonly ZIP_FORMAT = 'zip';
    private readonly PASS_THROUGH_STREAM_SIZE = 1024 * 1024 * 4; // 4MB
    private readonly helper = new HelperFunctions();
    private readonly SIZE_TO_REPORT = 1024 * 1024 * 50; // 50MB

    constructor(private readonly job: Job) {}

    public createArchiveStream(): { 
        archive: archiver.Archiver; 
        passThrough: PassThrough;
    } {
        const passThrough = new PassThrough({
            highWaterMark: this.PASS_THROUGH_STREAM_SIZE
        });

        const archive = archiver(this.ZIP_FORMAT, {
            zlib: { level: this.ZIP_LEVEL },
            forceZip64: true,
            highWaterMark: this.PASS_THROUGH_STREAM_SIZE,
        });

        this.setupArchiveEvents(archive);
        
        archive.pipe(passThrough);

        return { archive, passThrough };
    }

    private setupArchiveEvents(archive: archiver.Archiver): void {
        let lastReportSize = 0;

        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                this.job.log(`[${this.job.id}] Warning: ${err.message}`);
            } else {
                this.job.log(`[${this.job.id}] Error: ${err.message}`);
                throw err;
            }
        });

        archive.on('error', (err) => {
            this.job.log(`[${this.job.id}] Error: ${err.message}`);
            throw err;
        });

        archive.on('data', () => {
            const currentSize = archive.pointer();
            if (currentSize - lastReportSize >= this.SIZE_TO_REPORT) {
                this.job.log(`[${this.job.id}] Zipping in progress: ${this.helper.formatBytes(archive.pointer())}`);
                lastReportSize = currentSize;
            }
        });
    }
}

export default ArchiveManager;
