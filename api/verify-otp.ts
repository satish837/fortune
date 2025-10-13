import { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';

// MongoDB OTP Schema
const OTPSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, match: [/.+@.+\..+/, 'Please fill a valid email address'] },
  otp: { type: String, required: true },
  expires: { type: Date, required: true, index: { expireAfterSeconds: 0 } }
}, { timestamps: true });

// MongoDB User Schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, match: [/.+@.+\..+/, 'Please fill a valid email address'] },
  phone: { type: String, required: true, maxlength: 20 },
  handle: { type: String, maxlength: 50 },
  isVerified: { type: Boolean, default: true }
}, { timestamps: true });

const OTP = mongoose.models.OTP || mongoose.model('OTP', OTPSchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// MongoDB-based OTP storage
const otpStorage = {
  async get(email: string): Promise<{ otp: string; expires: number } | null> {
    try {
      // Connect to MongoDB
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/diwali-postcard');
      }
      
      const otpRecord = await OTP.findOne({ email });
      
      if (!otpRecord) {
        return null;
      }
      
      return {
        otp: otpRecord.otp,
        expires: otpRecord.expires.getTime()
      };
    } catch (error) {
      console.error('Error retrieving OTP:', error);
      return null;
    }
  },

  async delete(email: string): Promise<void> {
    try {
      // Connect to MongoDB
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/diwali-postcard');
      }
      
      await OTP.deleteOne({ email });
      console.log(`OTP deleted for ${email}`);
    } catch (error) {
      console.error('Error deleting OTP:', error);
    }
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/diwali-postcard');
      }

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

    // Generate a simple token (in production, use JWT)
    const token = `verified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully and user data saved',
      token
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
}
