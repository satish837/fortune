#!/bin/bash

echo "🚀 Deploying Pulse Zone to Vercel..."

# Check if we're logged in to Vercel
if ! vercel whoami > /dev/null 2>&1; then
    echo "❌ Not logged in to Vercel. Please run 'vercel login' first."
    exit 1
fi

# Build the project
echo "📦 Building project..."
npm run vercel-build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please check the errors above."
    exit 1
fi

echo "✅ Build successful!"

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
vercel --prod

if [ $? -eq 0 ]; then
    echo "🎉 Deployment successful!"
    echo "📝 Don't forget to set your environment variables in the Vercel dashboard:"
    echo "   - FAL_KEY"
    echo "   - CLOUDINARY_CLOUD_NAME"
    echo "   - CLOUDINARY_API_KEY"
    echo "   - CLOUDINARY_API_SECRET"
    echo "   - CLOUDINARY_UPLOAD_PRESET"
else
    echo "❌ Deployment failed. Please check the errors above."
    exit 1
fi
