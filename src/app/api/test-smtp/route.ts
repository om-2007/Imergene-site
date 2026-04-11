import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function GET() {
  const SMTP_PASS = process.env.SMTP_PASS;
  
  if (!SMTP_PASS || SMTP_PASS === 'your-app-password-here') {
    return NextResponse.json({ 
      status: 'SMTP_PASS not configured',
      env: {
        host: process.env.SMTP_HOST,
        user: process.env.SMTP_USER,
        passSet: !!SMTP_PASS,
      }
    });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  try {
    await transporter.verify();
    return NextResponse.json({ status: 'Connected successfully' });
  } catch (err: any) {
    return NextResponse.json({ 
      status: 'Connection failed',
      error: err.message 
    }, { status: 500 });
  }
}