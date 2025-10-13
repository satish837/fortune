import { VercelRequest, VercelResponse } from '@vercel/node';
import * as brevo from '@getbrevo/brevo';
import mongoose from 'mongoose';

// Import the OTP model from the shared models
const OTPSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, match: [/.+@.+\..+/, 'Please fill a valid email address'] },
  otp: { type: String, required: true },
  expires: { type: Date, required: true, index: { expireAfterSeconds: 0 } }
}, { timestamps: true });

const OTP = mongoose.models.OTP || mongoose.model('OTP', OTPSchema);

// MongoDB-based OTP storage
const otpStorage = {
  async set(email: string, otp: string, expires: number): Promise<void> {
    try {
      // Connect to MongoDB
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/diwali-postcard');
      }
      
      // Remove any existing OTP for this email
      await OTP.deleteOne({ email });
      
      // Create new OTP record
      const otpRecord = new OTP({
        email,
        otp,
        expires: new Date(expires)
      });
      
      await otpRecord.save();
      console.log(`OTP stored for ${email}, expires at ${new Date(expires).toISOString()}`);
    } catch (error) {
      console.error('Error storing OTP:', error);
      throw error;
    }
  }
};

// Initialize Brevo API client
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY || '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP in MongoDB
    await otpStorage.set(email, otp, expires);

    try {
      // Send OTP via Brevo transactional email
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      
      sendSmtpEmail.subject = "Verify your email for Diwali Postcard";
      sendSmtpEmail.htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-code { background: #fff; border: 2px solid #f97316; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; font-size: 32px; font-weight: bold; color: #f97316; letter-spacing: 5px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .logo { max-width: 150px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎆 Diwali Postcard Creator</h1>
              <p>Verify your email to get started!</p>
            </div>
            <div class="content">
              <h2>Hi ${name}!</h2>
              <p>Welcome to the Diwali Postcard Creator! We're excited to help you create beautiful festive postcards.</p>
              <p>To complete your registration, please use the verification code below:</p>
              
              <div class="otp-code">${otp}</div>
              
              <p><strong>Important:</strong></p>
              <ul>
                <li>This code will expire in 10 minutes</li>
                <li>Enter this code exactly as shown</li>
                <li>If you didn't request this, please ignore this email</li>
              </ul>
              
              <p>Once verified, you'll be able to create your personalized Diwali postcard with AI-powered magic!</p>
            </div>
            <div class="footer">
              <p>© 2025 AWL Agri Business Ltd. All rights reserved.</p>
              <p>This is an automated message, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      sendSmtpEmail.textContent = `
        Welcome to Diwali Postcard Creator!
        
        Hi ${name},
        
        Your verification code is: ${otp}
        
        This code will expire in 10 minutes.
        
        If you didn't request this, please ignore this email.
        
        Best regards,
        Diwali Postcard Creator Team
      `;
      
      sendSmtpEmail.sender = {
        name: "Diwali Postcard Creator",
        email: process.env.BREVO_SENDER_EMAIL || "noreply@diwalipostcard.com"
      };
      
      sendSmtpEmail.to = [{ email: email, name: name }];
      
      // Send the email
      const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
      
      console.log(`OTP email sent successfully to ${email}. Message ID: ${result.messageId}`);
      
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      
      // Fallback: Log OTP to console for development
      console.log(`OTP for ${email}: ${otp}`);
      console.log(`OTP expires at: ${new Date(expires).toISOString()}`);
      
      // Don't fail the request if email sending fails
      // In production, you might want to handle this differently
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      // In development, include OTP in response for testing
      ...(process.env.NODE_ENV === 'development' && { otp })
    });

  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
}
