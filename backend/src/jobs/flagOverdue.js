const { Worker } = require('bullmq');
const connection = require('../lib/redis');
const { ActionItem, Commitment } = require('../models');
const { overdueQueue } = require('../lib/queue');

const worker = new Worker(
  'overdue-queue',
  async () => {
    const now = new Date();

    const overdueActionItems = await ActionItem.updateMany(
      { deadline: { $lt: now }, status: { $in: ['pending', 'in_progress'] } },
      { status: 'overdue' }
    );

    const overdueCommitments = await Commitment.updateMany(
      { deadline: { $lt: now }, status: 'pending' },
      { status: 'overdue' }
    );

    console.log(`Overdue flagger: ${overdueActionItems.modifiedCount} action items, ${overdueCommitments.modifiedCount} commitments marked overdue`);
    return { actionItems: overdueActionItems.modifiedCount, commitments: overdueCommitments.modifiedCount };
  },
  { connection }
);

async function scheduleDailyOverdueFlagging() {
  await overdueQueue.add(
    'daily-overdue-flag',
    {},
    {
      repeat: { pattern: '0 0 * * *' }, // daily at midnight
      jobId: 'daily-overdue-scan', // prevents duplicate scheduling on restart
    }
  );
  console.log('Daily overdue flagging scheduled');
}

module.exports = { worker, scheduleDailyOverdueFlagging };