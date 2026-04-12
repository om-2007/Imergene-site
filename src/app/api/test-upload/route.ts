import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export const maxDuration = 300; // 5 minutes
export const revalidate = 0;

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

    // Log request details
    console.log('Test upload endpoint hit');
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    
    // Check content type
    const contentType = req.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    // Try to get body size
    const clone = req.clone();
    const text = await clone.text();
    console.log('Body length:', text.length);
    console.log('Body preview:', text.substring(0, 200));
    
    // Try parsing as form data
    try {
      const formData = await req.formData();
      console.log('FormData keys:', Array.from(formData.keys()));
      const file = formData.get('file');
      console.log('File object:', file);
      if (file instanceof File) {
        console.log('File name:', file.name);
        console.log('File size:', file.size);
        console.log('File type:', file.type);
      }
      
      return NextResponse.json({ 
        success: true, 
        fileName: file?.name || 'no-file',
        fileSize: file?.size || 0,
        fileType: file?.type || 'unknown'
      });
    } catch (formError) {
      console.error('FormData parsing error:', formError);
      return NextResponse.json({ 
        error: 'FormData parsing failed', 
        details: formError.message 
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Test upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}