import { RequestHandler } from "express";
import crypto from "crypto";

const CLOUDINARY_BASE_URL = "https://api.cloudinary.com/v1_1";

export const handleUploadVideo: RequestHandler = async (req, res) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ error: "Cloudinary configuration missing" });
    }

    // Support JSON data URL payloads
    const contentType = (req.headers["content-type"] || "").toString();

    let videoBuffer: Buffer | null = null;
    let originalFilename = `festive-postcard-${Date.now()}.mp4`;

    if (contentType.includes("application/json")) {
      const body = req.body || {};
      const dataUrl = body.videoData || body.video || body.videoDataUrl;
      if (!dataUrl || typeof dataUrl !== "string") {
        return res.status(400).json({ error: "videoData (data URL) is required in JSON body" });
      }
      const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
      if (!match) return res.status(400).json({ error: "Invalid data URL" });
      const base64 = match[2];
      videoBuffer = Buffer.from(base64, "base64");
      originalFilename = body.fileName || originalFilename;
    } else {
      // Try to read file from multipart (if any)
      const possible = (req as any).body && ((req as any).body.video || (req as any).body.videoData);
      if (possible && typeof possible === "string" && possible.startsWith("data:")) {
        const match = possible.match(/^data:(.+);base64,(.+)$/);
        if (!match) return res.status(400).json({ error: "Invalid data URL" });
        videoBuffer = Buffer.from(match[2], "base64");
      }
    }

    if (!videoBuffer) {
      return res.status(400).json({ error: "Video file is required" });
    }

    // Prepare Cloudinary signed upload
    const timestamp = Math.round(new Date().getTime() / 1000);
    const publicId = `diwali-postcards/videos/festive-postcard-${timestamp}`;
    const params: Record<string, any> = {
      public_id: publicId,
      folder: "diwali-postcards/videos",
      resource_type: "video",
      timestamp,
    };

    const signatureString = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&") + apiSecret;

    const signature = crypto.createHash("sha1").update(signatureString).digest("hex");

    const form = new FormData();
    const blob = new Blob([videoBuffer as any]);
    form.append("file", blob, originalFilename);
    form.append("public_id", publicId);
    form.append("folder", "diwali-postcards/videos");
    form.append("resource_type", "video");
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp));
    form.append("signature", signature);

    console.log("📤 Uploading to Cloudinary with signed upload...", { publicId, size: videoBuffer.length });

    const uploadResponse = await fetch(`${CLOUDINARY_BASE_URL}/${cloudName}/video/upload`, {
      method: "POST",
      body: form as any,
    });

    console.log("📡 Cloudinary response status:", uploadResponse.status);

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("❌ Cloudinary upload failed:", errorText);
      return res.status(500).json({ error: "Cloudinary upload failed", details: errorText });
    }

    const uploadData = await uploadResponse.json();
    console.log("✅ Video uploaded successfully:", uploadData.secure_url);

    const optimizedUrl = `https://res.cloudinary.com/${cloudName}/video/upload/f_mp4,q_auto:best,w_512,h_512,c_fill,ac_mp4,vc_h264,fl_progressive,br_200k/${uploadData.public_id}.mp4`;

    res.status(200).json({ success: true, secure_url: optimizedUrl, public_id: uploadData.public_id, originalUrl: uploadData.secure_url });
  } catch (error: any) {
    console.error("❌ Error in upload-video route:", error);
    res.status(500).json({ error: "Failed to upload video", details: error?.message || String(error) });
  }
};
