#!/bin/bash

# Set React App Cloudinary environment variables for Vercel
echo "Setting React App Cloudinary environment variables..."

# Set REACT_APP_CLOUDINARY_CLOUD_NAME
echo "dsol5tcu0" | vercel env add REACT_APP_CLOUDINARY_CLOUD_NAME production

# Set REACT_APP_CLOUDINARY_UPLOAD_PRESET  
echo "diwali_postcard" | vercel env add REACT_APP_CLOUDINARY_UPLOAD_PRESET production

echo "Environment variables set successfully!"
