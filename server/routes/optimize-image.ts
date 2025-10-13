import { RequestHandler } from "express";

export const handleOptimizeImage: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.TINYPNG_API_KEY;
    if (!apiKey) {
      console.error("TinyPNG API key missing");
      return res.status(500).json({ error: "TinyPNG API key not configured" });
    }

    const { dataUrl } = req.body;
    if (!dataUrl || typeof dataUrl !== "string") {
      return res.status(400).json({ error: "dataUrl (base64) is required" });
    }

    // Extract base64 data
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: "Invalid dataUrl format" });
    }

    const mimeType = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, "base64");

    // Call TinyPNG shrink endpoint
    const auth = Buffer.from(`api:${apiKey}`).toString("base64");
    const tinifyRes = await fetch("https://api.tinify.com/shrink", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/octet-stream",
      },
      body: buffer,
    });

    if (!tinifyRes.ok) {
      const text = await tinifyRes.text();
      console.error("TinyPNG shrink failed:", tinifyRes.status, text);
      return res
        .status(500)
        .json({ error: "TinyPNG shrink failed", details: text });
    }

    const shrinkJson = await tinifyRes.json();
    // The TinyPNG API provides an output.url to download optimized image
    const outputUrl = shrinkJson?.output?.url;
    if (!outputUrl) {
      console.error("TinyPNG shrink returned no output URL", shrinkJson);
      return res.status(500).json({ error: "TinyPNG returned no output URL" });
    }

    const optimizedRes = await fetch(outputUrl);
    if (!optimizedRes.ok) {
      const text = await optimizedRes.text();
      console.error(
        "Failed to download optimized image:",
        optimizedRes.status,
        text,
      );
      return res
        .status(500)
        .json({ error: "Failed to download optimized image", details: text });
    }

    const optimizedBuffer = await optimizedRes.arrayBuffer();
    const optimizedBase64 = Buffer.from(optimizedBuffer).toString("base64");
    const dataUrlOut = `data:${mimeType};base64,${optimizedBase64}`;

    res.json({ success: true, dataUrl: dataUrlOut });
  } catch (error) {
    console.error("Error in optimize-image handler:", error);
    res
      .status(500)
      .json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      });
  }
};
