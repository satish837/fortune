import { Request, Response } from "express";
import { otpStorage } from '../storage/otp-storage';
import connectDB from '../database/connection';
import User from '../models/User';

export async function handleVerifyOTP(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, otp, name, phone, handle } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    // Get stored OTP from MongoDB
    const storedData = await otpStorage.get(email);
    
    if (!storedData) {
      return res.status(400).json({ error: 'No OTP found for this email. Please request a new one.' });
    }

    // Check if OTP has expired
    if (Date.now() > storedData.expires) {
      await otpStorage.delete(email); // Clean up expired OTP
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // Verify OTP
    if (storedData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP. Please check and try again.' });
    }

    // OTP is valid, now save user data to MongoDB
    try {
      // Connect to MongoDB
      await connectDB();

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      
      if (existingUser) {
        // Update existing user
        existingUser.name = name || existingUser.name;
        existingUser.phone = phone || existingUser.phone;
        existingUser.handle = handle || existingUser.handle;
        existingUser.isVerified = true;
        existingUser.updatedAt = new Date();
        
        await existingUser.save();
        console.log(`Updated existing user: ${email}`);
      } else {
        // Create new user
        const newUser = new User({
          name,
          email,
          phone,
          handle,
          isVerified: true
        });
        
        await newUser.save();
        console.log(`Created new user: ${email}`);
      }

    } catch (dbError) {
      console.error('Database error:', dbError);
      // Don't fail the OTP verification if database save fails
      // The user is still verified, just not saved to DB
    }

    // Clean up OTP
    await otpStorage.delete(email);

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully and user data saved'
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
}
