import { Request, Response } from "express";

interface VideoGenerationRequest {
  personImageUrl: string;
  dishImageUrl: string;
  backgroundVideoUrl: string;
  greeting: string;
  width?: number;
  height?: number;
  duration?: number;
}

export const handleGenerateVideo = async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📥 Received request body:', req.body);
    console.log('📥 Request body type:', typeof req.body);
    console.log('📥 Request body keys:', Object.keys(req.body || {}));

    const {
      personImageUrl,
      dishImageUrl,
      backgroundVideoUrl,
      greeting,
      width = 720,
      height = 1280,
      duration = 5
    }: VideoGenerationRequest = req.body;

    console.log('📥 Extracted values:');
    console.log('  personImageUrl:', personImageUrl);
    console.log('  dishImageUrl:', dishImageUrl);
    console.log('  backgroundVideoUrl:', backgroundVideoUrl);
    console.log('  greeting:', greeting);

    if (!personImageUrl || !dishImageUrl || !backgroundVideoUrl) {
      console.log('❌ Missing required fields:');
      console.log('  personImageUrl missing:', !personImageUrl);
      console.log('  dishImageUrl missing:', !dishImageUrl);
      console.log('  backgroundVideoUrl missing:', !backgroundVideoUrl);
      
      return res.status(400).json({ 
        error: 'personImageUrl, dishImageUrl, and backgroundVideoUrl are required',
        received: {
          personImageUrl: !!personImageUrl,
          dishImageUrl: !!dishImageUrl,
          backgroundVideoUrl: !!backgroundVideoUrl
        }
      });
    }

    console.log('🎬 Video generation request received...');
    console.log('Person image:', personImageUrl);
    console.log('Dish image:', dishImageUrl);
    console.log('Background video:', backgroundVideoUrl);
    console.log('Greeting:', greeting);

    // For now, just return a success response
    // The actual image generation will be handled client-side
    res.json({
      success: true,
      message: 'Video generation request received',
      data: {
        personImageUrl,
        dishImageUrl,
        backgroundVideoUrl,
        greeting,
        width,
        height,
        duration
      }
    });

  } catch (error) {
    console.error('❌ Video generation error:', error);
    res.status(500).json({ 
      error: 'Video generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
