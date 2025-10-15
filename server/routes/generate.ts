import type { RequestHandler } from "express";
import path from "path";
import { promises as fs } from "fs";
import crypto from "crypto";

/**
 * Image Generation Pipeline:
 * 1. FAL AI Product Holding: Places exact dish in person's hands
 * 2. FLUX Kontext: Transforms to digital illustration with Indian ethnic wear
 * 3. Cloudinary Background Removal: Creates transparent background
 *
 * This creates a complete festive postcard with person holding dish,
 * cartoonish digital illustration style, and transparent background.
 */

const FAL_FILES = "https://fal.run/v1/files/";
const MODEL_URL = "https://fal.run/fal-ai/image-apps-v2/product-holding";
const FLUX_KONTEXT_URL = "https://fal.run/fal-ai/flux-pro/kontext"; // Added for FLUX Kontext
const PIXELBIN_API_URL = "https://api.pixelbin.io/v2/transform";

async function uploadToFal(
  fileBuffer: Buffer,
  filename: string,
  apiKey: string,
) {
  const form = new FormData();
  const blob = new Blob([fileBuffer as any]);
  form.append("file", blob, filename);
  const res = await fetch(FAL_FILES, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
    },
    body: form as any,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("Upload did not return url");
  return data.url;
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error("Invalid data URL");
  const mime = match[1];
  const b64 = match[2];
  const ext = mime.split("/")[1] || "png";
  return { buffer: Buffer.from(b64, "base64"), ext };
}

