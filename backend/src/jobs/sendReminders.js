const { Worker } = require('bullmq');
const connection = require('../lib/redis');
const { sendReminderEmail } = require('../services/email/reminder');

const worker = new Worker(
  'reminder-queue',
  async (job) => {
    const { actionItemId } = job.data;
    await sendReminderEmail(actionItemId);
  },
  { connection, concurrency: 2 }
);

worker.on('completed', (job) => {
  console.log(`Reminder job ${job.id} completed for action item ${job.data.actionItemId}`);
});

worker.on('failed', (job, err) => {
  console.error(`Reminder job ${job.id} failed:`, err.message);
});

module.exports = worker;