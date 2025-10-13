import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName) {
      return res.status(500).json({ error: 'Cloudinary cloud name not configured' });
    }

    res.status(200).json({
      cloudName,
      uploadPreset: uploadPreset || 'ml_default',
      apiKey: process.env.CLOUDINARY_API_KEY,
      hasApiKey: !!process.env.CLOUDINARY_API_KEY,
      hasApiSecret: !!process.env.CLOUDINARY_API_SECRET
    });
  } catch (error) {
    console.error('Error getting Cloudinary config:', error);
    res.status(500).json({ error: 'Failed to get Cloudinary configuration' });
  }
}
