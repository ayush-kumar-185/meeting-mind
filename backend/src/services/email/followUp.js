const resend = require('../../lib/resend');
const { ActionItem, Meeting } = require('../../models');

function buildEmailHtml({ attendeeName, meetingTitle, actionItems, decisions }) {
  const itemsHtml = actionItems.length
    ? actionItems.map(item => `
        <li style="margin-bottom: 8px;">
          <strong>${item.title}</strong>
          ${item.deadline ? `<br/><span style="color:#888;font-size:13px;">Due ${new Date(item.deadline).toLocaleDateString()}</span>` : ''}
        </li>
      `).join('')
    : '<li style="color:#888;">No action items assigned to you.</li>';

  const decisionsHtml = decisions.length
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

async function sendFollowUpsForMeeting(meetingId) {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new Error('Meeting not found');

  const allItems = await ActionItem.find({ meetingId });

  const results = [];

  for (const attendee of meeting.attendees) {
    if (!attendee.email) {
      results.push({ attendee: attendee.name, skipped: true, reason: 'No email on file' });
      continue;
    }

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
      results.push({ attendee: attendee.name, sent: true });
    } catch (err) {
      console.error(`Failed to send to ${attendee.email}:`, err.message);
      results.push({ attendee: attendee.name, sent: false, error: err.message });
    }
  }

  return results;
}

module.exports = { sendFollowUpsForMeeting };