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
    meeting.errorDetails = undefined; // clear any previous error
    await meeting.save();

    // Match assignee name against known attendees to backfill email/userId
    const attendeeMap = new Map(
      meeting.attendees.map(a => [a.name.toLowerCase(), a])
    );

    // Fetch existing records for reconciliation
    const existingActionItems = await ActionItem.find({ meetingId: meeting._id });
    const existingCommitments = await Commitment.find({ meetingId: meeting._id });

    // 1. Reconcile Action Items
    const extractedActionTitles = new Set(extracted.actionItems?.map(a => a.title) || []);

    // Clean up obsolete AI hallucinations, BUT preserve if user modified them (not pending or pushed to Jira)
    const itemsToDelete = existingActionItems.filter(item => {
      const fingerprint = item.originalTitle || item.title;
      return !extractedActionTitles.has(fingerprint) && item.status === 'pending' && (!item.pushedTo || item.pushedTo.length === 0);
    });

    if (itemsToDelete.length > 0) {
      await ActionItem.deleteMany({ _id: { $in: itemsToDelete.map(i => i._id) } });
    }

    if (extracted.actionItems?.length) {
      // Only insert items that don't already exist
      const newDocs = extracted.actionItems
        .filter(item => !existingActionItems.some(existing => (existing.originalTitle || existing.title) === item.title))
        .map(item => {
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
            originalTitle: item.title,
            description: item.description,
            deadline: item.deadline ? new Date(item.deadline) : undefined,
            priority: item.priority || 'medium',
          };
        });

      if (newDocs.length > 0) {
        const createdItems = await ActionItem.insertMany(newDocs);

        // Queue reminders only for newly inserted items
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
    }

    // 2. Reconcile Commitments
    const extractedCommitmentTexts = new Set(extracted.commitments?.map(c => c.commitment) || []);

    // Clean up obsolete AI commitments (preserve if user fulfilled/modified)
    const commitmentsToDelete = existingCommitments.filter(c => {
      const fingerprint = c.originalCommitment || c.commitment;
      return !extractedCommitmentTexts.has(fingerprint) && c.status === 'pending';
    });

    if (commitmentsToDelete.length > 0) {
      await Commitment.deleteMany({ _id: { $in: commitmentsToDelete.map(c => c._id) } });
    }

    if (extracted.commitments?.length) {
      // Only insert commitments that don't already exist
      const newCommitments = extracted.commitments
        .filter(c => !existingCommitments.some(existing => (existing.originalCommitment || existing.commitment) === c.commitment))
        .map(c => {
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
            originalCommitment: c.commitment,
            deadline: c.deadline ? new Date(c.deadline) : undefined,
            appearedInMeetings: [meeting._id],
          };
        });

      if (newCommitments.length > 0) {
        await Commitment.insertMany(newCommitments);
      }
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
  await Meeting.findByIdAndUpdate(job.data.meetingId, { 
    status: 'failed',
    errorDetails: err.message
  });
});

module.exports = worker;