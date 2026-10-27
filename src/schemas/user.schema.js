import mongoose from 'mongoose';

export const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, default: null, select: false },
    googleId: { type: String, unique: true, sparse: true, select: false },
    avatarUrl: { type: String, default: null },
    emailVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);
