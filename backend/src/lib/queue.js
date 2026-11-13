const { Queue } = require('bullmq');
const connection = require('./redis');

const extractionQueue = new Queue('extraction-queue', { connection });
const reminderQueue = new Queue('reminder-queue', { connection });
const overdueQueue = new Queue('overdue-queue', { connection });
const emailQueue = new Queue('email-queue', { connection });
const jiraQueue = new Queue('jira-queue', { connection });

module.exports = { extractionQueue, reminderQueue, overdueQueue, emailQueue, jiraQueue };