class HelperFunctions {

    public getHumanReadableSize(size: number): string {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let index = 0;
        let humanReadableSize = size;

        while (humanReadableSize >= 1024 && index < units.length - 1) {
            humanReadableSize /= 1024;
            index++;
        }

        return `${humanReadableSize.toFixed(2)} ${units[index]}`;
    }

    public getSizeInGB(size: string): number {

        let value = parseInt(size.split(' ')[0]);
        const unit = size.split(' ')[1].toUpperCase();

        switch (unit) {
            case 'KB':
                value /= 1024 ** 2;
                break;
            case 'MB':
                value /= 1024;
                break;
            case 'TB':
                value *= 1024;
                break;
            default:
                break;
        }
        return value;
    }

    public generateJobId(prefix: string, isLargeDownload: boolean): string {
        const suffix = isLargeDownload ? 'large' : 'small';
        const sanitizedPrefix = prefix.replace(/[^a-zA-Z0-9]/g, '_');
        return `${sanitizedPrefix}-${suffix}`;
    }

    public getHumanRedableCurrentDateAndTime(): string {

        const now = new Date();

        const formattedDate = now.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const formattedTime = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
        const formattedDateTime = `${formattedDate} ${formattedTime}`;

        return formattedDateTime;
    }

    public formatBytes(bytes: number, decimals = 2): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    public monitorMemoryUsageOfAJob(jobId: string): NodeJS.Timeout {
        return setInterval(() => {
            const memUsage = process.memoryUsage();
            console.log(`[${jobId}] Memory usage: RSS ${this.formatBytes(memUsage.rss)}, Heap ${this.formatBytes(memUsage.heapUsed)}/${this.formatBytes(memUsage.heapTotal)}`);
        }, 30000);
    }

    public extractKeyFromS3Url(s3Url: string): string {
        return s3Url.split("amazonaws.com/")[1];
    }

}

export default HelperFunctions;