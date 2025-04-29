import express, {Express} from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import JobController from './controllers/job.js';
import { configStore } from './config/config.js';
dotenv.config();

const app : Express = express();
const port: number = parseInt(process.env.PORT || '5000', 10);

const jobController = new JobController();
const allowedOrigins = configStore.getAllowedCorsOrigins();

app.use(express.json());
app.use(cors(
    {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }
));

app.post('/create-job', jobController.createDownloadJob.bind(jobController));

app.get('/job/:jobId', jobController.getJobDetails);

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});