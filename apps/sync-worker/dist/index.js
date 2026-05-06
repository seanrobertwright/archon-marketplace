import cron from 'node-cron';
import dotenv from 'dotenv';
import { syncWorkflows } from './services/syncService';
dotenv.config();
console.log('Sync Worker starting...');
// Run every hour
cron.schedule('0 * * * *', async () => {
    console.log('Running scheduled sync...');
    await syncWorkflows();
});
// Run initial sync on start
(async () => {
    console.log('Running initial sync...');
    await syncWorkflows();
})();
