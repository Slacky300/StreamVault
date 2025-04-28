// dashboard.js
import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import basicAuth from 'express-basic-auth';
import QueueManager from '../queues/queue-manager.js';

const queueManager = QueueManager.getInstance();
/**
 * Creates and configures a Bull Dashboard server
 * @param {DashboardOptions} options Configuration options
 * @param {number} options.port Port to run the dashboard on (default: 3001)
 * @param {string} options.basePath Base path for the dashboard (default: '/dashboard')
 * @param {AuthOptions} options.auth Authentication credentials (optional)
 * @returns {express.Application} The configured Express app
 */
interface AuthOptions {
    user: string;
    password: string;
}

interface DashboardOptions {
    port?: number;
    basePath?: string;
    auth?: AuthOptions;
}

export function createDashboard(options: DashboardOptions = {}) {
    const {
        port = process.env.DASHBOARD_PORT || 3001,
        basePath = process.env.DASHBOARD_BASE_PATH || '/dashboard',
        auth = {
            user: process.env.DASHBOARD_USER || 'admin',
            password: process.env.DASHBOARD_PASSWORD || 'admin'
        }
    } = options;

    // Create Express server
    const app = express();

    const zipQueue = queueManager.getQueue('small-downloads');
    const largeZipQueue = queueManager.getQueue('large-downloads');

    // Create Bull Board adapter
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath(basePath);

    // Create Bull Board with your queues
    createBullBoard({
        queues: [
            new BullMQAdapter(zipQueue),
            new BullMQAdapter(largeZipQueue)
        ],
        serverAdapter
    });

    // Add basic authentication if credentials are provided
    if (auth.user && auth.password) {
        app.use(basePath, basicAuth({
            users: { [auth.user]: auth.password },
            challenge: true,
            realm: 'Bull Dashboard'
        }));
    }

    // Mount the Bull Board UI
    app.use(basePath, serverAdapter.getRouter());

    // Add a health check endpoint
    app.get('/health', (_, res) => {
        res.json({ status: 'ok' });
    });

    // Start the server if this file is run directly
    app.listen(port, () => {
        console.log(`Bull Dashboard running on http://localhost:${port}${basePath}`);
    });



    return app;
}

// Start the dashboard if this file is run directly
createDashboard();


export default createDashboard;