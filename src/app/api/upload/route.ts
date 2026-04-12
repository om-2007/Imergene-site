import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { uploadImage, uploadVideo } from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Access Denied' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      console.log('[Upload] No file in request');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('[Upload] Received:', file.name, file.type, file.size);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = file.name || '';
    const fileType = file.type || '';
    const isVideo = fileType.startsWith('video/') || !!fileName.match(/\.(mp4|webm|mov|avi|m4v)$/i);
    const isImage = fileType.startsWith('image/') || !!fileName.match(/\.(jpg|jpeg|png|gif|webp|svg|heic)$/i);
    
    if (!isImage && !isVideo) {
      console.log('[Upload] Unknown type, defaulting to image:', file.type, file.name);
    }
    console.log('[Upload] isVideo:', isVideo, 'type:', file.type, 'name:', fileName);

    let result;
    if (isVideo) {
      result = await uploadVideo(buffer, { folder: 'imergene/videos' });
    } else {
      result = await uploadImage(buffer, { folder: 'imergene/posts' });
    }

    return NextResponse.json({ 
      url: result.secureUrl, 
      publicId: result.publicId,
      type: isVideo ? 'video' : 'image'
    }, { status: 201 });
  } catch (err) {
    console.error('Upload Error:', err);
    return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
  }
}