async function removeBackgroundWithClipdrop(
  imageBuffer: Buffer,
  apiKey: string,
) {
  console.log("Starting Clipdrop background removal...");
  console.log("Image buffer size:", imageBuffer.length, "bytes");
  console.log("API Key length:", apiKey.length);

  const formData = new FormData();
  const blob = new Blob([imageBuffer as any]);
  formData.append("image_file", blob, "image.png");

  console.log("Sending request to Clipdrop API...");
  const response = await fetch("https://clipdrop-api.co/remove-background/v1", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
    },
    body: formData as any,
  });

  console.log("Clipdrop API response status:", response.status);
  console.log(
    "Clipdrop API response headers:",
    Object.fromEntries(response.headers.entries()),
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Clipdrop API error response:", errorText);
    throw new Error(
      `Clipdrop API failed: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const result = await response.arrayBuffer();
  console.log(
    "Clipdrop background removal successful, result size:",
    result.byteLength,
    "bytes",
  );
  return result;
}

async function removeBackgroundWithCloudinary(
  imageUrl: string,
  cloudName: string,
  apiKey: string,
  apiSecret: string,
): Promise<string> {
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
  const transformation = "e_background_removal";
  const message = `folder=diwali-postcards/background-removed&format=png&timestamp=${timestamp}&transformation=${transformation}${apiSecret}`;

  const hash = crypto.createHash("sha1").update(message).digest("hex");

  // Upload the image to Cloudinary with background removal
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const formData = new FormData();
  formData.append("file", new Blob([imageBuffer]), "image.png");
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", hash);
  formData.append("folder", "diwali-postcards/background-removed");
  formData.append("transformation", transformation);
  formData.append("format", "png");

  console.log("Cloudinary: Uploading image with background removal...");
  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  console.log("Cloudinary: Upload response status:", response.status);

  if (!response.ok) {
    const error = await response.text();
    console.error("Cloudinary: Error response:", error);
    throw new Error(
      `Cloudinary background removal failed: ${response.status} - ${error}`,
    );
  }

  const result = await response.json();
  console.log(
    "Cloudinary: Background removal successful, result URL:",
    result.secure_url,
  );
  return result.secure_url;
}

async function downloadImageAsBuffer(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadToPixelBin(
  imageBuffer: Buffer,
  fileName: string,
): Promise<string> {
  const cloudName = process.env.PIXELBIN_CLOUD_NAME || "A-Nh2g";
  const apiKey =
    process.env.PIXELBIN_API_KEY || "87140d43-d9fb-44e3-9fcb-964b84dd6520";

  const formData = new FormData();
  const blob = new Blob([imageBuffer as any]);
  formData.append("file", blob, fileName);

  const uploadUrl = `https://api.pixelbin.io/v2/upload`;

  console.log("Uploading to PixelBin:", uploadUrl);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData as any,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("PixelBin upload error:", errorText);
    throw new Error(
      `PixelBin upload failed: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const json = await response.json();
  console.log("PixelBin upload response:", JSON.stringify(json, null, 2));

  if (json.url) {
    return json.url;
  } else if (json.data && json.data.url) {
    return json.data.url;
  } else {
    throw new Error("PixelBin upload did not return a URL");
  }
}

async function applyFluxKontextTransformation(
  imageUrl: string,
  apiKey: string,
): Promise<string> {
  console.log(
    "Applying FLUX Kontext transformation for digital illustration style...",
  );
  console.log("Input image URL for FLUX Kontext:", imageUrl);

  const prompt =
    "Convert this person image to a polished digital illustration art style. Use a cartoonish character design with smooth lines, subtle gradients for shading, and a warm Indian Diwali color palette (yellows, oranges, browns). Change dress to Indian ethnic wear. Keep the same background as the input image.";

  const payload = {
    prompt: prompt,
    image_url: imageUrl,
    guidance_scale: 7.5,
    num_inference_steps: 20,
    seed: Math.floor(Math.random() * 1000000),
  };

  console.log("FLUX Kontext payload:", JSON.stringify(payload, null, 2));

  const response = await fetch(FLUX_KONTEXT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  console.log("FLUX Kontext response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("FLUX Kontext API error:", errorText);
    throw new Error(
      `FLUX Kontext API failed: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const result = await response.json();
  console.log("FLUX Kontext response:", JSON.stringify(result, null, 2));

  if (result.images && result.images.length > 0) {
    const imageUrl = result.images[0].url;
    console.log("FLUX Kontext transformation successful:", imageUrl);
    return imageUrl;
  } else {
    throw new Error("FLUX Kontext did not return any images");
  }
}

async function applyPixelBinTransformation(imageUrl: string): Promise<string> {
  const cloudName = process.env.PIXELBIN_CLOUD_NAME || "A-Nh2g";
  const cdnUrl =
    process.env.NEXT_PUBLIC_PIXELBIN_CDN || "https://cdn.pixelbin.io/v2";

  try {
    // Download the image and upload to PixelBin
    console.log("Downloading image for PixelBin upload:", imageUrl);
    const imageBuffer = await downloadImageAsBuffer(imageUrl);

    // Generate a unique filename
    const timestamp = Date.now();
    const fileName = `dishcraft-${timestamp}.png`;

    // Upload to PixelBin
    const pixelbinUrl = await uploadToPixelBin(imageBuffer, fileName);
    console.log("Image uploaded to PixelBin:", pixelbinUrl);

    // Extract the file path from PixelBin URL
    const urlParts = pixelbinUrl.split("/");
    const filePath = urlParts.slice(urlParts.indexOf(cloudName) + 1).join("/");

    // Apply artistic transformations for digital illustration style
    // Using multiple transformation parameters to achieve cartoonish character design
    const transformations = [
      "f=cartoon", // Cartoon filter
      "hue=30", // Warm hue (yellows/oranges)
      "saturation=60", // Enhanced saturation for Diwali colors
      "brightness=10", // Slight brightness increase
      "contrast=25", // Increased contrast for definition
      "sepia=15", // Warm sepia tone
      "vibrance=40", // Enhanced vibrance for colors
      "gamma=1.1", // Slight gamma adjustment
    ].join("&");

    const transformedUrl = `${cdnUrl}/${cloudName}/${filePath}?${transformations}`;

    console.log("PixelBin transformation URL:", transformedUrl);

    // Test if the transformed URL is accessible
    const response = await fetch(transformedUrl, { method: "HEAD" });
    if (response.ok) {
      console.log("PixelBin transformation successful");
      return transformedUrl;
    } else {
      console.warn(
        "PixelBin transformation URL not accessible, using uploaded image",
      );
      return pixelbinUrl;
    }
  } catch (error) {
    console.error("PixelBin transformation failed:", error);
    console.warn("Using original image instead");
    return imageUrl;
  }
}

async function uploadToCloudinaryFromBuffer(imageBuffer: Buffer) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const unsignedPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloud) throw new Error("Cloudinary not configured");
  const url = `https://api.cloudinary.com/v1_1/${cloud}/image/upload`;

  if (apiKey && apiSecret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "dishcraft";
    const toSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash("sha1")
      .update(toSign + apiSecret)
      .digest("hex");

    const form = new FormData();
    form.append("file", new Blob([imageBuffer as any]), "image.png");
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp));
    form.append("signature", signature);
    form.append("folder", folder);

    const res = await fetch(url, { method: "POST", body: form as any });
    const json = await res.json();
    if (!res.ok)
      throw new Error(json?.error?.message || `Cloudinary ${res.status}`);
    return (json.secure_url || json.url) as string;
  }

  if (!unsignedPreset) throw new Error("Cloudinary unsigned preset missing");
  const form = new FormData();
  form.append("file", new Blob([imageBuffer as any]), "image.png");
  form.append("upload_preset", unsignedPreset);
  const res = await fetch(url, { method: "POST", body: form as any });
  const json = await res.json();
  if (!res.ok)
    throw new Error(json?.error?.message || `Cloudinary ${res.status}`);
  return (json.secure_url || json.url) as string;
}

