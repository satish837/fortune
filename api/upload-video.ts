import { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return res
        .status(500)
        .json({ error: "Cloudinary configuration missing" });
    }

    // Determine video data from request. Support JSON { videoData: 'data:...base64,...' }, raw octet-stream, or body.video
    let videoBuffer: Buffer | null = null;
    let originalFilename = "festive-postcard-video.mp4";

    const contentType = (req.headers["content-type"] || "").toString();

    if (contentType.includes("application/json")) {
      const body = req.body || {};
      const dataUrl =
        body.videoData || body.video || body.video_data || body.videoDataUrl;
      if (!dataUrl || typeof dataUrl !== "string") {
        return res
          .status(400)
          .json({ error: "videoData (data URL) is required in JSON body" });
      }
      const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
      if (!match) return res.status(400).json({ error: "Invalid data URL" });
      const base64 = match[2];
      videoBuffer = Buffer.from(base64, "base64");
      originalFilename = body.fileName || originalFilename;
    } else if (contentType.includes("application/octet-stream")) {
      // Read raw binary body (client sends ArrayBuffer with this content-type)
      const bodyAny: any = (req as any).body;
      if (bodyAny && bodyAny instanceof Buffer && bodyAny.length > 0) {
        videoBuffer = Buffer.from(bodyAny);
      } else if (bodyAny && bodyAny.data) {
        videoBuffer = Buffer.from(bodyAny.data);
      } else {
        // Fallback: stream read
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          (req as any)
            .on("data", (chunk: Buffer) => chunks.push(chunk))
            .on("end", () => resolve())
            .on("error", (err: any) => reject(err));
        });
        if (chunks.length > 0) {
          videoBuffer = Buffer.concat(chunks);
        }
      }
      const filenameHeader = (req.headers["x-filename"] || "").toString();
      if (filenameHeader) originalFilename = filenameHeader;
    } else {
      // Try to use req.body.video (may be available in some runtimes)
      const possible = (req.body &&
        (req.body.video || req.body.videoData || req.body.videoDataUrl)) as any;
      if (
        possible &&
        typeof possible === "string" &&
        possible.startsWith("data:")
      ) {
        const match = possible.match(/^data:(.+);base64,(.+)$/);
        if (!match) return res.status(400).json({ error: "Invalid data URL" });
        videoBuffer = Buffer.from(match[2], "base64");
      } else if (possible && possible instanceof Buffer) {
        videoBuffer = possible;
      } else if (possible && possible.data) {
        // Some runtimes provide array buffer in .data
        videoBuffer = Buffer.from(possible.data);
      }
    }

    if (!videoBuffer) {
      return res.status(400).json({ error: "Video file is required" });
    }

    // Generate signature for signed upload
    const timestamp = Math.round(new Date().getTime() / 1000);
    const publicId = `diwali-postcards/videos/festive-postcard-${timestamp}`;

    const params = {
      public_id: publicId,
      folder: "diwali-postcards/videos",
      resource_type: "video",
      timestamp: timestamp,
    };

    // Create signature
    const signatureString =
      Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join("&") + apiSecret;

    const signature = crypto
      .createHash("sha1")
      .update(signatureString)
      .digest("hex");

    // Upload to Cloudinary using fetch
    const formData = new FormData();
    // Use Blob for compatibility
    const blob = new Blob([videoBuffer]);
    formData.append("file", blob, originalFilename);
    formData.append("public_id", publicId);
    formData.append("folder", "diwali-postcards/videos");
    formData.append("resource_type", "video");
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp.toString());
    formData.append("signature", signature);

    console.log("📤 Uploading to Cloudinary with signed upload...");
    console.log("🔧 Upload params:", {
      publicId,
      folder: "diwali-postcards/videos",
      timestamp,
    });

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      {
        method: "POST",
        body: formData,
      },
    );

    console.log("📡 Cloudinary response status:", uploadResponse.status);

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("❌ Cloudinary upload failed:", errorText);
      return res.status(500).json({
        error: "Cloudinary upload failed",
        details: errorText,
      });
    }

    const uploadData = await uploadResponse.json();
    console.log("✅ Video uploaded successfully:", uploadData.secure_url);

    // Create WhatsApp-optimized MP4 URL
    const versionSegment = uploadData.version ? `/v${uploadData.version}` : "";
    const transform = "f_mp4,q_auto:best";
    const baseName = (uploadData.public_id || "").split("/").pop();
    const optimizedUrl = `https://res.cloudinary.com/${cloudName}/video/upload/${transform}${versionSegment}/diwali-postcards/videos/${baseName}.mp4`;

    res.status(200).json({
      success: true,
      secure_url: optimizedUrl,
      publicId: uploadData.public_id,
      originalUrl: uploadData.secure_url,
    });
  } catch (error) {
    console.error("❌ Error uploading video:", error);
    res.status(500).json({
      error: "Failed to upload video",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
