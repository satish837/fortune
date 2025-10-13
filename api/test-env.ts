import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Check environment variables
    const envVars = {
      hasFalKey: !!process.env.FAL_KEY,
      hasCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
      hasCloudinaryApiKey: !!process.env.CLOUDINARY_API_KEY,
      hasCloudinaryApiSecret: !!process.env.CLOUDINARY_API_SECRET,
      hasUploadPreset: !!process.env.CLOUDINARY_UPLOAD_PRESET,
      hasClipdropApiKey: !!process.env.REMOVE_BG_API_KEY,
      // Show partial values for debugging (first 4 chars)
      falKeyPreview: process.env.FAL_KEY ? process.env.FAL_KEY.substring(0, 4) + '...' : 'Not set',
      cloudNamePreview: process.env.CLOUDINARY_CLOUD_NAME || 'Not set',
      uploadPresetPreview: process.env.CLOUDINARY_UPLOAD_PRESET || 'Not set'
    };

    res.json({ 
      message: "Environment variables check",
      environment: envVars,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in test-env API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