async function uploadToCloudinaryFromDataUrl(dataUrl: string) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const unsignedPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloud) throw new Error("Cloudinary not configured");
  const url = `https://api.cloudinary.com/v1_1/${cloud}/image/upload`;

  if (apiKey && apiSecret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "dishcraft";
    const toSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash("sha1")
      .update(toSign + apiSecret)
      .digest("hex");

    const form = new FormData();
    form.append("file", dataUrl);
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp));
    form.append("signature", signature);
    form.append("folder", folder);

    const res = await fetch(url, { method: "POST", body: form as any });
    const json = await res.json();
    if (!res.ok)
      throw new Error(json?.error?.message || `Cloudinary ${res.status}`);
    return (json.secure_url || json.url) as string;
  }

  if (!unsignedPreset) throw new Error("Cloudinary unsigned preset missing");
  const form = new FormData();
  form.append("file", dataUrl);
  form.append("upload_preset", unsignedPreset);
  const res = await fetch(url, { method: "POST", body: form as any });
  const json = await res.json();
  if (!res.ok)
    throw new Error(json?.error?.message || `Cloudinary ${res.status}`);
  return (json.secure_url || json.url) as string;
}

async function pollUntilReady(url: string, apiKey: string, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(url, {
      headers: { Authorization: `Key ${apiKey}` },
    });
    if (!res.ok) throw new Error(`Polling failed: ${res.status}`);
    const json = await res.json();
    const status = (
      json.status ||
      json.state ||
      json.task_status ||
      ""
    ).toString();
    if (["succeeded", "success", "completed", "ready"].includes(status))
      return json;
    if (["failed", "error"].includes(status))
      throw new Error(json.error || "Generation failed");
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Timeout waiting for generation");
}

function extractImageUrl(json: any): string | null {
  if (!json) return null;
  if (typeof json.image === "string") return json.image;
  if (typeof json.image_url === "string") return json.image_url;
  if (Array.isArray(json.images) && json.images.length) {
    const item = json.images[0];
    if (typeof item === "string") return item;
    if (item?.url) return item.url;
  }
  if (json.output?.image) return json.output.image;
  if (json.output?.image_url) return json.output.image_url;
  return null;
}

