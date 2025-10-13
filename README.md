# 🎆 Diwali Fortune Image Generator

A production-ready full-stack React application that generates personalized Diwali postcards with AI-powered image transformation and video creation capabilities.

## 🌟 Features

### 🖼️ Image Generation
- **AI-Powered Transformation**: Uses FAL AI and FLUX Kontext for intelligent image processing
- **Face Preservation**: Advanced algorithms ensure faces are never cropped or distorted
- **TinyPNG Optimization**: Automatic image compression for faster processing and better performance
- **Background Removal**: Cloudinary-powered background removal for clean, professional results

### 🎬 Video Creation
- **10-Second Videos**: Generate engaging short videos with canvas-record library
- **WhatsApp Compatible**: Optimized video encoding for seamless sharing
- **Mobile Optimized**: Special handling for mobile devices with MediaRecorder fallback
- **Social Media Ready**: Videos optimized for all major social platforms

### 🔐 User Authentication
- **OTP Verification**: Secure email-based authentication using Brevo
- **MongoDB Integration**: User data stored securely in MongoDB Atlas
- **Session Management**: Persistent login sessions with proper security

### 📊 Analytics & Tracking
- **Meta Pixel Integration**: Facebook advertising and conversion tracking
- **Google Tag Manager**: Comprehensive analytics and event tracking
- **Custom Events**: Track user interactions and conversions

## 🚀 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Radix UI** component library
- **React Router 6** for navigation

### Backend
- **Express.js** server
- **Vercel Serverless Functions** for production
- **MongoDB Atlas** database
- **Mongoose** ODM

### AI & Image Processing
- **FAL AI** for image transformation
- **FLUX Kontext** for style changes
- **TinyPNG API** for image optimization
- **Cloudinary** for image/video hosting

### Video Processing
- **canvas-record** library for video generation
- **MediaRecorder API** for mobile compatibility
- **FFmpeg.wasm** fallback support

## 📁 Project Structure

```
├── client/                 # React frontend
│   ├── pages/             # Route components
│   ├── components/ui/     # UI component library
│   ├── hooks/            # Custom React hooks
│   └── lib/              # Utility functions
├── server/               # Express backend
│   ├── routes/           # API route handlers
│   ├── models/           # Database models
│   └── database/         # Database connection
├── api/                  # Vercel serverless functions
├── shared/               # Shared types and interfaces
└── public/               # Static assets
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm
- MongoDB Atlas account
- Vercel account (for deployment)

### Environment Variables

Create a `.env` file in the root directory:

```env
# FAL AI Configuration
FAL_KEY=your_fal_ai_key

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLOUDINARY_UPLOAD_PRESET=your_cloudinary_upload_preset

# TinyPNG Configuration
TINYPNG_API_KEY=your_tinypng_api_key

# Brevo Email Configuration
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=your_sender_email

# MongoDB Configuration
MONGODB_URI=your_mongodb_connection_string

# React App Environment Variables
REACT_APP_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
REACT_APP_CLOUDINARY_UPLOAD_PRESET=your_cloudinary_upload_preset
```

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/satish837/fortune.git
   cd fortune
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Start development server**
   ```bash
   pnpm dev
   ```

5. **Open in browser**
   ```
   http://localhost:8080
   ```

### Production Deployment

1. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

2. **Set environment variables in Vercel**
   ```bash
   vercel env add FAL_KEY production
   vercel env add CLOUDINARY_CLOUD_NAME production
   # ... add all other environment variables
   ```

## 🎯 Usage

### Image Generation Flow
1. **Upload Photo**: User uploads their photo (automatically optimized with TinyPNG)
2. **Choose Dish**: Select from 12 traditional Diwali dishes
3. **Select Background**: Pick from 5 festive video backgrounds
4. **Add Greeting**: Enter personalized message (75 character limit)
5. **Generate**: AI processes the image with face preservation
6. **Download/Share**: Get optimized image or video

### Video Generation Flow
1. **Record Video**: 10-second video with chosen background
2. **Optimize**: WhatsApp-compatible encoding
3. **Upload**: Automatic Cloudinary upload
4. **Share**: Social media sharing with optimized URLs

## 🔧 API Endpoints

### Image Processing
- `POST /api/generate` - Generate AI-transformed image
- `GET /api/tinypng-config` - Get TinyPNG configuration
- `POST /api/upload-video` - Upload video to Cloudinary

### User Management
- `POST /api/send-otp` - Send OTP to new user
- `POST /api/verify-otp` - Verify OTP and create user
- `POST /api/existing-user-otp` - Send OTP to existing user
- `GET /api/users` - Get all users (admin)

### Configuration
- `GET /api/cloudinary-config` - Get Cloudinary configuration
- `GET /api/test-env` - Test environment variables

## 📱 Mobile Optimization

- **Responsive Design**: Works seamlessly on all device sizes
- **Touch-Friendly**: Optimized for mobile interactions
- **Video Compatibility**: Special handling for mobile video generation
- **Performance**: Optimized for mobile network conditions

## 🔒 Security Features

- **API Key Protection**: All sensitive keys stored in environment variables
- **OTP Verification**: Secure email-based authentication
- **Input Validation**: Comprehensive validation on all inputs
- **Rate Limiting**: Protection against abuse
- **CORS Configuration**: Proper cross-origin resource sharing

## 📊 Analytics Integration

### Meta Pixel Events
- `InitiateCheckout` - User starts image generation
- `Purchase` - Successful image/video generation
- `Share` - Social media sharing events

### Google Tag Manager Events
- `image_generation_start` - Image generation begins
- `image_generation_complete` - Image generation completes
- `video_generation_start` - Video generation begins
- `video_generation_complete` - Video generation completes
- `social_share` - Social sharing events

## 🚀 Performance Optimizations

- **Image Optimization**: TinyPNG compression reduces file sizes by 60-80%
- **Lazy Loading**: Components loaded on demand
- **Code Splitting**: Optimized bundle sizes
- **CDN Integration**: Cloudinary CDN for fast asset delivery
- **Caching**: Strategic caching for better performance

## 🐛 Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**
   - Check Vercel environment variable configuration
   - Verify `.env` file exists locally

2. **Image Generation Fails**
   - Verify FAL AI API key is valid
   - Check API quota and billing

3. **Video Not Playing on Mobile**
   - Ensure WhatsApp-compatible encoding
   - Check file size limits

4. **Database Connection Issues**
   - Verify MongoDB Atlas connection string
   - Check network connectivity

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For support, email support@example.com or create an issue in the GitHub repository.

## 🙏 Acknowledgments

- [FAL AI](https://fal.ai/) for image processing capabilities
- [Cloudinary](https://cloudinary.com/) for image and video hosting
- [TinyPNG](https://tinypng.com/) for image optimization
- [Brevo](https://www.brevo.com/) for email services
- [Vercel](https://vercel.com/) for hosting and deployment

---

**Made with ❤️ for Diwali celebrations**
