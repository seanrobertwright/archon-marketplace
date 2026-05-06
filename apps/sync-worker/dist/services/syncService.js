import axios from 'axios';
import prisma from '../prisma';
export const syncWorkflows = async () => {
    console.log('Starting sync process...');
    try {
        // 1. Get all workflows from DB
        const workflows = await prisma.workflow.findMany();
        for (const workflow of workflows) {
            console.log(`Syncing ${workflow.owner}/${workflow.repo}...`);
            try {
                // 2. Fetch latest metadata from GitHub
                const url = `https://raw.githubusercontent.com/${workflow.owner}/${workflow.repo}/main/${workflow.path}`;
                const response = await axios.get(url, {
                    headers: {
                        'Authorization': process.env.GITHUB_TOKEN ? `token ${process.env.GITHUB_TOKEN}` : undefined
                    }
                });
                // 3. Update DB (Basic version, we'll add more in security phase)
                // For now, we just verify it exists and update the timestamp
                await prisma.workflow.update({
                    where: { id: workflow.id },
                    data: {
                        updatedAt: new Date()
                    }
                });
                console.log(`Successfully synced ${workflow.owner}/${workflow.repo}`);
            }
            catch (err) {
                console.error(`Failed to fetch ${workflow.owner}/${workflow.repo}: ${err.message}`);
            }
        }
    }
    catch (error) {
        console.error('Error in sync process:', error);
    }
};