export const handleGenerate: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.FAL_KEY ?? process.env.FAL_API_KEY;
    if (!apiKey) {
      res
        .status(400)
        .json({
          error:
            "FAL_KEY environment variable missing. Set it to call the model.",
        });
      return;
    }

    // Cloudinary configuration
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
    const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;

    const { personImageUrl, personImageBase64, dishImageUrl, background, greeting } =
      req.body as {
        personImageUrl?: string;
        personImageBase64?: string;
        dishImageUrl: string;
        background?: string;
        greeting?: string;
      };

    console.log("Background video selected:", background);

    if ((!personImageUrl && !personImageBase64) || !dishImageUrl) {
      res
        .status(400)
        .json({ error: "personImageUrl (or personImageBase64) and dishImageUrl are required" });
      return;
    }

    // Handle person image - either from URL or base64
    let uploadedPersonUrl: string;
    
    if (personImageUrl) {
      // Use the provided URL directly
      console.log('Using provided person image URL:', personImageUrl);
      uploadedPersonUrl = personImageUrl;
    } else {
      // Parse the base64 image and upload to Cloudinary
      const { buffer: personImageBuffer } = parseDataUrl(personImageBase64!);
      console.log("Person image buffer size:", personImageBuffer.length, "bytes");
      
      // Upload original image to Cloudinary for FAL AI processing
      uploadedPersonUrl = await uploadToCloudinaryFromDataUrl(personImageBase64!);
    }

    // Convert local dish image path to full URL for FAL AI
    let dishImageUrlForFal = dishImageUrl;
    if (dishImageUrl.startsWith("/")) {
      // Convert local path to full URL
      const baseUrl = process.env.BASE_URL || "http://localhost:5205";
      dishImageUrlForFal = `${baseUrl}${dishImageUrl}`;
    }

    // Focus on placing exact dish image in existing hands with full image and face retention
    // Enhanced face preservation to prevent cropping - using extremely low strength and maximum guidance
    // Background removal will be handled by Clipdrop after FAL AI processing
    const baseInstruction =
      "The exact same person from the uploaded image with identical pose, hands, and FACE. The person is FRONT-FACING and CENTERED in the image, holding a festive brass plate/bowl with the EXACT product image from the reference. CRITICAL: The food item on the plate must be IDENTICAL to the reference product image - same exact dish, same exact food, same exact appearance, same exact shape, same exact color, same exact garnish, same exact texture, same exact size. DO NOT ADD ANY EXTRA ELEMENTS to the dish - no additional food items, no extra garnishes, no decorations, no modifications, no changes. The dish must be exactly as shown in the reference image with no additions or alterations. The dish must be clearly visible and prominent on the plate. MANDATORY: Use ONLY the hands that are already visible in the uploaded image - do not change hand position, do not add extra hands, do not generate new hands, do not create additional hands, do not show any other person's hands, do not add any extra limbs. Keep the person's original hands exactly as they are. NO OTHER HANDS: Only show the hands from the original uploaded image, no additional hands from any other person. FACE PRESERVATION IS ABSOLUTELY CRITICAL: The person's FACE MUST BE COMPLETELY VISIBLE from top of head to chin, not cropped, not cut off, not partially hidden, not obscured, not truncated, not sliced, not chopped, not removed, not missing any part. The face must be FULLY VISIBLE, FRONT-FACING, WELL-LIT, and CENTERED. Show the complete head including hair, forehead, eyes, nose, mouth, and chin. NO FACE CROPPING WHATSOEVER: Do not crop the face at any angle, do not cut off the top of the head, do not cut off the chin, do not cut off the sides of the face, do not cut off the forehead, do not cut off the hair, do not cut off any part of the head. The face must be completely intact and visible from the very top of the head to the bottom of the chin. MAINTAIN ORIGINAL IMAGE DIMENSIONS: Keep the exact same height and aspect ratio as the original uploaded image. Show the complete full body image, full height, full person visible, not cropped. RETAIN ORIGINAL HEIGHT: The output image must have the exact same height as the input image. NO CROPPING: Do not crop the image, show the complete person from head to toe, maintain original image boundaries. Natural lighting, Indian festive vibe, high quality, detailed, professional photography.";

    console.log("Uploaded person URL:", uploadedPersonUrl);
    console.log("Dish image URL for FAL:", dishImageUrlForFal);

    const payload: any = {
      person_image_url: uploadedPersonUrl,
      product_image_url: dishImageUrlForFal,
      prompt: greeting ? `${baseInstruction} ${greeting}` : baseInstruction,
      negative_prompt:
        "altered product, different dish, missing hands, one hand only, deformed hands, extra fingers, extra hands, additional hands, new hands, generated hands, three hands, multiple hands, extra limbs, additional limbs, another person, second person, different person, extra person, additional person, cropped product, cropped image, partial image, cut off, incomplete, low quality, watermark, text, changed dish appearance, modified food, different food item, wrong dish, substituted food, different food, altered food appearance, different cuisine, wrong food type, transformed food, modified dish, changed person pose, different hand position, changed hands, modified hands, new hand position, changed face, different face, altered facial features, modified face, different expression, changed identity, face distortion, facial changes, different person face, extra food items, additional garnishes, extra decorations, added elements, modified dish, altered dish, extra ingredients, additional toppings, extra garnishes, food modifications, dish alterations, added food, extra components, additional elements, modified ingredients, changed food appearance, extra decorations on food, additional food items, extra garnishes on dish, side profile, side view, profile view, back view, turned away, looking away, face not visible, hidden face, obscured face, side-facing, not front-facing, off-center, not centered, poorly lit face, dark face, shadowed face, face in shadow, cropped face, face cut off, partial face, face cropped, head cut off, face partially visible, face not fully visible, face cropped at top, face cropped at bottom, face cropped at sides, face cut off at top, face cut off at bottom, face cut off at sides, forehead cut off, chin cut off, hair cut off, head partially visible, head cropped, head cut off, face cropped horizontally, face cropped vertically, face cropped diagonally, face cropped at corners, face cropped at edges, face cropped at borders, face cropped at margins, face cropped at boundaries, face cropped at limits, face cropped at ends, face cropped at sides, face cropped at top, face cropped at bottom, face cropped at left, face cropped at right, face cropped at center, face cropped at middle, face cropped at edges, face cropped at borders, face cropped at margins, face cropped at boundaries, face cropped at limits, face cropped at ends, face cropped at sides, face cropped at top, face cropped at bottom, face cropped at left, face cropped at right, face cropped at center, face cropped at middle, face truncated, face sliced, face chopped, face removed, face missing, head truncated, head sliced, head chopped, head removed, head missing, partial head, incomplete head, cropped head, cut off head, sliced head, chopped head, truncated head, removed head, missing head, incomplete face, cropped face, cut off face, sliced face, chopped face, truncated face, removed face, missing face, face cropped at any angle, face cut off at any angle, face sliced at any angle, face chopped at any angle, face truncated at any angle, face removed at any angle, face missing at any angle, head cropped at any angle, head cut off at any angle, head sliced at any angle, head chopped at any angle, head truncated at any angle, head removed at any angle, head missing at any angle, changed image dimensions, different aspect ratio, modified height, altered width, different image size, resized image, stretched image, compressed image, distorted proportions, other person hands, extra person hands, additional person hands, different person hands, multiple people hands, extra people, additional people, other people, multiple people, extra limbs from other person, additional limbs from other person, hands from different person, extra hands from other person, additional hands from other person, multiple people in image, other person in image, additional person in image, extra person in image, height changed, different height, modified height, altered height, resized height, compressed height, stretched height, height distortion, aspect ratio changed, proportions changed, dimensions altered, size modified",
      // background: background || undefined, // Removed to ensure transparent background
      strength: 0.02, // Extremely low strength to maximize preservation of original person and face
      guidance_scale: 15.0, // Maximum guidance for strict prompt adherence and face preservation
      num_inference_steps: 300, // More steps for better quality and preservation
      seed: Math.floor(Math.random() * 1000000),
      enable_safety_checker: false,
      scheduler: "DPMSolverMultistepScheduler",
      // Additional parameters for better face preservation
      controlnet_conditioning_scale: 1.0,
      control_guidance_start: 0.0,
      control_guidance_end: 1.0,
      // Note: Background removal will be handled by Clipdrop after FAL AI processing
    };

    const run = await fetch(MODEL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (run.status === 202) {
      const started = await run.json();
      const statusUrl =
        started?.response_url || started?.status_url || started?.url;
      if (!statusUrl) throw new Error("Missing response url from fal");
      const finalJson = await pollUntilReady(statusUrl, apiKey);
      const imageUrl = extractImageUrl(finalJson);
      if (!imageUrl) throw new Error("No image URL in final response");
      res.json({ image_url: imageUrl, meta: finalJson });
      return;
    }

    // Read response safely (may be JSON or text)
    let json: any = null;
    try {
      json = await run.json();
    } catch (e) {
      // If parsing fails, try to read as text
      try {
        json = { error: await run.text() };
      } catch (e2) {
        json = { error: "Unknown error from model service" };
      }
    }

    if (!run.ok) {
      console.error("FAL model returned error:", run.status, json);
      if (run.status === 403) {
        // Friendly message for authorization/quota issues
        res
          .status(502)
          .json({
            error:
              "Image generation service refused the request (403). Please check FAL_KEY, account access or quota.",
          });
        return;
      }

      res
        .status(run.status)
        .json({ error: json?.error || JSON.stringify(json) });
      return;
    }

    const imageUrl = extractImageUrl(json);
    if (!imageUrl) {
      res
        .status(500)
        .json({ error: "Model response did not include an image URL" });
      return;
    }

    // Apply FLUX Kontext transformation for digital illustration art style FIRST
    // This transforms the image into a cartoonish digital illustration with Indian ethnic wear
    // We do this before background removal so FLUX Kontext can work with the original background
    let fluxKontextImageUrl: string;
    let fluxKontextSuccess = false;

    try {
      console.log(
        "Applying FLUX Kontext transformation for digital illustration style...",
      );
      const fluxKontextUrl = await applyFluxKontextTransformation(
        imageUrl,
        apiKey,
      );
      fluxKontextImageUrl = fluxKontextUrl;
      fluxKontextSuccess = true;
      console.log(
        "FLUX Kontext transformation successful:",
        fluxKontextImageUrl,
      );
    } catch (fluxKontextError) {
      console.error("FLUX Kontext transformation failed:", fluxKontextError);
      console.warn("FLUX Kontext transformation failed, using original image");
      fluxKontextImageUrl = imageUrl;
      fluxKontextSuccess = false;
    }

    // Process the FLUX Kontext image with Cloudinary for background removal
    // This step creates transparent background from the illustrated image
    let finalImageUrl: string;
    let backgroundRemoved = false;

    console.log(
      "Cloudinary credentials available:",
      !!cloudName && !!cloudinaryApiKey && !!cloudinaryApiSecret,
    );

    if (cloudName && cloudinaryApiKey && cloudinaryApiSecret) {
      try {
        console.log(
          "Processing FLUX Kontext image with Cloudinary for background removal...",
        );
        console.log("FLUX Kontext image URL:", fluxKontextImageUrl);

        finalImageUrl = await removeBackgroundWithCloudinary(
          fluxKontextImageUrl,
          cloudName,
          cloudinaryApiKey,
          cloudinaryApiSecret,
        );
        backgroundRemoved = true;
        console.log("Cloudinary background removal successful:", finalImageUrl);
      } catch (cloudinaryError) {
        console.error("Cloudinary background removal failed:", cloudinaryError);
        console.warn(
          "Background removal failed, using FLUX Kontext image without background removal",
        );
        finalImageUrl = fluxKontextImageUrl;
        backgroundRemoved = false;
      }
    } else {
      console.warn(
        "Cloudinary credentials not set, skipping background removal",
      );
      finalImageUrl = fluxKontextImageUrl;
      backgroundRemoved = false;
    }

    res.json({
      image_url: finalImageUrl,
      original_image_url: imageUrl,
      flux_kontext_image_url: fluxKontextImageUrl,
      background_removed_image_url: backgroundRemoved ? finalImageUrl : null,
      background_video: background ? `/background/${background}.mp4` : null,
      meta: json,
      background_removed: backgroundRemoved,
      flux_kontext_transformed: fluxKontextSuccess,
      illustration_style: fluxKontextSuccess
        ? "digital_illustration_diwali"
        : "original",
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Unexpected error" });
  }
};

// Test endpoint for FLUX Kontext API
export const handleTestFluxKontext = async (req: any, res: any) => {
  try {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      res.status(500).json({
        success: false,
        error: "FAL_KEY environment variable not set",
      });
      return;
    }

    console.log("Testing FLUX Kontext API...");
    console.log("API Key length:", apiKey.length);

    // Test with a real image URL
    const testImageUrl =
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop";
    console.log("Testing with image URL:", testImageUrl);

    const prompt =
      "Convert this person image to a polished digital illustration art style. Use a cartoonish character design with smooth lines, subtle gradients for shading, and a warm Indian Diwali color palette (yellows, oranges, browns). Change dress to Indian ethnic wear. Keep the same background as the input image.";

    const payload = {
      prompt: prompt,
      image_url: testImageUrl,
      guidance_scale: 7.5,
      num_inference_steps: 20,
      seed: Math.floor(Math.random() * 1000000),
    };

    console.log("FLUX Kontext test payload:", JSON.stringify(payload, null, 2));

    const response = await fetch(FLUX_KONTEXT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    console.log("FLUX Kontext test response status:", response.status);
    console.log(
      "FLUX Kontext test response headers:",
      Object.fromEntries(response.headers.entries()),
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("FLUX Kontext test error:", errorText);
      res.json({
        success: false,
        error: `FLUX Kontext API test failed: ${response.status} ${response.statusText} - ${errorText}`,
        status: response.status,
      });
      return;
    }

    const result = await response.json();
    console.log(
      "FLUX Kontext test successful, result:",
      JSON.stringify(result, null, 2),
    );

    res.json({
      success: true,
      message: "FLUX Kontext API is working",
      result: result,
      status: response.status,
    });
  } catch (error: any) {
    console.error("FLUX Kontext test error:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "FLUX Kontext test failed",
    });
  }
};

