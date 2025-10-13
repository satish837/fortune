import { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';

// MongoDB User Schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, match: [/.+@.+\..+/, 'Please fill a valid email address'] },
  phone: { type: String, required: true, maxlength: 20 },
  handle: { type: String, maxlength: 50 },
  isVerified: { type: Boolean, default: true }
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Connect to MongoDB
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/diwali-postcard');
    }

    // Fetch all users from MongoDB
    const users = await User.find({}).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      users: users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        handle: user.handle,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }))
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}
