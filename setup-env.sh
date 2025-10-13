#!/bin/bash

echo "🔧 Setting up environment variables for Vercel deployment..."

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Please install it first:"
    echo "   npm i -g vercel"
    exit 1
fi

# Check if we're logged in
if ! vercel whoami > /dev/null 2>&1; then
    echo "❌ Not logged in to Vercel. Please run 'vercel login' first."
    exit 1
fi

echo "📝 Setting up environment variables..."

# Set environment variables
vercel env add FAL_KEY
vercel env add CLOUDINARY_CLOUD_NAME
vercel env add CLOUDINARY_API_KEY
vercel env add CLOUDINARY_API_SECRET
vercel env add CLOUDINARY_UPLOAD_PRESET
vercel env add REMOVE_BG_API_KEY

# Set React app environment variables
vercel env add REACT_APP_CLOUDINARY_CLOUD_NAME
vercel env add REACT_APP_CLOUDINARY_UPLOAD_PRESET

echo "✅ Environment variables set up!"
echo "🚀 You can now run './deploy.sh' to deploy your project."
