const mongoose = require('mongoose');

const userSettingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  theme: { type: String, enum: ['light', 'dark', 'system'], default: 'dark' },
  language: { type: String, enum: ['English', 'Tamil', 'Hindi'], default: 'English' },
  notifications: {
    bookings: { type: Boolean, default: true },
    analytics: { type: Boolean, default: true },
    documents: { type: Boolean, default: true }
  }
}, { timestamps: true });

module.exports = mongoose.model('UserSettings', userSettingsSchema);
