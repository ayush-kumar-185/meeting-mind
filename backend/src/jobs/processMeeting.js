const { Worker } = require('bullmq');
const connection = require('../lib/redis');
const Meeting = require('../models/meeting');
const ActionItem  = require('../models/actionItem');
const Commitment  = require('../models/commitment');
const { extractFromTranscript } = require('../services/ai/extractor');
const { extractionQueue, reminderQueue } = require('../lib/queue');
const worker = new Worker(
  'extraction-queue',
  async (job) => {
    const { meetingId } = job.data;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

    const extracted = await extractFromTranscript(meeting.rawTranscript, meeting.attendees);

    meeting.summary = extracted.summary;
    meeting.decisions = extracted.decisions;
    meeting.unresolvedIssues = extracted.unresolvedIssues;
    meeting.status = 'ready';
    await meeting.save();

    // Match assignee name against known attendees to backfill email/userId
    const attendeeMap = new Map(
      meeting.attendees.map(a => [a.name.toLowerCase(), a])
    );

    if (extracted.actionItems?.length) {
      const docs = extracted.actionItems.map(item => {
        const matchedAttendee = item.assignee
          ? attendeeMap.get(item.assignee.toLowerCase())
          : null;

        return {
          meetingId: meeting._id,
          workspaceId: meeting.workspaceId,
          assignee: item.assignee
            ? {
                name: item.assignee,
                email: matchedAttendee?.email,
                userId: matchedAttendee?.userId,
              }
            : undefined,
          title: item.title,
          description: item.description,
          deadline: item.deadline ? new Date(item.deadline) : undefined,
          priority: item.priority || 'medium',
        };
      });

      const createdItems = await ActionItem.insertMany(docs);

      for (const item of createdItems) {
        if (item.deadline && item.assignee?.email) {
          const reminderTime = new Date(item.deadline).getTime() - 24 * 60 * 60 * 1000;
          const delay = reminderTime - Date.now();

          if (delay > 0) {
            await reminderQueue.add(
              'send-reminder',
              { actionItemId: item._id.toString() },
              { delay }
            );
          } else {
            console.log(`Skipping reminder for ${item._id} — deadline is less than 24hrs away or in the past`);
          }
        }
      }
    }

    if (extracted.commitments?.length) {
      const commitmentDocs = extracted.commitments.map(c => {
        const matchedAttendee = attendeeMap.get(c.madeBy?.toLowerCase());
        return {
          workspaceId: meeting.workspaceId,
          meetingId: meeting._id,
          madeBy: {
            name: c.madeBy,
            email: matchedAttendee?.email,
            userId: matchedAttendee?.userId,
          },
          commitment: c.commitment,
          deadline: c.deadline ? new Date(c.deadline) : undefined,
          appearedInMeetings: [meeting._id],
        };
      });

      await Commitment.insertMany(commitmentDocs);
    }

    await meeting.save();

    return { actionItemsCreated: extracted.actionItems?.length || 0 };
  },
  { connection, concurrency: 2 }
);

worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed for meeting ${job.data.meetingId} — ${result.actionItemsCreated} action items created`);
});

worker.on('failed', async (job, err) => {
  console.error(`Job ${job.id} failed for meeting ${job.data.meetingId}:`, err.message);
  await Meeting.findByIdAndUpdate(job.data.meetingId, { status: 'failed' });
});

module.exports = worker;