import type { VercelRequest, VercelResponse } from '@vercel/node';

// Helper functions (copied from generate.ts)
const CLOUDINARY_BASE_URL = "https://api.cloudinary.com/v1_1";

async function uploadToCloudinaryFromBuffer(imageBuffer: Buffer, cloudName: string, apiKey: string, apiSecret: string, uploadPreset: string) {
  const url = `${CLOUDINARY_BASE_URL}/${cloudName}/image/upload`;
  const form = new FormData();
  form.append("file", new Blob([imageBuffer as any]), "image.png");
  form.append("api_key", apiKey);
  const timestamp = Math.round(new Date().getTime() / 1000).toString();
  form.append("timestamp", timestamp);
  
  // Generate signature for signed upload using Web Crypto API
  const message = `timestamp=${timestamp}${apiSecret}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  form.append("signature", signature);
  
  console.log('Uploading to Cloudinary with signed upload...');
  
  const res = await fetch(url, { 
    method: "POST", 
    body: form as any 
  });
  
  console.log('Cloudinary response status:', res.status);
  
  if (!res.ok) {
    const error = await res.json();
    console.error('Cloudinary error:', error);
    throw new Error(error?.error?.message || `Cloudinary ${res.status}`);
  }
  
  const json = await res.json();
  console.log('Cloudinary upload successful:', json.secure_url);
  return json.secure_url || json.url;
}

async function downloadImageAsBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function removeBackgroundWithClipdrop(imageBuffer: Buffer, apiKey: string): Promise<ArrayBuffer> {
  console.log("Clipdrop: Starting background removal...");
  console.log("Clipdrop: Input image size:", imageBuffer.length, "bytes");
  
  const formData = new FormData();
  const blob = new Blob([imageBuffer as any]);
  formData.append("image_file", blob, "image.jpg");
  
  console.log("Clipdrop: Calling API endpoint...");
  const response = await fetch("https://clipdrop-api.co/remove-background/v1", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
    },
    body: formData,
  });
  
  console.log("Clipdrop: Response status:", response.status);
  console.log("Clipdrop: Response headers:", Object.fromEntries(response.headers.entries()));
  
  if (!response.ok) {
    const error = await response.text();
    console.error("Clipdrop: Error response:", error);
    throw new Error(`Clipdrop API failed: ${response.status} ${response.statusText} - ${error}`);
  }
  
  const result = await response.arrayBuffer();
  console.log("Clipdrop: Background removal successful, result size:", result.byteLength, "bytes");
  return result;
}

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

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    console.log('Test background removal API called');
    
    // Get environment variables
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
    const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    const clipdropApiKey = process.env.REMOVE_BG_API_KEY;

    console.log('Environment variables check:', {
      hasCloudName: !!cloudName,
      hasCloudinaryApiKey: !!cloudinaryApiKey,
      hasCloudinaryApiSecret: !!cloudinaryApiSecret,
      hasUploadPreset: !!uploadPreset,
      hasClipdropApiKey: !!clipdropApiKey,
      clipdropApiKeyPreview: clipdropApiKey ? clipdropApiKey.substring(0, 8) + '...' : 'Not set'
    });

    if (!cloudName || !cloudinaryApiKey || !cloudinaryApiSecret || !uploadPreset) {
      res.status(500).json({ error: 'Cloudinary environment variables not set' });
      return;
    }

    if (!clipdropApiKey) {
      res.status(500).json({ error: 'Clipdrop API key not set' });
      return;
    }

    // Get request data
    const { imageUrl } = req.body;

    if (!imageUrl) {
      res.status(400).json({ error: 'imageUrl is required' });
      return;
    }

    console.log('Testing background removal for image:', imageUrl);

    // Download the image
    console.log('Downloading image...');
    const imageBuffer = await downloadImageAsBuffer(imageUrl);
    console.log('Image downloaded, size:', imageBuffer.length, 'bytes');

    // Remove background
    console.log('Removing background...');
    const backgroundRemovedBuffer = await removeBackgroundWithClipdrop(imageBuffer, clipdropApiKey);
    console.log('Background removed, result size:', backgroundRemovedBuffer.byteLength, 'bytes');

    // Upload result
    console.log('Uploading result...');
    const finalImageUrl = await uploadToCloudinaryFromBuffer(Buffer.from(backgroundRemovedBuffer), cloudName, cloudinaryApiKey, cloudinaryApiSecret, uploadPreset);

    res.json({ 
      success: true,
      original_image_url: imageUrl,
      background_removed_image_url: finalImageUrl,
      message: "Background removal test completed successfully"
    });

  } catch (error) {
    console.error('Error in test background removal API:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
