import { RequestHandler } from "express";
import cloudinary from "cloudinary";
import { Readable } from "stream";

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const handleUploadVideo: RequestHandler = async (req, res) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return res
        .status(500)
        .json({ error: "Cloudinary configuration missing" });
    }

    const contentType = (req.headers["content-type"] || "").toString();
    let videoBuffer: Buffer | null = null;
    let originalFilename = `festive-postcard-${Date.now()}.mp4`;

    if (contentType.includes("application/json")) {
      const body = req.body || {};
      const dataUrl = body.videoData || body.video || body.videoDataUrl;
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
      const rawBody = req.body as Buffer | ArrayBuffer | Uint8Array | undefined;

      if (!rawBody) {
        return res.status(400).json({ error: "Raw binary body required" });
      }

      if (Buffer.isBuffer(rawBody)) {
        videoBuffer = rawBody;
      } else if (rawBody instanceof ArrayBuffer) {
        videoBuffer = Buffer.from(rawBody);
      } else if (ArrayBuffer.isView(rawBody)) {
        const view = rawBody as ArrayBufferView;
        videoBuffer = Buffer.from(
          view.buffer,
          view.byteOffset,
          view.byteLength,
        );
      } else {
        return res
          .status(400)
          .json({ error: "Unsupported binary payload type" });
      }

      if (!videoBuffer || videoBuffer.length === 0) {
        return res.status(400).json({ error: "Video payload was empty" });
      }

      originalFilename = (
        req.headers["x-filename"] || originalFilename
      ).toString();
    } else {
      const possible =
        (req as any).body &&
        ((req as any).body.video || (req as any).body.videoData);
      if (
        possible &&
        typeof possible === "string" &&
        possible.startsWith("data:")
      ) {
        const match = possible.match(/^data:(.+);base64,(.+)$/);
        if (!match) return res.status(400).json({ error: "Invalid data URL" });
        videoBuffer = Buffer.from(match[2], "base64");
      }
    }

    if (!videoBuffer) {
      return res.status(400).json({ error: "Video file is required" });
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const filename = `festive-postcard-${timestamp}`;
    const publicId = filename;

    console.log("📤 Uploading to Cloudinary via SDK (upload_stream)...", {
      publicId,
      size: videoBuffer.length,
    });

    const uploadResult: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        {
          resource_type: "video",
          public_id: publicId,
          folder: "diwali-postcards/videos",
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      const readable = new Readable();
      readable._read = () => {}; // noop
      readable.push(videoBuffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });

    if (!uploadResult) {
      throw new Error("Cloudinary upload returned no result");
    }

    const versionSegment = uploadResult.version
      ? `/v${uploadResult.version}`
      : "";
    const transform = "f_mp4,q_auto:best";
    const baseName = (uploadResult.public_id || "").split("/").pop();
    const optimizedUrl = `https://res.cloudinary.com/${cloudName}/video/upload/${transform}${versionSegment}/diwali-postcards/videos/${baseName}.mp4`;

    res.status(200).json({
      success: true,
      secure_url: optimizedUrl,
      public_id: uploadResult.public_id,
      originalUrl: uploadResult.secure_url,
    });
  } catch (error: any) {
    console.error("❌ Error in upload-video route:", error);
    res.status(500).json({
      error: "Failed to upload video",
      details: error?.message || String(error),
    });
  }
};
