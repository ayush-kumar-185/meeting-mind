const { Queue, Worker } = require('bullmq');
const connection = require('../lib/redis');
const { Workspace } = require('../models');
const { detectPatternsForWorkspace } = require('../services/ai/patternDetector');

const patternQueue = new Queue('pattern-detection-queue', { connection });

const worker = new Worker(
  'pattern-detection-queue',
  async () => {
    const workspaces = await Workspace.find().select('_id name');
    const results = [];

    for (const ws of workspaces) {
      try {
        const result = await detectPatternsForWorkspace(ws._id);
        results.push({ workspace: ws.name, ...result });
      } catch (err) {
        console.error(`Pattern detection failed for workspace ${ws._id}:`, err.message);
        results.push({ workspace: ws.name, error: err.message });
      }
    }

    console.log('Pattern detection run complete:', results);
    return results;
  },
  { connection }
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