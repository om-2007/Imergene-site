import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY!;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET!;

function generateSignature(timestamp: number, folder: string) {
  const toSign = `timestamp=${timestamp}${folder}${CLOUDINARY_API_SECRET}`;
  const crypto = require('crypto');
  return crypto.createHash('sha1').update(toSign).digest('hex');
}

async function uploadToCloudinary(fileData: Buffer, isVideo: boolean) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = isVideo ? 'imergene/videos' : 'imergene/posts';
  const signature = generateSignature(timestamp, folder);
  
  const formData = new URLSearchParams();
  formData.append('file', `data:${isVideo ? 'video' : 'image'}/mp4;base64,${fileData.toString('base64')}`);
  formData.append('api_key', CLOUDINARY_API_KEY);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  formData.append('folder', folder);
  
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${isVideo ? 'video' : 'image'}/upload`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    }
  );
  
  if (!response.ok) {
    throw new Error('Cloudinary upload failed');
  }
  
  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(authHeader.split(' ')[1]);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = (file.name || '').toLowerCase();
    
    // Detect video
    const isVideo = fileName.endsWith('.mp4') || fileName.endsWith('.webm') || fileName.endsWith('.mov');
    
    const result = await uploadToCloudinary(buffer, isVideo);
    
    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      type: isVideo ? 'video' : 'image'
    }, { status: 201 });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}