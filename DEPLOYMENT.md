# Vercel Deployment Guide

This guide will help you deploy your Pulse Zone project to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Push your code to GitHub
3. **Environment Variables**: Have your API keys ready

## Environment Variables

You'll need to set these environment variables in Vercel:

### Required Variables:
- `FAL_KEY` - Your FAL AI API key
- `CLOUDINARY_CLOUD_NAME` - Your Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Your Cloudinary API key
- `CLOUDINARY_API_SECRET` - Your Cloudinary API secret
- `CLOUDINARY_UPLOAD_PRESET` - Your Cloudinary upload preset

### Optional Variables:
- `PING_MESSAGE` - Custom ping message (default: "ping")

## Deployment Steps

### Method 1: Vercel CLI (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from project directory**:
   ```bash
   cd /path/to/pulse-zone
   vercel
   ```

4. **Follow the prompts**:
   - Link to existing project or create new
   - Set up environment variables
   - Deploy

### Method 2: GitHub Integration

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Configure settings

3. **Set Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add all required variables
   - Redeploy

## Configuration Files

The following files are configured for Vercel deployment:

- `vercel.json` - Vercel configuration
- `api/` - Serverless API functions
- `.vercelignore` - Files to exclude from deployment

## API Endpoints

After deployment, your API will be available at:
- `https://your-project.vercel.app/api/ping`
- `https://your-project.vercel.app/api/demo`
- `https://your-project.vercel.app/api/generate`

## Troubleshooting

### Common Issues:

1. **Build Failures**:
   - Check that all dependencies are in `package.json`
   - Ensure TypeScript compilation passes
   - Check Vercel build logs

2. **API Errors**:
   - Verify environment variables are set
   - Check API key validity
   - Review function logs in Vercel dashboard

3. **Static Files Not Loading**:
   - Ensure `outputDirectory` is set to `dist/spa`
   - Check that build command runs successfully

### Debug Commands:

```bash
# Test build locally
npm run vercel-build

# Check TypeScript
npm run typecheck

# Test API locally
vercel dev
```

## Post-Deployment

1. **Test all endpoints**:
   - Visit your deployed URL
   - Test image generation
   - Verify video recording works

2. **Monitor performance**:
   - Check Vercel analytics
   - Monitor function execution times
   - Watch for errors in logs

3. **Set up custom domain** (optional):
   - Go to Project Settings → Domains
   - Add your custom domain
   - Configure DNS records

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Review this guide
3. Check the Vercel documentation
4. Contact support if needed

Happy deploying! 🚀
