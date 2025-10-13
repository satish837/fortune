#!/bin/bash

echo "🚀 Setting up Brevo Email Service for OTP Verification"
echo "=================================================="

echo ""
echo "📧 To use Brevo for sending OTP emails, you need to:"
echo ""
echo "1. Create a Brevo account at: https://www.brevo.com/"
echo "2. Get your API key from: https://app.brevo.com/settings/keys/api"
echo "3. Set up a sender email address in your Brevo account"
echo "4. Add the following environment variables:"
echo ""

echo "🔑 Required Environment Variables:"
echo "BREVO_API_KEY=your_brevo_api_key_here"
echo "BREVO_SENDER_EMAIL=your_verified_sender_email@yourdomain.com"
echo ""

echo "📝 Add these to your .env file:"
echo "echo 'BREVO_API_KEY=your_brevo_api_key_here' >> .env"
echo "echo 'BREVO_SENDER_EMAIL=your_verified_sender_email@yourdomain.com' >> .env"
echo ""

echo "🌐 For Vercel deployment, add these in your Vercel dashboard:"
echo "- Go to your project settings"
echo "- Navigate to Environment Variables"
echo "- Add BREVO_API_KEY and BREVO_SENDER_EMAIL"
echo ""

echo "✅ Once configured, your OTP emails will be sent via Brevo!"
echo "   Fallback: OTP will still be logged to console for development"
