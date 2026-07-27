const { Queue } = require('bullmq');
const connection = require('./redis');

const extractionQueue = new Queue('extraction-queue', { connection });
const reminderQueue = new Queue('reminder-queue', { connection });
const overdueQueue = new Queue('overdue-queue', { connection });

module.exports = { extractionQueue, reminderQueue, overdueQueue };