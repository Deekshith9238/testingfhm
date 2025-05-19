import nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';

// Create a test account for development
let transporter: nodemailer.Transporter;

async function createTestAccount() {
  console.log('Creating Ethereal test account for email testing...');
  const testAccount = await nodemailer.createTestAccount();
  console.log('Ethereal account created:', {
    user: testAccount.user,
    pass: testAccount.pass
  });
  
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

// Initialize the transporter
createTestAccount();

export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

export async function sendVerificationEmail(email: string, token: string) {
  const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  
  const info = await transporter.sendMail({
    from: '"Find My Helper" <noreply@findmyhelper.com>',
    to: email,
    subject: "Verify your email address",
    text: `Please verify your email address by clicking on the following link: ${verificationUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Find My Helper!</h2>
        <p>Please verify your email address by clicking on the button below:</p>
        <a href="${verificationUrl}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
          Verify Email
        </a>
        <p>Or copy and paste this link in your browser:</p>
        <p>${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
      </div>
    `,
  });

  // For development, log the preview URL
  if (process.env.NODE_ENV === 'development') {
    console.log('\n=== EMAIL PREVIEW ===');
    console.log('Since we are in development mode, emails are not sent to real addresses.');
    console.log('Instead, you can view the email here:');
    console.log(nodemailer.getTestMessageUrl(info));
    console.log('===================\n');
  }

  return info;
}

export async function sendLoginVerificationEmail(email: string, token: string) {
  const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify-login?token=${token}`;
  
  const info = await transporter.sendMail({
    from: '"Find My Helper" <noreply@findmyhelper.com>',
    to: email,
    subject: "Verify your login",
    text: `Please verify your login by clicking on the following link: ${verificationUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Login Verification</h2>
        <p>Please verify your login by clicking on the button below:</p>
        <a href="${verificationUrl}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
          Verify Login
        </a>
        <p>Or copy and paste this link in your browser:</p>
        <p>${verificationUrl}</p>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't attempt to log in, please ignore this email.</p>
      </div>
    `,
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  }

  return info;
} 