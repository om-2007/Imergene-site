import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const API_KEY = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;

function sign(timestamp: number, folder: string, publicId?: string) {
  const crypto = require('crypto');
  // Cloudinary requires alphabetical order of parameter names
  const params = [
    `folder=${folder}`,
    `timestamp=${timestamp}`
  ];
  if (publicId) params.push(`public_id=${publicId}`);
  // Sort by parameter name
  params.sort((a, b) => a.localeCompare(b));
  const toSign = params.join('&') + API_SECRET;
  return crypto.createHash('sha1').update(toSign, 'utf8').digest('hex');
}

function isVideo(name: string): boolean {
  const n = (name || '').toLowerCase();
  return /\.(mp4|webm|mov|m4v|avi)$/.test(n);
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(auth.split(' ')[1]);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = (file.name || '').toLowerCase();
    const isVid = isVideo(fileName);
    
    const ts = Math.floor(Date.now() / 1000);
    const folder = isVid ? 'imergene/videos' : 'imergene/posts';
    const publicId = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_') || undefined;
    const sig = sign(ts, folder, publicId);
    
    const form = new URLSearchParams();
    form.append('file', `data:${isVid ? 'video' : 'image'}/mp4;base64,${buffer.toString('base64')}`);
    form.append('api_key', API_KEY);
    form.append('timestamp', ts.toString());
    form.append('signature', sig);
    form.append('folder', folder);
    if (publicId) form.append('public_id', publicId);

    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${isVid ? 'video' : 'image'}/upload`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      }
    );

    if (!cloudRes.ok) {
      const errorText = await cloudRes.text();
      console.error('Cloudinary error:', cloudRes.status, errorText);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const result = await cloudRes.json();
    
    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      type: isVid ? 'video' : 'image'
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}