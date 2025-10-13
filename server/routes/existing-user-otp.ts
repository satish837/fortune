import { Request, Response } from "express";
import * as brevo from '@getbrevo/brevo';
import { otpStorage } from '../storage/otp-storage';
import connectDB from '../database/connection';
import User from '../models/User';

// Initialize Brevo API client
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY || '');

export async function handleExistingUserOTP(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists in database
    try {
      await connectDB();
      const existingUser = await User.findOne({ email });
      
      if (!existingUser) {
        return res.status(404).json({ error: 'User not found. Please register first.' });
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store OTP
      await otpStorage.set(email, otp, expires);

      try {
        // Send OTP via Brevo transactional email
        const sendSmtpEmail = new brevo.SendSmtpEmail();

        sendSmtpEmail.subject = "Welcome Back - Verify your email for Diwali Postcard";
        sendSmtpEmail.htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome Back - Email Verification</title>
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
                <h1>🎆 Welcome Back!</h1>
                <p>Verify your email to continue creating beautiful postcards!</p>
              </div>
              <div class="content">
                <h2>Hi ${existingUser.name}!</h2>
                <p>Welcome back to the Diwali Postcard Creator! We're excited to help you create more beautiful festive postcards.</p>
                <p>To continue, please use the verification code below:</p>

                <div class="otp-code">${otp}</div>

                <p><strong>Important:</strong></p>
                <ul>
                  <li>This code will expire in 10 minutes</li>
                  <li>Enter this code exactly as shown</li>
                  <li>If you didn't request this, please ignore this email</li>
                </ul>

                <p>Once verified, you'll be able to continue creating your personalized Diwali postcards with AI-powered magic!</p>
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
          Welcome Back to Diwali Postcard Creator!

          Hi ${existingUser.name},

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

        sendSmtpEmail.to = [{ email: email, name: existingUser.name }];

        // Send the email
        const result = await apiInstance.sendTransacEmail(sendSmtpEmail);

        console.log(`OTP email sent successfully to existing user ${email}. Message ID: ${result.messageId}`);

      } catch (emailError) {
        console.error('Error sending OTP email:', emailError);

        // Fallback: Log OTP to console for development
        console.log(`OTP for existing user ${email}: ${otp}`);
        console.log(`OTP expires at: ${new Date(expires).toISOString()}`);

        // Don't fail the request if email sending fails
      }

      res.status(200).json({
        success: true,
        message: 'OTP sent successfully to existing user',
        userData: {
          name: existingUser.name,
          email: existingUser.email,
          phone: existingUser.phone,
          handle: existingUser.handle
        },
        // In development, include OTP in response for testing
        ...(process.env.NODE_ENV === 'development' && { otp })
      });

    } catch (dbError) {
      console.error('Database error:', dbError);
      res.status(500).json({ error: 'Database error. Please try again.' });
    }

  } catch (error) {
    console.error('Error handling existing user OTP:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
}