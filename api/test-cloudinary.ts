import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check environment variables
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    const reactAppCloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    const reactAppUploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

    // Test Cloudinary API access
    let cloudinaryTest = 'Not tested';
    if (cloudName && apiKey && apiSecret) {
      try {
        const testUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?max_results=1`;
        const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
        
        const response = await fetch(testUrl, {
          headers: {
            'Authorization': `Basic ${auth}`
          }
        });
        
        if (response.ok) {
          cloudinaryTest = '✅ Working';
        } else {
          cloudinaryTest = `❌ Failed: ${response.status}`;
        }
      } catch (error) {
        cloudinaryTest = `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    } else {
      cloudinaryTest = '❌ Missing credentials';
    }

    res.status(200).json({
      success: true,
      environment: {
        // Server-side environment variables
        hasCloudName: !!cloudName,
        hasApiKey: !!apiKey,
        hasApiSecret: !!apiSecret,
        hasUploadPreset: !!uploadPreset,
        cloudNamePreview: cloudName || 'Not set',
        uploadPresetPreview: uploadPreset || 'Not set',
        
        // React app environment variables
        hasReactAppCloudName: !!reactAppCloudName,
        hasReactAppUploadPreset: !!reactAppUploadPreset,
        reactAppCloudNamePreview: reactAppCloudName || 'Not set',
        reactAppUploadPresetPreview: reactAppUploadPreset || 'Not set',
      },
      cloudinaryTest,
      uploadUrl: cloudName ? `https://api.cloudinary.com/v1_1/${cloudName}/video/upload` : 'Not configured'
    });

  } catch (error) {
    console.error('Error testing Cloudinary:', error);
    res.status(500).json({ 
      error: 'Failed to test Cloudinary configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
