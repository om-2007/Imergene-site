import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

// Simple auth check - in production you'd want to add proper authentication
async function verifyAdminRequest(req: NextRequest) {
  // For development, we'll check a simple header
  // In production, you should implement proper authentication
  const adminSecret = req.headers.get('x-admin-secret');
  return adminSecret === process.env.CRON_SECRET; // Using existing CRON_SECRET for simplicity
}

export async function POST(req: NextRequest) {
  try {
    // Verify admin access
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { presetName = 'imergene_uploads' } = await req.json();

     // Create unsigned upload preset with security restrictions
     const preset = await cloudinary.api.create_upload_preset({
      name: presetName,
      unsigned: true,
      allowed_formats: 'jpg,png,gif,webp,mp4,webm,mov', // Restrict file types
      max_file_size: 104857600, // 100MB in bytes
      disallow_public_id: true, // Prevent users from specifying public IDs
      folder: 'imergene/posts', // Default folder
      // Add transformation to optimize images
      transformation: [
        { quality: 'auto', fetch_format: 'auto' } // Auto quality and format
      ]
    });

    return NextResponse.json({ 
      success: true, 
      preset: preset,
      message: `Upload preset '${presetName}' created successfully`
    });
  } catch (error: any) {
    console.error('Error creating upload preset:', error);
    return NextResponse.json({ 
      error: 'Failed to create upload preset',
      details: error.message
    }, { status: 500 });
  }
}

// Allow GET to list presets
export async function GET(req: NextRequest) {
  try {
    // Verify admin access
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

     const presets = await cloudinary.api.upload_presets();
    return NextResponse.json({ presets });
  } catch (error: any) {
    console.error('Error fetching upload presets:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch upload presets',
      details: error.message
    }, { status: 500 });
  }
}