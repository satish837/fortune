import type { VercelRequest, VercelResponse } from '@vercel/node';

// Constants
const FAL_FILES = "https://fal.run/v1/files";
const MODEL_URL = "https://fal.run/fal-ai/image-apps-v2/product-holding";
const FLUX_KONTEXT_URL = "https://fal.run/fal-ai/flux-pro/kontext";
const CLOUDINARY_BASE_URL = "https://api.cloudinary.com/v1_1";

// Helper functions
async function uploadToFal(fileBuffer: Buffer, filename: string, apiKey: string) {
  const form = new FormData();
  const blob = new Blob([fileBuffer as any]);
  form.append("file", blob, filename);
  
  console.log('Uploading to FAL endpoint:', FAL_FILES);
  console.log('File size:', fileBuffer.length, 'bytes');
  
  const res = await fetch(FAL_FILES, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
    },
    body: form,
  });
  
  console.log('FAL upload response status:', res.status);
  console.log('FAL upload response headers:', Object.fromEntries(res.headers.entries()));
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('FAL upload error response:', errorText);
    throw new Error(`FAL upload failed: ${res.status} - ${errorText}`);
  }
  
  const json = await res.json();
  console.log('FAL upload response JSON:', json);
  return json.url as string;
}

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

async function removeBackgroundWithCloudinary(imageUrl: string, cloudName: string, apiKey: string, apiSecret: string): Promise<string> {
  console.log("Cloudinary: Starting background removal...");
  console.log("Cloudinary: Input image URL:", imageUrl);
  
  // First, download the image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status}`);
  }
  const imageBuffer = await imageResponse.arrayBuffer();
  
  // Generate signature for Cloudinary upload
  const timestamp = Math.round(new Date().getTime() / 1000).toString();
  const transformation = 'e_background_removal';
  const message = `folder=diwali-postcards/background-removed&format=png&timestamp=${timestamp}&transformation=${transformation}${apiSecret}`;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Upload the image to Cloudinary
  const uploadUrl = `${CLOUDINARY_BASE_URL}/${cloudName}/image/upload`;
  const formData = new FormData();
  formData.append('file', new Blob([imageBuffer]), 'image.png');
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', 'diwali-postcards/background-removed');
  formData.append('transformation', transformation);
  formData.append('format', 'png');
  
  console.log("Cloudinary: Uploading image with background removal...");
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });
  
  console.log("Cloudinary: Upload response status:", response.status);
  
  if (!response.ok) {
    const error = await response.text();
    console.error("Cloudinary: Error response:", error);
    throw new Error(`Cloudinary background removal failed: ${response.status} - ${error}`);
  }
  
  const result = await response.json();
  console.log("Cloudinary: Background removal successful, result URL:", result.secure_url);
  return result.secure_url;
}

