const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['legal', 'plans', 'approvals', 'marketing', 'other', 'patta', 'chitta', 'ec', 'layout', 'sale_deed'],
      default: 'other',
    },
    fileUrl: { type: String, required: true },
    fileSize: Number,
    accessLevel: {
      type: String,
      enum: ['owners_only', 'brokers_visible'],
      default: 'owners_only',
    },
    viewLog: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, viewedAt: Date }],
    expiryDate: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', documentSchema);
