import mongoose, { Document, Schema } from 'mongoose';

export interface IOTP extends Document {
  email: string;
  otp: string;
  expires: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OTPSchema: Schema = new Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    match: [/.+@.+\..+/, 'Please fill a valid email address'],
  },
  otp: {
    type: String,
    required: [true, 'OTP is required'],
    length: [6, 'OTP must be exactly 6 digits'],
  },
  expires: {
    type: Date,
    required: [true, 'Expiry date is required'],
    index: { expireAfterSeconds: 0 }, // MongoDB TTL index
  }
}, {
  timestamps: true
});

// Indexes are automatically created by unique: true and TTL index above

export default mongoose.models.OTP || mongoose.model<IOTP>('OTP', OTPSchema);
