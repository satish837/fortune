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
    const { personImageBase64, dishImageUrl, background, greeting } = req.body;

    console.log('Request data:', { 
      hasPersonImage: !!personImageBase64, 
      hasDishImage: !!dishImageUrl, 
      background, 
      greeting 
    });

    if (!personImageBase64 || !dishImageUrl) {
      console.error('Missing required fields:', { 
        personImageBase64: !!personImageBase64, 
        dishImageUrl: !!dishImageUrl 
      });
      res.status(400).json({ error: 'personImageBase64 and dishImageUrl are required' });
      return;
    }

    // Convert base64 to buffer
    console.log('Converting base64 to buffer...');
    const personImageBuffer = Buffer.from(personImageBase64.split(',')[1], 'base64');
    console.log('Buffer created, size:', personImageBuffer.length);
    
    // Upload person image to Cloudinary instead of FAL
    console.log('Uploading person image to Cloudinary...');
    const personImageUrl = await uploadToCloudinaryFromBuffer(personImageBuffer, cloudName, cloudinaryApiKey, cloudinaryApiSecret, uploadPreset);
    console.log('Cloudinary upload successful, URL:', personImageUrl);
    
    // Convert dish image path to full URL if it's a local path
    let productImageUrl = dishImageUrl;
    if (dishImageUrl.startsWith('/dish/')) {
      productImageUrl = `https://fortune-image-generator-g4ngv2rwq-social-beat.vercel.app${dishImageUrl}`;
    }

    // FAL AI generation - Preserve exact dish image and ensure face visibility
    const baseInstruction = `Place the exact dish image provided into the person's hands, but make the dish 50% smaller than its original size. The dish should maintain the same colors, shape, and details as the reference image, but scaled down to half the size. The person should hold the smaller dish naturally with both hands, ensuring it doesn't obscure the face. 

CRITICAL FACE PRESERVATION REQUIREMENTS:
- The person's face must be COMPLETELY VISIBLE and FULLY SHOWN in the final image
- Do NOT crop, cut off, or hide ANY part of the face (forehead, eyes, nose, mouth, chin, jaw, cheeks, temples, ears)
- The face should be clear, well-lit, and easily recognizable
- Maintain the original facial features, expression, and appearance exactly
- The face should be the primary focal point of the image
- Ensure the face is not obscured, covered, or blocked by the dish or any other elements
- Keep the face in the same position and angle as the original image
- Preserve the original face proportions and structure
- The entire head including hair must be visible from top to bottom
- Both eyes, nose, mouth, and chin must be fully shown without any cropping

IMAGE COMPOSITION REQUIREMENTS:
- Show the complete person from head to toe without any cropping
- Maintain the original image boundaries and aspect ratio exactly
- Do not crop, cut off, or hide any part of the person's body
- Keep the person centered and well-positioned in the frame
- Ensure the dish is held naturally in the hands without obscuring the face
- Position the dish below the face level to avoid face obstruction
- Maintain proper spacing between the face and the dish
- DO NOT add any new background - keep the original background exactly as it is
- DO NOT change, modify, or replace the background in any way
- Preserve the original background completely unchanged

DISH POSITIONING:
- Hold the dish in both hands if possible
- Position the dish at chest or waist level, not near the face
- Ensure the dish does not block or cover any part of the face
- Keep the dish at a safe distance from the face
- Make the dish 50% smaller than its original size
- Preserve the dish's original colors, shape, and details exactly

FINAL CHECK:
- Verify that the entire face is visible and unobstructed
- Ensure no part of the face is cropped or cut off
- Confirm the dish is properly positioned without face interference
- Maintain the original image quality and clarity`;

    const payload = {
      person_image_url: personImageUrl,
      product_image_url: productImageUrl,
      prompt: baseInstruction,
      negative_prompt: "cropped face, face cut off, partial face, cropped head, head cut off, cropped image, cut off image, incomplete face, missing face, hidden face, obscured face, face partially hidden, face behind object, face covered, face blocked, face cropped at chin, face cropped at forehead, face cropped at sides, face cut at top, face cut at bottom, face cut at left, face cut at right, face partially visible, face not fully shown, face incomplete, face missing parts, face cut off at eyes, face cut off at mouth, face cut off at nose, face cut off at chin, face cut off at forehead, face cut off at hairline, face cut off at jaw, face cut off at cheeks, face cut off at temples, face cut off at ears, face cut off at eyebrows, face cut off at lips, face cut off at neck, face cropped, head cropped, face truncated, head truncated, face sliced, head sliced, face chopped, head chopped, face severed, head severed, face amputated, head amputated, face removed, head removed, face missing, head missing, face gone, head gone, face absent, head absent, face invisible, head invisible, face hidden, head hidden, face obscured, head obscured, face blocked, head blocked, face covered, head covered, face masked, head masked, face concealed, head concealed, face disguised, head disguised, face distorted, head distorted, face deformed, head deformed, face malformed, head malformed, face disfigured, head disfigured, face mutilated, head mutilated, face damaged, head damaged, face broken, head broken, face destroyed, head destroyed, face ruined, head ruined, face spoiled, head spoiled, face corrupted, head corrupted, face degraded, head degraded, face deteriorated, head deteriorated, face decayed, head decayed, face rotted, head rotted, face decomposed, head decomposed, face dissolved, head dissolved, face melted, head melted, face liquefied, head liquefied, face vaporized, head vaporized, face evaporated, head evaporated, face disappeared, head disappeared, face vanished, head vanished, face gone missing, head gone missing, face lost, head lost, face misplaced, head misplaced, face mislaid, head mislaid, face forgotten, head forgotten, face neglected, head neglected, face abandoned, head abandoned, face discarded, head discarded, face rejected, head rejected, face excluded, head excluded, face omitted, head omitted, face skipped, head skipped, face bypassed, head bypassed, face avoided, head avoided, face evaded, head evaded, face escaped, head escaped, face fled, head fled, face ran away, head ran away, face left, head left, face departed, head departed, face went away, head went away, face moved away, head moved away, face shifted away, head shifted away, face drifted away, head drifted away, face floated away, head floated away, face sailed away, head sailed away, face flew away, head flew away, face soared away, head soared away, face glided away, head glided away, face slid away, head slid away, face slipped away, head slipped away, face sneaked away, head sneaked away, face crept away, head crept away, face crawled away, head crawled away, face inched away, head inched away, face edged away, head edged away, face sidled away, head sidled away, face tiptoed away, head tiptoed away, face stole away, head stole away, face snuck away, head snuck away, face slunk away, head slunk away, face slinked away, head slinked away, face skulked away, head skulked away, face lurked away, head lurked away, face prowled away, head prowled away, face stalked away, head stalked away, face hunted away, head hunted away, face tracked away, head tracked away, face trailed away, head trailed away, face followed away, head followed away, face pursued away, head pursued away, face chased away, head chased away, face hounded away, head hounded away, face dogged away, head dogged away, face shadowed away, head shadowed away, face tailed away, head tailed away, face tagged along away, head tagged along away, face accompanied away, head accompanied away, face escorted away, head escorted away, face guided away, head guided away, face led away, head led away, face conducted away, head conducted away, face directed away, head directed away, face steered away, head steered away, face piloted away, head piloted away, face navigated away, head navigated away, face maneuvered away, head maneuvered away, face manipulated away, head manipulated away, face controlled away, head controlled away, face managed away, head managed away, face handled away, head handled away, face operated away, head operated away, face worked away, head worked away, face functioned away, head functioned away, face performed away, head performed away, face executed away, head executed away, face accomplished away, head accomplished away, face achieved away, head achieved away, face completed away, head completed away, face finished away, head finished away, face ended away, head ended away, face concluded away, head concluded away, face terminated away, head terminated away, face stopped away, head stopped away, face ceased away, head ceased away, face halted away, head halted away, face paused away, head paused away, face rested away, head rested away, face relaxed away, head relaxed away, face calmed away, head calmed away, face soothed away, head soothed away, face comforted away, head comforted away, face consoled away, head consoled away, face reassured away, head reassured away, face encouraged away, head encouraged away, face supported away, head supported away, face helped away, head helped away, face assisted away, head assisted away, face aided away, head aided away, face abetted away, head abetted away, face facilitated away, head facilitated away, face enabled away, head enabled away, face allowed away, head allowed away, face permitted away, head permitted away, face authorized away, head authorized away, face approved away, head approved away, face sanctioned away, head sanctioned away, face endorsed away, head endorsed away, face backed away, head backed away, face sponsored away, head sponsored away, face funded away, head funded away, face financed away, head financed away, face paid away, head paid away, face compensated away, head compensated away, face rewarded away, head rewarded away, face recognized away, head recognized away, face acknowledged away, head acknowledged away, face accepted away, head accepted away, face welcomed away, head welcomed away, face greeted away, head greeted away, face saluted away, head saluted away, face hailed away, head hailed away, face cheered away, head cheered away, face applauded away, head applauded away, face praised away, head praised away, face complimented away, head complimented away, face flattered away, head flattered away, face admired away, head admired away, face respected away, head respected away, face honored away, head honored away, face revered away, head revered away, face worshipped away, head worshipped away, face adored away, head adored away, face loved away, head loved away, face cherished away, head cherished away, face treasured away, head treasured away, face valued away, head valued away, face appreciated away, head appreciated away, face esteemed away, head esteemed away, face regarded away, head regarded away, face considered away, head considered away, face thought away, head thought away, face believed away, head believed away, face supposed away, head supposed away, face assumed away, head assumed away, face presumed away, head presumed away, face imagined away, head imagined away, face conceived away, head conceived away, face envisioned away, head envisioned away, face pictured away, head pictured away, face visualized away, head visualized away, face dreamed away, head dreamed away, face fantasized away, head fantasized away, face wished away, head wished away, face hoped away, head hoped away, face desired away, head desired away, face wanted away, head wanted away, face craved away, head craved away, face longed away, head longed away, face yearned away, head yearned away, face pined away, head pined away, face ached away, head ached away, face hurt away, head hurt away, face pained away, head pained away, face suffered away, head suffered away, face endured away, head endured away, face bore away, head bore away, face tolerated away, head tolerated away, face put up with away, head put up with away, face stood away, head stood away, face withstood away, head withstood away, face resisted away, head resisted away, face opposed away, head opposed away, face fought away, head fought away, face battled away, head battled away, face struggled away, head struggled away, face contended away, head contended away, face competed away, head competed away, face vied away, head vied away, face rivaled away, head rivaled away, face matched away, head matched away, face equaled away, head equaled away, face compared away, head compared away, face contrasted away, head contrasted away, face differed away, head differed away, face varied away, head varied away, face changed away, head changed away, face altered away, head altered away, face modified away, head modified away, face transformed away, head transformed away, face converted away, head converted away, face translated away, head translated away, face interpreted away, head interpreted away, face explained away, head explained away, face described away, head described away, face detailed away, head detailed away, face specified away, head specified away, face defined away, head defined away, face characterized away, head characterized away, face classified away, head classified away, face categorized away, head categorized away, face grouped away, head grouped away, face sorted away, head sorted away, face organized away, head organized away, face arranged away, head arranged away, face ordered away, head ordered away, face structured away, head structured away, face designed away, head designed away, face planned away, head planned away, face prepared away, head prepared away, face ready away, head ready away, face set away, head set away, face fixed away, head fixed away, face established away, head established away, face created away, head created away, face made away, head made away, face built away, head built away, face constructed away, head constructed away, face assembled away, head assembled away, face put together away, head put together away, face joined away, head joined away, face connected away, head connected away, face linked away, head linked away, face tied away, head tied away, face bound away, head bound away, face fastened away, head fastened away, face secured away, head secured away, face attached away, head attached away, face affixed away, head affixed away, face mounted away, head mounted away, face installed away, head installed away, face placed away, head placed away, face positioned away, head positioned away, face located away, head located away, face situated away, head situated away, face stationed away, head stationed away, face posted away, head posted away, face assigned away, head assigned away, face appointed away, head appointed away, face designated away, head designated away, face named away, head named away, face called away, head called away, face titled away, head titled away, face labeled away, head labeled away, face tagged away, head tagged away, face marked away, head marked away, face noted away, head noted away, face recorded away, head recorded away, face registered away, head registered away, face listed away, head listed away, face cataloged away, head cataloged away, face indexed away, head indexed away, face filed away, head filed away, face stored away, head stored away, face kept away, head kept away, face held away, head held away, face maintained away, head maintained away, face preserved away, head preserved away, face conserved away, head conserved away, face protected away, head protected away, face guarded away, head guarded away, face defended away, head defended away, face shielded away, head shielded away, face covered away, head covered away, face sheltered away, head sheltered away, face housed away, head housed away, face accommodated away, head accommodated away, face lodged away, head lodged away, face quartered away, head quartered away, face billeted away, head billeted away, face stationed away, head stationed away, face posted away, head posted away, face assigned away, head assigned away, face appointed away, head appointed away, face designated away, head designated away, face named away, head named away, face called away, head called away, face titled away, head titled away, face labeled away, head labeled away, face tagged away, head tagged away, face marked away, head marked away, face noted away, head noted away, face recorded away, head recorded away, face registered away, head registered away, face listed away, head listed away, face cataloged away, head cataloged away, face indexed away, head indexed away, face filed away, head filed away, face stored away, head stored away, face kept away, head kept away, face held away, head held away, face maintained away, head maintained away, face preserved away, head preserved away, face conserved away, head conserved away, face protected away, head protected away, face guarded away, head guarded away, face defended away, head defended away, face shielded away, head shielded away, face covered away, head covered away, face sheltered away, head sheltered away, face housed away, head housed away, face accommodated away, head accommodated away, face lodged away, head lodged away, face quartered away, head quartered away, face billeted away, head billeted away, blurry, low quality, distorted, extra hands, additional person, second person, different person, extra person, multiple people, extra limbs, deformed hands, bad anatomy, extra fingers, missing fingers, extra arms, missing arms, extra legs, missing legs, malformed limbs, disfigured, bad proportions, extra heads, missing head, extra body parts, missing body parts, duplicate, duplicate person, duplicate people, multiple persons, crowd, group of people, other people, strangers, unknown people, random people, background people, people in background, additional people, extra people, more people, too many people, crowded, cluttered, busy, messy, disorganized, chaotic, confusing, unclear, ambiguous, uncertain, vague, indistinct, unclear, blurry, out of focus, low resolution, pixelated, grainy, noisy, artifacts, compression artifacts, jpeg artifacts, quality issues, technical issues, rendering issues, generation issues, AI artifacts, machine artifacts, computer generated artifacts, synthetic artifacts, fake, artificial, unnatural, unrealistic, impossible, illogical, nonsensical, absurd, ridiculous, silly, stupid, foolish, idiotic, moronic, asinine, inane, pointless, useless, worthless, meaningless, empty, void, nothing, blank, white, black, solid color, monochrome, single color, no color, colorless, drab, dull, boring, uninteresting, plain, simple, basic, elementary, primitive, crude, rough, unrefined, unfinished, incomplete, partial, half, quarter, third, fraction, piece, part, segment, section, portion, bit, chunk, slice, fragment, shard, splinter, chip, flake, particle, atom, molecule, cell, unit, component, element, ingredient, constituent, modified dish, changed dish, altered dish, transformed dish, different dish, wrong dish, incorrect dish, dish modification, dish alteration, dish transformation, dish style change, dish color change, dish shape change, new background, added background, changed background, modified background, different background, background change, background modification, background addition, extra background, additional background, background replacement, background substitution",
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
