const resend = require('../../lib/resend');

async function sendInviteEmail({ toEmail, toName, inviterName, workspaceName, role }) {
  const appUrl = process.env.FRONTEND_URL ;

  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: `${inviterName} invited you to join "${workspaceName}" on MeetingMind`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px;">
        <h2>You've been invited</h2>
        <p>Hi ${toName || toEmail},</p>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${workspaceName}</strong> on MeetingMind as a <strong>${role}</strong>.</p>
        <p style="margin: 24px 0;">
          <a href="${appUrl}/login" style="background:#5b21b6;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
            Sign in to accept
          </a>
        </p>
        <p style="color:#888;font-size:13px;">Sign in with Google using this email address (${toEmail}), then go to Settings to accept the invitation.</p>
        <p style="color:#aaa; font-size:12px; margin-top:24px;">Sent automatically by MeetingMind.</p>
      </div>
    `,
  });
}

module.exports = { sendInviteEmail };