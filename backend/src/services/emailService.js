const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendVerificationEmail(toEmail, userName, verificationToken) {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  const msg = {
    to: toEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name:  process.env.SENDGRID_FROM_NAME || 'CashFlawHubs',
    },
    subject: 'Verify your CashFlawHubs email address',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#10b981;color:#fff;font-weight:900;font-size:20px;width:48px;height:48px;line-height:48px;border-radius:12px;">C</div>
          <h1 style="font-size:22px;font-weight:900;margin:16px 0 4px;">Verify your email</h1>
          <p style="color:#94a3b8;font-size:14px;margin:0;">Hi ${userName}, one click and you're done.</p>
        </div>
        <a href="${verifyUrl}"
           style="display:block;text-align:center;background:#10b981;color:#fff;font-weight:700;font-size:15px;padding:14px 24px;border-radius:12px;text-decoration:none;margin:24px 0;">
          Verify Email Address
        </a>
        <p style="color:#64748b;font-size:12px;text-align:center;margin:16px 0 0;">
          This link expires in 24 hours. If you didn't register on CashFlawHubs, ignore this email.
        </p>
        <p style="color:#334155;font-size:11px;text-align:center;margin:8px 0 0;word-break:break-all;">
          ${verifyUrl}
        </p>
      </div>
    `,
  };

  await sgMail.send(msg);
}

module.exports = { sendVerificationEmail };
