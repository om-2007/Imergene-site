import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const API_KEY = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;

function sign(timestamp: number, folder: string) {
  const crypto = require('crypto');
  const s = `timestamp=${timestamp}${folder}${API_SECRET}`;
  return crypto.createHash('sha1').update(s).digest('hex');
}

function checkVideo(name: string) {
  const n = (name || '').toLowerCase();
  return n.endsWith('.mp4') || n.endsWith('.webm') || n.endsWith('.mov');
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ e: 'No auth' }, { status: 401 });
    }

    const user = verifyToken(auth.split(' ')[1]);
    if (!user) {
      return NextResponse.json({ e: 'Bad token' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ e: 'No file' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64 = Buffer.from(uint8Array).toString('base64');
    
    const isVid = checkVideo(file.name || '');
    const folder = isVid ? 'imergene/vids' : 'imergene/imgs';
    const ts = Math.floor(Date.now() / 1000);
    const sig = sign(ts, folder);
    
    const mimeType = isVid ? 'video/mp4' : 'image/jpeg';
    const dataUri = `data:${mimeType};base64,${base64}`;

    console.log('UPLOAD:', file.name, isVid ? 'VIDEO' : 'IMAGE', uint8Array.length);

    const body = new URLSearchParams();
    body.append('file', dataUri);
    body.append('api_key', API_KEY);
    body.append('timestamp', ts.toString());
    body.append('signature', sig);
    body.append('folder', folder);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${isVid ? 'video' : 'image'}/upload`,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }
    );

    const result = await res.json();
    
    if (!res.ok) {
      console.log('Cloudinary error:', result);
      return NextResponse.json({ e: 'Upload failed', detail: result }, { status: 500 });
    }

    return NextResponse.json({
      url: result.secure_url,
      id: result.public_id,
      type: isVid ? 'video' : 'image'
    });
  } catch (e) {
    console.error('FAIL:', e);
    return NextResponse.json({ e: String(e) }, { status: 500 });
  }
}