async function applyFluxKontextTransformation(imageUrl: string, apiKey: string): Promise<string> {
  const prompt = "Convert this person image to a polished digital illustration art style. Use a cartoonish character design with smooth lines, subtle gradients for shading, and a warm Indian Diwali color palette (yellows, oranges, browns). Transform the person's clothing to traditional Indian ethnic wear - for men: kurta with pajama or dhoti, for women: saree, lehenga, or salwar kameez. Add traditional Indian jewelry like bangles, earrings, and necklaces. Style the hair in traditional Indian fashion. Use vibrant Indian colors like deep reds, golds, maroons, and rich fabrics. DO NOT add any new background - keep the original background exactly as it is. DO NOT change, modify, or replace the background in any way. Preserve the original background completely unchanged. IMPORTANT: Do not modify or change the dish/food item in any way - keep it exactly as it appears in the original image with the same colors, shape, and details.";
  
  const payload = {
    prompt: prompt,
    image_url: imageUrl,
    guidance_scale: 7.5,
    num_inference_steps: 20,
    seed: Math.floor(Math.random() * 1000000),
  };
  
  const response = await fetch(FLUX_KONTEXT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FLUX Kontext API failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const result = await response.json();
  if (result.images && result.images.length > 0) {
    return result.images[0].url;
  } else {
    throw new Error("FLUX Kontext did not return any images");
  }
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
    console.log('Generate API called with body:', JSON.stringify(req.body, null, 2));
    
    // Get environment variables
    const apiKey = process.env.FAL_KEY;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
    const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    const clipdropApiKey = process.env.REMOVE_BG_API_KEY;

    // Debug environment variables
    console.log('Environment variables check:', {
      hasFalKey: !!apiKey,
      hasCloudName: !!cloudName,
      hasCloudinaryApiKey: !!cloudinaryApiKey,
      hasCloudinaryApiSecret: !!cloudinaryApiSecret,
      hasUploadPreset: !!uploadPreset,
      hasClipdropApiKey: !!clipdropApiKey
    });

    if (!apiKey) {
      console.error('FAL_KEY environment variable not set');
      res.status(500).json({ error: 'FAL_KEY environment variable not set' });
      return;
    }

    if (!cloudName || !cloudinaryApiKey || !cloudinaryApiSecret || !uploadPreset) {
      console.error('Cloudinary environment variables not set');
      res.status(500).json({ error: 'Cloudinary environment variables not set' });
      return;
    }

    // Get request data
    const { personImageUrl, personImageBase64, dishImageUrl, background, greeting } = req.body;

    console.log('Request data:', { 
      hasPersonImageUrl: !!personImageUrl,
      hasPersonImageBase64: !!personImageBase64, 
      hasDishImage: !!dishImageUrl, 
      background, 
      greeting 
    });

    if ((!personImageUrl && !personImageBase64) || !dishImageUrl) {
      console.error('Missing required fields:', { 
        personImageUrl: !!personImageUrl,
        personImageBase64: !!personImageBase64, 
        dishImageUrl: !!dishImageUrl 
      });
      res.status(400).json({ error: 'personImageUrl (or personImageBase64) and dishImageUrl are required' });
      return;
    }

    // Handle person image - either from URL or base64
    let finalPersonImageUrl: string;
    
    if (personImageUrl) {
      // Use the provided URL directly
      console.log('Using provided person image URL:', personImageUrl);
      finalPersonImageUrl = personImageUrl;
    } else {
      // Convert base64 to buffer and upload
    console.log('Converting base64 to buffer...');
    const personImageBuffer = Buffer.from(personImageBase64.split(',')[1], 'base64');
    console.log('Buffer created, size:', personImageBuffer.length);
    
      // Basic image validation
      if (personImageBuffer.length < 1000) {
        console.error('Image too small, size:', personImageBuffer.length);
        res.status(400).json({ error: 'Image file is too small or corrupted' });
        return;
      }
      
      if (personImageBuffer.length > 10 * 1024 * 1024) { // 10MB limit
        console.error('Image too large, size:', personImageBuffer.length);
        res.status(400).json({ error: 'Image file is too large (max 10MB)' });
        return;
      }
      
      // Upload person image to Cloudinary
    console.log('Uploading person image to Cloudinary...');
      finalPersonImageUrl = await uploadToCloudinaryFromBuffer(personImageBuffer, cloudName, cloudinaryApiKey, cloudinaryApiSecret, uploadPreset);
      console.log('Cloudinary upload successful, URL:', finalPersonImageUrl);
    }
    
    // Convert dish image path to full URL if it's a local path
    let productImageUrl = dishImageUrl;
    if (dishImageUrl.startsWith('/dish/')) {
      productImageUrl = `https://fortune-image-generator-g4ngv2rwq-social-beat.vercel.app${dishImageUrl}`;
    }

    // FAL AI generation - Simple and focused prompt
    const baseInstruction = `Place the dish image into the person's hands. Make the dish smaller and position it below the face level. Keep the person's face fully visible and clear. Maintain the original background.`;

    const payload = {
      person_image_url: finalPersonImageUrl,
      product_image_url: productImageUrl,
      prompt: baseInstruction,
      negative_prompt: "cropped face, face cut off, partial face, blurry, low quality, distorted, extra hands, multiple people, extra limbs, deformed hands, bad anatomy, extra fingers, missing fingers, extra arms, missing arms, extra legs, missing legs, malformed limbs, disfigured, bad proportions, extra heads, missing head, extra body parts, missing body parts, duplicate, crowd, group of people, other people, strangers, unknown people, random people, background people, people in background, additional people, extra people, more people, too many people, crowded, cluttered, busy, messy, disorganized, chaotic, confusing, unclear, ambiguous, uncertain, vague, indistinct, blurry, out of focus, low resolution, pixelated, grainy, noisy, artifacts, compression artifacts, jpeg artifacts, quality issues, technical issues, rendering issues, generation issues, AI artifacts, machine artifacts, computer generated artifacts, synthetic artifacts, fake, artificial, unnatural, unrealistic, impossible, illogical, nonsensical, absurd, ridiculous, silly, stupid, foolish, idiotic, moronic, asinine, inane, pointless, useless, worthless, meaningless, empty, void, nothing, blank, white, black, solid color, monochrome, single color, no color, colorless, drab, dull, boring, uninteresting, plain, simple, basic, elementary, primitive, crude, rough, unrefined, unfinished, incomplete, partial, half, quarter, third, fraction, piece, part, segment, section, portion, bit, chunk, slice, fragment, shard, splinter, chip, flake, particle, atom, molecule, cell, unit, component, element, ingredient, constituent, modified dish, changed dish, altered dish, transformed dish, different dish, wrong dish, incorrect dish, dish modification, dish alteration, dish transformation, dish style change, dish color change, dish shape change, new background, added background, changed background, modified background, different background, background change, background modification, background addition, extra background, additional background, background replacement, background substitution",
      strength: 0.001,
      guidance_scale: 30.0,
      num_inference_steps: 300,
      seed: Math.floor(Math.random() * 1000000),
      enable_safety_checker: true,
      scheduler: "EulerDiscreteScheduler",
      controlnet_conditioning_scale: 1.0,
      control_guidance_start: 0.0,
      control_guidance_end: 1.0,
    };

    console.log("Calling FAL AI with payload:", JSON.stringify(payload, null, 2));

    // Add timeout for FAL AI call (120 seconds)
    const falPromise = fetch(MODEL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    
    const falTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('FAL AI timeout')), 120000)
    );
    
    const falResponse = await Promise.race([falPromise, falTimeoutPromise]) as Response;

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error("FAL AI API error:", errorText);
      console.error("FAL AI API error details:", {
        status: falResponse.status,
        statusText: falResponse.statusText,
        headers: Object.fromEntries(falResponse.headers.entries()),
        body: errorText
      });
      
      // Handle specific error cases
      if (falResponse.status === 422) {
        res.status(422).json({ 
          error: 'Content policy violation - please try with a different image or contact support',
          details: errorText,
          type: 'content_policy_violation'
        });
        return;
      }
      
      res.status(500).json({ error: `FAL AI API failed: ${falResponse.status} ${falResponse.statusText} - ${errorText}` });
      return;
    }

    const falResult = await falResponse.json();
    console.log("FAL AI response:", JSON.stringify(falResult, null, 2));

    if (!falResult.images || falResult.images.length === 0) {
      res.status(500).json({ error: "FAL AI did not return any images" });
      return;
    }

    const imageUrl = falResult.images[0].url;
    console.log("FAL AI generated image URL:", imageUrl);

    // Apply FLUX Kontext transformation
    let fluxKontextImageUrl: string;
    let fluxKontextSuccess = false;
    
    try {
      console.log("Applying FLUX Kontext transformation...");
      
      // Add timeout for FLUX Kontext (60 seconds)
      const fluxPromise = applyFluxKontextTransformation(imageUrl, apiKey);
      const fluxTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('FLUX Kontext timeout')), 60000)
      );
      
      const fluxKontextUrl = await Promise.race([fluxPromise, fluxTimeoutPromise]) as string;
      fluxKontextImageUrl = fluxKontextUrl;
      fluxKontextSuccess = true;
      console.log("FLUX Kontext transformation successful:", fluxKontextImageUrl);
    } catch (fluxKontextError) {
      console.error("FLUX Kontext transformation failed:", fluxKontextError);
      console.warn("FLUX Kontext transformation failed, using original image");
      fluxKontextImageUrl = imageUrl;
      fluxKontextSuccess = false;
    }

    // Process with Cloudinary for background removal
    let finalImageUrl: string;
    let backgroundRemoved = false;
    
    console.log("Cloudinary credentials available:", !!cloudName && !!cloudinaryApiKey && !!cloudinaryApiSecret);
    
    if (cloudName && cloudinaryApiKey && cloudinaryApiSecret) {
      try {
        console.log("Processing with Cloudinary for background removal...");
        console.log("FLUX Kontext image URL:", fluxKontextImageUrl);
        
        console.log("Calling Cloudinary API for background removal...");
        
        // Add timeout for background removal (30 seconds)
        const backgroundRemovalPromise = removeBackgroundWithCloudinary(fluxKontextImageUrl, cloudName, cloudinaryApiKey, cloudinaryApiSecret);
        const timeoutPromise = new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Background removal timeout')), 30000)
        );
        
        finalImageUrl = await Promise.race([backgroundRemovalPromise, timeoutPromise]);
        backgroundRemoved = true;
        console.log("Cloudinary background removal successful:", finalImageUrl);
      } catch (cloudinaryError) {
        console.error("Cloudinary background removal failed:", cloudinaryError);
        console.warn("Background removal failed, using FLUX Kontext image");
        finalImageUrl = fluxKontextImageUrl;
        backgroundRemoved = false;
      }
    } else {
      console.warn("Cloudinary credentials not set, skipping background removal");
      finalImageUrl = fluxKontextImageUrl;
      backgroundRemoved = false;
    }

    res.json({ 
      image_url: finalImageUrl, 
      original_image_url: imageUrl,
      flux_kontext_image_url: fluxKontextImageUrl,
      background_removed_image_url: backgroundRemoved ? finalImageUrl : null,
      background_video: background ? `/background/${background}.mp4` : null,
      meta: falResult,
      background_removed: backgroundRemoved,
      flux_kontext_transformed: fluxKontextSuccess,
      illustration_style: fluxKontextSuccess ? "digital_illustration_diwali" : "original"
    });

  } catch (error) {
    console.error('Error in generate API:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
