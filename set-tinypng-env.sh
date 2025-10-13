#!/bin/bash

# Set TinyPNG API key in Vercel environment variables
echo "Setting TinyPNG API key in Vercel..."

# Set the TinyPNG API key
vercel env add TINYPNG_API_KEY production

echo "TinyPNG API key has been set in Vercel environment variables."
echo "You can verify this by running: vercel env ls"
