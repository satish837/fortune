import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.TINYPNG_API_KEY;

    if (!apiKey) {
      console.error('TinyPNG API key not found in environment variables');
      return res.status(500).json({ 
        error: 'TinyPNG configuration missing',
        hasApiKey: false
      });
    }

    res.status(200).json({
      hasApiKey: true,
      apiKey: apiKey
    });
  } catch (error) {
    console.error('Error fetching TinyPNG config:', error);
    res.status(500).json({ 
      error: 'Failed to fetch TinyPNG configuration',
      hasApiKey: false
    });
  }
}
