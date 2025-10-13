#!/bin/bash

echo "🔧 Setting up local environment variables..."

# Create .env.local file for React app
cat > .env.local << EOF
# React App Environment Variables
REACT_APP_CLOUDINARY_CLOUD_NAME=dsol5tcu0
REACT_APP_CLOUDINARY_UPLOAD_PRESET=diwali_postcard

# Server Environment Variables (for local development)
FAL_KEY=your_fal_key_here
CLOUDINARY_CLOUD_NAME=dsol5tcu0
CLOUDINARY_API_KEY=your_cloudinary_api_key_here
CLOUDINARY_API_SECRET=your_cloudinary_api_secret_here
CLOUDINARY_UPLOAD_PRESET=diwali_postcard
REMOVE_BG_API_KEY=your_clipdrop_api_key_here
MONGODB_URI=your_mongodb_uri_here
BREVO_API_KEY=your_brevo_api_key_here
BREVO_SENDER_EMAIL=your_brevo_sender_email_here
EOF

echo "✅ Created .env.local file!"
echo "📝 Please update the values in .env.local with your actual API keys."
echo "🚀 You can now run 'pnpm dev' to start the development server."
