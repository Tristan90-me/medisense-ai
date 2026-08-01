const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
};

const verificationEmailTemplate = (name, link) => `
  <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:2rem;background:#f8faff;border-radius:12px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:1.5rem;">
      <div style="width:32px;height:32px;background:#3b82f6;border-radius:8px;display:flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-size:16px;">✚</span>
      </div>
      <span style="font-size:18px;font-weight:700;color:#0f2744;">MediSense AI</span>
    </div>
    <h2 style="color:#0f2744;font-size:20px;margin-bottom:0.5rem;">Verify your email address</h2>
    <p style="color:#475569;font-size:14px;line-height:1.7;">Hi ${name}, thanks for signing up. Click the button below to verify your email and activate your account.</p>
    <a href="${link}" style="display:inline-block;margin:1.5rem 0;padding:12px 28px;background:#3b82f6;color:#fff;border-radius:24px;text-decoration:none;font-size:14px;font-weight:600;">Verify my email</a>
    <p style="color:#94a3b8;font-size:12px;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
  </div>
`;

const otpEmailTemplate = (name, otp) => `
  <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:2rem;background:#f8faff;border-radius:12px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:1.5rem;">
      <div style="width:32px;height:32px;background:#3b82f6;border-radius:8px;display:flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-size:16px;">✚</span>
      </div>
      <span style="font-size:18px;font-weight:700;color:#0f2744;">MediSense AI</span>
    </div>
    <h2 style="color:#0f2744;font-size:20px;margin-bottom:0.5rem;">Your login code</h2>
    <p style="color:#475569;font-size:14px;line-height:1.7;">Hi ${name}, use the code below to complete your login.</p>
    <div style="text-align:center;margin:1.5rem 0;">
      <span style="font-size:40px;font-weight:800;letter-spacing:10px;color:#0f2744;">${otp}</span>
    </div>
    <p style="color:#94a3b8;font-size:12px;">This code expires in 10 minutes. If you didn't try to log in, please secure your account immediately.</p>
  </div>
`;

module.exports = { sendEmail, verificationEmailTemplate, otpEmailTemplate };