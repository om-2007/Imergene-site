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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const isVideo = file.type.startsWith('video');

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
