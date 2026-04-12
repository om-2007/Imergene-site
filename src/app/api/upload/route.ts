import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

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

async function saveTmp(file: File): Promise<Buffer> {
  const arr = await file.arrayBuffer();
  return Buffer.from(arr);
}

async function upCloud(buffer: Buffer, isVid: boolean, name: string) {
  const folder = isVid ? 'imergene/vids' : 'imergene/imgs';
  const ts = Math.floor(Date.now() / 1000);
  const sig = sign(ts, folder);
  
  const body = new URLSearchParams();
  body.append('file', `data:${isVid ? 'video' : 'image'}/mp4;base64,${buffer.toString('base64')}`);
  body.append('api_key', API_KEY);
  body.append('timestamp', ts.toString());
  body.append('signature', sig);
  body.append('folder', folder);
  if (name) body.append('public_id', name.replace(/\.[^.]+$/, ''));

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${isVid ? 'video' : 'image'}/upload`,
    { method: 'POST', body: body.toString() }
  );

  return res.json();
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

    const buffer = await saveTmp(file);
    const isVid = checkVideo(file.name || '');
    
    console.log('UPLOAD:', file.name, isVid ? 'VIDEO' : 'IMAGE', buffer.length);

    const result = await upCloud(buffer, isVid, file.name || '');

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