// Test endpoint for Clipdrop API
export const handleTestClipdrop = async (req: any, res: any) => {
  try {
    const clipdropApiKey =
      "75f768c7813dc42a5c4948b5b6b79121c712116c7baff2c1f41e97f63485625e048406d24697dc623b77e785580d7f0e";

    console.log("Testing Clipdrop API...");
    console.log("API Key length:", clipdropApiKey.length);

    // Test with a real image URL first
    const testImageUrl =
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop";
    console.log("Downloading test image from:", testImageUrl);

    const imageResponse = await fetch(testImageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download test image: ${imageResponse.status}`);
    }

    const testImageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    console.log("Test image buffer size:", testImageBuffer.length, "bytes");

    const formData = new FormData();
    const blob = new Blob([testImageBuffer as any]);
    formData.append("image_file", blob, "test.jpg");

    console.log("Sending request to Clipdrop API...");
    const response = await fetch(
      "https://clipdrop-api.co/remove-background/v1",
      {
        method: "POST",
        headers: {
          "x-api-key": clipdropApiKey,
        },
        body: formData as any,
      },
    );

    console.log("Clipdrop test response status:", response.status);
    console.log(
      "Clipdrop test response headers:",
      Object.fromEntries(response.headers.entries()),
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Clipdrop test error:", errorText);
      res.json({
        success: false,
        error: `Clipdrop API test failed: ${response.status} ${response.statusText} - ${errorText}`,
        status: response.status,
      });
      return;
    }

    const result = await response.arrayBuffer();
    console.log(
      "Clipdrop test successful, result size:",
      result.byteLength,
      "bytes",
    );

    res.json({
      success: true,
      message: "Clipdrop API is working",
      resultSize: result.byteLength,
      status: response.status,
    });
  } catch (error: any) {
    console.error("Clipdrop test error:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Clipdrop test failed",
    });
  }
};
