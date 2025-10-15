import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  handleGenerate,
  handleTestClipdrop,
  handleTestFluxKontext,
} from "./routes/generate";
import { handleSendOTP } from "./routes/send-otp";
import { handleVerifyOTP } from "./routes/verify-otp";
import { handleExistingUserOTP } from "./routes/existing-user-otp";
import { handleTinyPNGConfig } from "./routes/tinypng-config";
import { handleOptimizeImage } from "./routes/optimize-image";
import { handleCloudinaryConfig } from "./routes/cloudinary-config";
import { handleCloudinarySignature } from "./routes/cloudinary-signature";
import { handleUploadVideo } from "./routes/upload-video";
import { handleGenerateVideo } from "./routes/generate-video";

const CLOUDINARY_BASE_URL = "https://api.cloudinary.com/v1_1";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  // Support raw binary uploads for videos
  app.use(express.raw({ type: "application/octet-stream", limit: "200mb" }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.get("/api/cloudinary-config", handleCloudinaryConfig);
  app.post("/api/cloudinary-signature", handleCloudinarySignature);
  app.post("/api/generate", handleGenerate);
  app.get("/api/test-clipdrop", handleTestClipdrop);
  app.get("/api/test-flux-kontext", handleTestFluxKontext);
  app.post("/api/send-otp", handleSendOTP);
  app.post("/api/verify-otp", handleVerifyOTP);
  app.post("/api/existing-user-otp", handleExistingUserOTP);
  app.get("/api/tinypng-config", handleTinyPNGConfig);
  app.post("/api/optimize-image", handleOptimizeImage);
  app.post("/api/upload-video", handleUploadVideo);
  app.post("/api/generate-video", handleGenerateVideo);

  // Get all users (for testing purposes)
  app.get("/api/users", async (req, res) => {
    try {
      const connectDB = (await import("./database/connection")).default;
      const User = (await import("./models/User")).default;

      await connectDB();
      const users = await User.find({}).sort({ createdAt: -1 });

      res.json({
        success: true,
        count: users.length,
        users: users.map((user) => ({
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          handle: user.handle,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Test endpoints for debugging
  app.get("/api/test-env", (req, res) => {
    const envVars = {
      hasFalKey: !!process.env.FAL_KEY,
      hasCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
      hasCloudinaryApiKey: !!process.env.CLOUDINARY_API_KEY,
      hasCloudinaryApiSecret: !!process.env.CLOUDINARY_API_SECRET,
      hasUploadPreset: !!process.env.CLOUDINARY_UPLOAD_PRESET,
      hasClipdropApiKey: !!process.env.REMOVE_BG_API_KEY,
      hasTinyPNGApiKey: !!process.env.TINYPNG_API_KEY,
      falKeyPreview: process.env.FAL_KEY
        ? process.env.FAL_KEY.substring(0, 4) + "..."
        : "Not set",
      cloudNamePreview: process.env.CLOUDINARY_CLOUD_NAME || "Not set",
      uploadPresetPreview: process.env.CLOUDINARY_UPLOAD_PRESET || "Not set",
      clipdropApiKeyPreview: process.env.REMOVE_BG_API_KEY
        ? process.env.REMOVE_BG_API_KEY.substring(0, 8) + "..."
        : "Not set",
      tinyPNGApiKeyPreview: process.env.TINYPNG_API_KEY
        ? process.env.TINYPNG_API_KEY.substring(0, 8) + "..."
        : "Not set",
    };
    res.json({
      message: "Environment variables check",
      environment: envVars,
      timestamp: new Date().toISOString(),
    });
  });

  // Test background removal endpoint
  app.post("/api/test-bg-removal", async (req, res) => {
    try {
      console.log("Test background removal API called");

      // Get environment variables
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
      const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
      const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
      const clipdropApiKey = process.env.REMOVE_BG_API_KEY;

      if (
        !cloudName ||
        !cloudinaryApiKey ||
        !cloudinaryApiSecret ||
        !uploadPreset
      ) {
        res
          .status(500)
          .json({ error: "Cloudinary environment variables not set" });
        return;
      }

      if (!clipdropApiKey) {
        res.status(500).json({ error: "Clipdrop API key not set" });
        return;
      }

      // Get request data
      const { imageUrl } = req.body;

      if (!imageUrl) {
        res.status(400).json({ error: "imageUrl is required" });
        return;
      }

      console.log("Testing background removal for image:", imageUrl);

      // Download the image
      console.log("Downloading image...");
      const response = await fetch(imageUrl);
      if (!response.ok)
        throw new Error(`Failed to download image: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);
      console.log("Image downloaded, size:", imageBuffer.length, "bytes");

      // Remove background
      console.log("Removing background...");
      const formData = new FormData();
      const blob = new Blob([imageBuffer as any]);
      formData.append("image_file", blob, "image.jpg");

      const clipdropResponse = await fetch(
        "https://clipdrop-api.co/remove-background/v1",
        {
          method: "POST",
          headers: {
            "x-api-key": clipdropApiKey,
          },
          body: formData,
        },
      );

      if (!clipdropResponse.ok) {
        const error = await clipdropResponse.text();
        console.error("Clipdrop error:", error);
        throw new Error(
          `Clipdrop API failed: ${clipdropResponse.status} ${clipdropResponse.statusText} - ${error}`,
        );
      }

      const backgroundRemovedBuffer = await clipdropResponse.arrayBuffer();
      console.log(
        "Background removed, result size:",
        backgroundRemovedBuffer.byteLength,
        "bytes",
      );

      // Upload result to Cloudinary
      console.log("Uploading result...");
      const cloudinaryUrl = `${CLOUDINARY_BASE_URL}/${cloudName}/image/upload`;
      const cloudinaryForm = new FormData();
      cloudinaryForm.append(
        "file",
        new Blob([backgroundRemovedBuffer as any]),
        "image.png",
      );
      cloudinaryForm.append("api_key", cloudinaryApiKey);
      const timestamp = Math.round(new Date().getTime() / 1000).toString();
      cloudinaryForm.append("timestamp", timestamp);

      // Generate signature for signed upload
      const message = `timestamp=${timestamp}${cloudinaryApiSecret}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const hashBuffer = await crypto.subtle.digest("SHA-1", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signature = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      cloudinaryForm.append("signature", signature);

      const cloudinaryRes = await fetch(cloudinaryUrl, {
        method: "POST",
        body: cloudinaryForm as any,
      });

      if (!cloudinaryRes.ok) {
        const error = await cloudinaryRes.json();
        throw new Error(
          error?.error?.message || `Cloudinary ${cloudinaryRes.status}`,
        );
      }

      const cloudinaryJson = await cloudinaryRes.json();
      const finalImageUrl = cloudinaryJson.secure_url || cloudinaryJson.url;

      res.json({
        success: true,
        original_image_url: imageUrl,
        background_removed_image_url: finalImageUrl,
        message: "Background removal test completed successfully",
      });
    } catch (error) {
      console.error("Error in test background removal API:", error);
      res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return app;
}
