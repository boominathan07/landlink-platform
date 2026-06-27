const { Resend } = require('resend');

let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

const sendEmail = async ({ to, subject, html }) => {
  if (!resend || !to) return;
  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'LandLink <onboarding@resend.dev>',
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
};

module.exports = { sendEmail };
