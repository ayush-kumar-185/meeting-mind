const { Queue, Worker } = require('bullmq');
const connection = require('../lib/redis');
const { Workspace } = require('../models');
const { detectPatternsForWorkspace } = require('../services/ai/patternDetector');

const patternQueue = new Queue('pattern-detection-queue', { connection });

const worker = new Worker(
  'pattern-detection-queue',
  async (job) => {
    if (job.name === 'weekly-scan') {
      // Dispatcher logic: fan out to individual workspaces
      const workspaces = await Workspace.find().select('_id name');
      console.log(`Dispatching pattern scans for ${workspaces.length} workspaces...`);
      for (const ws of workspaces) {
        // Use jobId to prevent overlapping scan jobs for the same workspace
        await patternQueue.add(
          'scan-workspace', 
          { workspaceId: ws._id, workspaceName: ws.name },
          { jobId: `scan-workspace-${ws._id.toString()}` }
        );
      }
      return { dispatched: workspaces.length };
    } 
    
    if (job.name === 'scan-workspace') {
      // Worker logic: process a single workspace
      const { workspaceId, workspaceName } = job.data;
      console.log(`Scanning workspace ${workspaceName} for patterns...`);
      try {
        const result = await detectPatternsForWorkspace(workspaceId);
        return result;
      } catch (err) {
        console.error(`Pattern detection failed for workspace ${workspaceId}:`, err.message);
        throw err; // retry on failure
      }
    }
  },
  { connection, concurrency: 2 } // Keep low to avoid Gemini rate limits
);

async function scheduleWeeklyPatternDetection() {
  await patternQueue.add(
    'weekly-scan',
    {},
    {
      repeat: { pattern: '0 0 * * 1' }, // every Monday at midnight
      jobId: 'weekly-pattern-scan', // prevents duplicate scheduling on restart
    }
  );
  console.log('Weekly pattern detection scheduled');
}

module.exports = { worker, scheduleWeeklyPatternDetection, patternQueue };