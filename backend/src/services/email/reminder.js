const resend = require('../../lib/resend');
const { ActionItem } = require('../../models');

async function sendReminderEmail(actionItemId) {
  const item = await ActionItem.findById(actionItemId);
  if (!item) throw new Error('Action item not found');

  // Skip if already done, or if somehow missing assignee email
  if (item.status === 'done') {
    console.log(`Skipping reminder for ${actionItemId} — already done`);
    return;
  }
  if (!item.assignee?.email) {
    console.log(`Skipping reminder for ${actionItemId} — no assignee email`);
    return;
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: item.assignee.email,
    subject: `Reminder: "${item.title}" is due soon`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px;">
        <h2>Reminder</h2>
        <p>Hi ${item.assignee.name}, this is a reminder that the following is due soon:</p>
        <p style="background:#f5f5f5;padding:12px;border-radius:6px;"><strong>${item.title}</strong><br/>
        Due ${new Date(item.deadline).toLocaleDateString()}</p>
        <p style="color:#aaa;font-size:12px;margin-top:24px;">Sent automatically by MeetingMind.</p>
      </div>
    `,
  });

  item.reminderSentAt = new Date();
  await item.save();
  console.log(`Reminder sent for action item ${actionItemId}`);
}

module.exports = { sendReminderEmail };