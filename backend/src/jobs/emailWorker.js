const { Worker } = require('bullmq');
const connection = require('../lib/redis');
const resend = require('../lib/resend');
const { ActionItem, Meeting } = require('../models');

function buildEmailHtml({ attendeeName, meetingTitle, actionItems, decisions }) {
  const itemsHtml = actionItems.length
    ? actionItems.map(item => `
        <li style="margin-bottom: 8px;">
          <strong>${item.title}</strong>
          ${item.deadline ? `<br/><span style="color:#888;font-size:13px;">Due ${new Date(item.deadline).toLocaleDateString()}</span>` : ''}
        </li>
      `).join('')
    : '<li style="color:#888;">No action items assigned to you.</li>';

  const decisionsHtml = (decisions && decisions.length)
    ? decisions.map(d => `<li>${d}</li>`).join('')
    : '<li style="color:#888;">No decisions recorded.</li>';

  return `
    <div style="font-family: sans-serif; max-width: 500px;">
      <h2>Follow-up: ${meetingTitle}</h2>
      <p>Hi ${attendeeName}, here's your recap from the meeting.</p>
      <h3>Your action items</h3>
      <ul>${itemsHtml}</ul>
      <h3>Decisions made</h3>
      <ul>${decisionsHtml}</ul>
      <p style="color:#aaa; font-size:12px; margin-top:24px;">Sent automatically by MeetingMind.</p>
    </div>
  `;
}

const worker = new Worker(
  'email-queue',
  async (job) => {
    const { meetingId, attendee } = job.data;
    
    if (!attendee || !attendee.email) return { skipped: true, reason: 'No email address' };

    // Atomically claim the email send for this attendee.
    // If attendee.email is already in followUpsSentTo, findOneAndUpdate will return null (not modified)
    const claimedMeeting = await Meeting.findOneAndUpdate(
      { _id: meetingId, followUpsSentTo: { $ne: attendee.email } },
      { $addToSet: { followUpsSentTo: attendee.email } },
      { returnDocument: 'after' }
    );

    if (!claimedMeeting) {
      // It might not exist, or we might have just already sent it.
      const exists = await Meeting.findById(meetingId);
      if (!exists) throw new Error(`Meeting ${meetingId} not found`);
      console.log(`Email already sent to ${attendee.email} for meeting ${meetingId}, skipping duplicate.`);
      return { success: true, email: attendee.email, alreadySent: true };
    }

    const meeting = claimedMeeting;

    const allItems = await ActionItem.find({ meetingId });
    const theirItems = allItems.filter(
      item => item.assignee?.name?.toLowerCase() === attendee.name.toLowerCase()
    );

    const html = buildEmailHtml({
      attendeeName: attendee.name,
      meetingTitle: meeting.title,
      actionItems: theirItems,
      decisions: meeting.decisions,
    });

    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: attendee.email,
        subject: `Follow-up: ${meeting.title}`,
        html,
      });
      return { success: true, email: attendee.email };
    } catch (err) {
      // Revert the claim so it can be safely retried by BullMQ
      await Meeting.updateOne(
        { _id: meetingId }, 
        { $pull: { followUpsSentTo: attendee.email } }
      );
      console.error(`Failed to send email to ${attendee.email}:`, err.message);
      // Throwing forces BullMQ to retry the job according to the backoff config
      throw err; 
    }
  },
  { connection, concurrency: 5 } // 5 concurrent emails
);

worker.on('failed', (job, err) => {
  console.error(`Email job ${job.id} failed:`, err.message);
});

module.exports = worker;
