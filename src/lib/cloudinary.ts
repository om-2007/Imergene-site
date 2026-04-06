export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  width?: number;
  height?: number;
  bytes: number;
  duration?: number;
}

export interface CloudinaryDeleteResult {
  result: string;
}

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';

function getAuthHeader(): string {
  const auth = `${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`;
  return Buffer.from(auth).toString('base64');
}

export async function uploadImage(
  file: Buffer | string,
  options: {
    folder?: string;
    publicId?: string;
    transformation?: string;
  } = {}
): Promise<CloudinaryUploadResult> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary not configured');
  }

  const formData = new URLSearchParams();
  
  if (typeof file === 'string') {
    formData.append('file', file);
  } else {
    formData.append('file', `data:image/jpeg;base64,${file.toString('base64')}`);
  }
  
  formData.append('upload_preset', 'imergene_uploads');
  
  if (options.folder) {
    formData.append('folder', options.folder);
  }
  
  if (options.publicId) {
    formData.append('public_id', options.publicId);
  }

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Upload failed');
    }

    const data = await response.json();
    
    return {
      publicId: data.public_id,
      url: data.url,
      secureUrl: data.secure_url,
      format: data.format,
      width: data.width,
      height: data.height,
      bytes: data.bytes,
    };
  } catch (error) {
    console.error('Cloudinary uploadImage error:', error);
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function uploadVideo(
  file: Buffer | string,
  options: {
    folder?: string;
    publicId?: string;
    resourceType?: 'video' | 'raw' | 'auto';
  } = {}
): Promise<CloudinaryUploadResult> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary not configured');
  }

  const formData = new URLSearchParams();
  
  if (typeof file === 'string') {
    formData.append('file', file);
  } else {
    formData.append('file', `data:video/mp4;base64,${file.toString('base64')}`);
  }
  
  formData.append('upload_preset', 'imergene_videos');
  
  if (options.folder) {
    formData.append('folder', options.folder);
  }
  
  if (options.publicId) {
    formData.append('public_id', options.publicId);
  }

  const resourceType = options.resourceType || 'video';

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Upload failed');
    }

    const data = await response.json();
    
    return {
      publicId: data.public_id,
      url: data.url,
      secureUrl: data.secure_url,
      format: data.format,
      width: data.width,
      height: data.height,
      bytes: data.bytes,
      duration: data.duration,
    };
  } catch (error) {
    console.error('Cloudinary uploadVideo error:', error);
    throw new Error(`Failed to upload video: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deleteMedia(publicId: string): Promise<CloudinaryDeleteResult> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary not configured');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await generateSignature(publicId, timestamp);

  const formData = new URLSearchParams();
  formData.append('public_id', publicId);
  formData.append('timestamp', timestamp.toString());
  formData.append('api_key', CLOUDINARY_API_KEY);
  formData.append('signature', signature);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Delete failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Cloudinary deleteMedia error:', error);
    throw new Error(`Failed to delete media: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function generateSignature(publicId: string, timestamp: number): Promise<string> {
  const crypto = await import('crypto');
  const signString = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  return crypto.createHash('sha1').update(signString).digest('hex');
}

export async function getMediaMetadata(publicId: string) {
  if (!CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary not configured');
  }

  try {
    const response = await fetch(
      `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${publicId}.json`
    );

    if (!response.ok) {
      throw new Error('Failed to get metadata');
    }

    return await response.json();
  } catch (error) {
    console.error('Cloudinary getMediaMetadata error:', error);
    throw error;
  }
}