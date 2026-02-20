import nodemailer from "nodemailer";

export async function sendSignUpConfirmationEmail(to: string) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "Sign Up Confirmation",
    text: `Hello,\n\nThank you for signing up! Your account has been created successfully.`,
    html: `<p>Hello,</p><p>Thank you for signing up! Your account has been created successfully.</p>`,
  };

  await transporter.sendMail(mailOptions);
}
