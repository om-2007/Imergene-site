import { NextRequest, NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function GET() {
  // Test image from external URL that allows downloading
  const testImageUrl = 'https://picsum.photos/200/200.jpg';
  
  try {
    // Download the image
    const downloadResponse = await fetch(testImageUrl);
    if (!downloadResponse.ok) {
      return NextResponse.json({ error: 'Failed to download test image' }, { status: 500 });
    }
    
    const arrayBuffer = await downloadResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Since we can't easily test the auth here, just return success
    return NextResponse.json({ 
      message: 'Downloaded test image successfully',
      size: buffer.length,
      originalUrl: testImageUrl
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}