import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Cloudinary configuration missing' });
    }

    // Get the video file from the request
    const videoFile = req.body.video;
    if (!videoFile) {
      return res.status(400).json({ error: 'Video file is required' });
    }

    // Generate signature for signed upload
    const timestamp = Math.round(new Date().getTime() / 1000);
    const publicId = `diwali-postcards/videos/festive-postcard-${timestamp}`;
    
    const params = {
      public_id: publicId,
      folder: 'diwali-postcards/videos',
      resource_type: 'video',
      timestamp: timestamp
    };

    // Create signature
    const signatureString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&') + apiSecret;

    const signature = crypto
      .createHash('sha1')
      .update(signatureString)
      .digest('hex');

    // Upload to Cloudinary using fetch
    const formData = new FormData();
    formData.append('file', videoFile, 'festive-postcard-video.mp4');
    formData.append('public_id', publicId);
    formData.append('folder', 'diwali-postcards/videos');
    formData.append('resource_type', 'video');
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);

    console.log('📤 Uploading to Cloudinary with signed upload...');
    console.log('🔧 Upload params:', { publicId, folder: 'diwali-postcards/videos', timestamp });

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    console.log('📡 Cloudinary response status:', uploadResponse.status);

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ Cloudinary upload failed:', errorText);
      return res.status(500).json({ 
        error: 'Cloudinary upload failed', 
        details: errorText 
      });
    }

    const uploadData = await uploadResponse.json();
    console.log('✅ Video uploaded successfully:', uploadData.secure_url);

    // Create WhatsApp-optimized MP4 URL
    const optimizedUrl = `https://res.cloudinary.com/${cloudName}/video/upload/f_mp4,q_auto:best,w_512,h_512,c_fill,ac_mp4,vc_h264,fl_progressive,br_200k/${uploadData.public_id}.mp4`;

    res.status(200).json({
      success: true,
      secure_url: optimizedUrl,
      publicId: uploadData.public_id,
      originalUrl: uploadData.secure_url
    });

  } catch (error) {
    console.error('❌ Error uploading video:', error);
    res.status(500).json({ 
      error: 'Failed to upload video',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
