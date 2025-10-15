import { VercelRequest, VercelResponse } from '@vercel/node';
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

interface VideoGenerationRequest {
  personImageUrl: string;
  dishImageUrl: string;
  backgroundVideoUrl: string;
  greeting: string;
  width?: number;
  height?: number;
  duration?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      personImageUrl,
      dishImageUrl,
      backgroundVideoUrl,
      greeting,
      width = 720,
      height = 1280,
      duration = 5
    }: VideoGenerationRequest = req.body;

    if (!personImageUrl || !dishImageUrl || !backgroundVideoUrl) {
      return res.status(400).json({ 
        error: 'personImageUrl, dishImageUrl, and backgroundVideoUrl are required' 
      });
    }

    console.log('🎬 Starting video generation...');
    console.log('Person image:', personImageUrl);
    console.log('Dish image:', dishImageUrl);
    console.log('Background video:', backgroundVideoUrl);

    // Create a unique filename for this image
    const timestamp = Date.now();
    const imageFilename = `postcard-${timestamp}.png`;

    // Load images
    const personImage = await loadImage(personImageUrl);
    const dishImage = await loadImage(dishImageUrl);

    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Calculate positions and sizes
    const framePadding = 40;
    const frameWidth = width - (framePadding * 2);
    const frameHeight = height - (framePadding * 2);

    // Person image dimensions (centered in frame)
    const personAspectRatio = personImage.width / personImage.height;
    const personMaxWidth = frameWidth * 0.6;
    const personMaxHeight = frameHeight * 0.7;
    
    let personWidth = personMaxWidth;
    let personHeight = personMaxWidth / personAspectRatio;
    
    if (personHeight > personMaxHeight) {
      personHeight = personMaxHeight;
      personWidth = personMaxHeight * personAspectRatio;
    }

    const personX = (width - personWidth) / 2;
    const personY = (height - personHeight) / 2 - 50;

    // Dish image dimensions (smaller, positioned below person)
    const dishAspectRatio = dishImage.width / dishImage.height;
    const dishMaxWidth = frameWidth * 0.3;
    const dishMaxHeight = frameHeight * 0.2;
    
    let dishWidth = dishMaxWidth;
    let dishHeight = dishMaxWidth / dishAspectRatio;
    
    if (dishHeight > dishMaxHeight) {
      dishHeight = dishMaxHeight;
      dishWidth = dishMaxHeight * dishAspectRatio;
    }

    const dishX = (width - dishWidth) / 2;
    const dishY = personY + personHeight - 100;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background (solid color for now, could be enhanced with actual background video)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw decorative border
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 8;
    ctx.strokeRect(framePadding, framePadding, frameWidth, frameHeight);

    // Draw inner border
    ctx.strokeStyle = '#ffa500';
    ctx.lineWidth = 4;
    ctx.strokeRect(framePadding + 10, framePadding + 10, frameWidth - 20, frameHeight - 20);

    // Draw person image
    ctx.drawImage(personImage, personX, personY, personWidth, personHeight);

    // Draw dish image
    ctx.drawImage(dishImage, dishX, dishY, dishWidth, dishHeight);

    // Draw greeting text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(greeting, width / 2, height - 60);

    console.log('✅ Image created successfully');

    // Get the image buffer
    const imageBuffer = canvas.toBuffer('image/png');

    // Set response headers for image download
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${imageFilename}"`);
    res.setHeader('Content-Length', imageBuffer.length);

    // Send the image
    res.send(imageBuffer);

  } catch (error) {
    console.error('❌ Video generation error:', error);
    res.status(500).json({ 
      error: 'Video generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
