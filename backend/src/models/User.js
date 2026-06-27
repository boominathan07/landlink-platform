const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    role: { type: String, enum: ['owner', 'broker'], default: 'owner' },
    avatar: { type: String, default: '' },
    password: { type: String },
    plan: { type: String, enum: ['free', 'pro', 'agency'], default: 'free' },
    planExpiresAt: Date,
    razorpaySubscriptionId: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
