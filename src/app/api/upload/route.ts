import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const API_KEY = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;

export const maxDuration = 300; // 5 minutes
export const revalidate = 0;

// Increase body size limit to 500MB for file uploads
export const api = {
  bodyParser: {
    sizeLimit: '500mb',
  },
};

function buildSignature(params: Record<string, string>): string {
  // Sort keys alphabetically
  const sortedKeys = Object.keys(params).sort();
  // Build string: key1=value1&key2=value2...&API_SECRET
  const queryString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
  const toSign = queryString + API_SECRET;
  const crypto = require('crypto');
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
    
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = isVid ? 'imergene/videos' : 'imergene/posts';
    const publicId = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_') || undefined;
    
    // Build signature params - Cloudinary requires these specific params for signature
    const signatureParams: Record<string, string> = {
      folder,
      timestamp: timestamp.toString()
    };
    if (publicId) signatureParams.public_id = publicId;
    
    const signature = buildSignature(signatureParams);
    
    // Prepare form data for Cloudinary upload
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', API_KEY);
    form.append('timestamp', timestamp.toString());
    form.append('signature', signature);
    form.append('folder', folder);
    if (publicId) form.append('public_id', publicId);
    // Critical: resource_type tells Cloudinary how to process the file
    form.append('resource_type', isVid ? 'video' : 'image');

    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${isVid ? 'video' : 'image'}/upload`,
      {
        method: 'POST',
        body: form,
        // Don't set Content-Type header - let browser set it for FormData
      }
    );

    if (!cloudRes.ok) {
      const errorText = await cloudRes.text();
      console.error('Cloudinary error:', cloudRes.status, errorText);
      return NextResponse.json({ error: 'Upload failed: ' + errorText }, { status: 500 });
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