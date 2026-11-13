const { Worker } = require('bullmq');
const connection = require('../lib/redis');
const { ActionItem } = require('../models');
const { pushActionItemToJira } = require('../services/integrations/jira');

const worker = new Worker(
  'jira-queue',
  async (job) => {
    const { actionItemId, userId } = job.data;
    
    // Atomically claim the Jira push to prevent concurrent workers from both executing it
    const claimedItem = await ActionItem.findOneAndUpdate(
      { 
        _id: actionItemId, 
        'pushedTo.tool': { $ne: 'jira' }, 
        jiraPushLock: false 
      },
      { $set: { jiraPushLock: true } },
      { returnDocument: 'after' }
    );

    if (!claimedItem) {
      // Check if it actually exists vs already pushed/locked
      const exists = await ActionItem.findById(actionItemId);
      if (!exists) throw new Error(`Action item ${actionItemId} not found`);
      
      const alreadyPushed = exists.pushedTo.some(p => p.tool === 'jira');
      if (alreadyPushed) {
        console.log(`Action item ${actionItemId} already pushed to Jira`);
        return { success: true, alreadyPushed: true };
      }
      
      // If it exists but is locked, it means another worker is currently pushing it.
      // We can fail here and let BullMQ retry it later, just in case the other worker crashes.
      throw new Error(`Action item ${actionItemId} is currently locked for Jira push`);
    }

    const item = claimedItem;

    try {
      const pushResult = await pushActionItemToJira(userId, item);
      await ActionItem.updateOne(
        { _id: actionItemId },
        { 
          $push: { pushedTo: pushResult },
          $set: { jiraPushLock: false }
        }
      );
      return { success: true, externalId: pushResult.externalId };
    } catch (err) {
      const msg = err.message || '';
      console.error(`Jira push failed for item ${actionItemId}:`, msg);

      // Terminal errors that shouldn't be retried
      if (msg.includes('revoked') || msg.includes('not connected') || msg.includes('create a project')) {
        // Unlock on terminal failure so the user can fix the issue and try again
        await ActionItem.updateOne({ _id: actionItemId }, { $set: { jiraPushLock: false } });
        return { success: false, reason: msg };
      }

      // Throwing forces BullMQ to retry (for 429, 500, network timeouts)
      // Unlock so the retry can claim it
      await ActionItem.updateOne({ _id: actionItemId }, { $set: { jiraPushLock: false } });
      throw err;
    }
  },
  { connection, concurrency: 2 } // Keep low to respect Jira rate limits
);

worker.on('failed', (job, err) => {
  console.error(`Jira job ${job.id} failed:`, err.message);
});

module.exports = worker;
