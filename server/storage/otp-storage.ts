import connectDB from '../database/connection';
import OTP from '../models/OTP';

// MongoDB-based OTP storage for production use
export const otpStorage = {
  async set(email: string, otp: string, expires: number): Promise<void> {
    try {
      await connectDB();
      
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
  },

  async get(email: string): Promise<{ otp: string; expires: number } | null> {
    try {
      await connectDB();
      
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
      await connectDB();
      await OTP.deleteOne({ email });
      console.log(`OTP deleted for ${email}`);
    } catch (error) {
      console.error('Error deleting OTP:', error);
    }
  }
};
