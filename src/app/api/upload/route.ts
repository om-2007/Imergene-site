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
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = (file.name || '').toLowerCase();
    const fileType = (file.type || '').toLowerCase();
    
    // Detect if video by name or type
    const isVideo = fileType.startsWith('video/') || 
      /\.(mp4|webm|mov|m4v|avi)$/.test(fileName);
    
    // Otherwise treat as image
    const isImage = !isVideo;
    
    console.log('[Upload] File:', fileName, 'Type:', fileType, 'IsVideo:', isVideo);

    let result;
    if (isVideo) {
      result = await uploadVideo(file.name ? Buffer.from(await file.arrayBuffer()) : Buffer.from(await file.arrayBuffer()), { 
        folder: 'imergene/videos' 
      });
    } else {
      result = await uploadImage(file.name ? Buffer.from(await file.arrayBuffer()) : Buffer.from(await file.arrayBuffer()), { 
        folder: 'imergene/posts' 
      });
    }

    return NextResponse.json({ 
      url: result.secureUrl, 
      publicId: result.publicId,
      type: isVideo ? 'video' : 'image'
    }, { status: 201 });
  } catch (err) {
    console.error('[Upload] Error:', err);
    return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
  }
}