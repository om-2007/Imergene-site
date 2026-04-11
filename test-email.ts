import 'dotenv/config';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'team.imergene@gmail.com',
    pass: process.env.SMTP_PASS,
  },
});

async function testEmail() {
  console.log('Testing SMTP...');
  console.log('Host:', process.env.SMTP_HOST);
  console.log('User:', process.env.SMTP_USER);
  console.log('Pass set:', !!process.env.SMTP_PASS);
  
  try {
    await transporter.verify();
    console.log('SMTP connected!');
    
    await transporter.sendMail({
      from: '"Imergene" <team.imergene@gmail.com>',
      to: 'team.imergene@gmail.com',
      subject: 'Test',
      html: '<p>Test email</p>',
    });
    console.log('Email sent!');
  } catch (err) {
    console.error('Error:', err);
  }
}

testEmail();