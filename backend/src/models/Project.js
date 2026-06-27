const mongoose = require('mongoose');

const ownerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownershipPercent: { type: Number, default: 100 },
  status: { type: String, enum: ['active', 'invited'], default: 'active' },
});

const brokerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  commissionPercent: { type: Number, default: 2 },
  status: { type: String, enum: ['active', 'invited', 'revoked', 'expired'], default: 'invited' },
  invitedAt: { type: Date, default: Date.now },
  invitePhone: { type: String, default: '' },
  inviteName: { type: String, default: '' },
  inviteEmail: { type: String, default: '' },
});

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    location: {
      district: String,
      address: String,
    },
    totalArea: Number,
    pricePerSqft: Number,
    pricePerCent: { type: Number, default: 10000 },
    owners: [ownerSchema],
    brokers: [brokerSchema],
    pdfUrl: String,
    imageUrl: String,
    layoutImageUrl: { type: String, default: null },
    layoutPublicId: { type: String, default: null },
    layoutUpdatedAt: { type: Date, default: null },
    layoutWidth: Number,
    layoutHeight: Number,
    detectedPlotsPreview: { type: mongoose.Schema.Types.Mixed, default: null },
    totalPlots: { type: Number, default: 0 },
    gridCols: { type: Number, default: 10 },
    gridRows: { type: Number, default: 1 },
    mapData: {
      plots: [
        {
          plotNumber: String,
          type: { type: String, enum: ['rectangle', 'polygon'], default: 'rectangle' },
          x: Number,
          y: Number,
          width: Number,
          height: Number,
          points: [[Number]], // For polygons
          areaSqft: Number,
          facing: String,
        }
      ],
      roads: [
        { label: String, x: Number, y: Number, width: Number, height: Number, angle: Number }
      ],
      commonAreas: [
        { label: String, x: Number, y: Number, width: Number, height: Number, type: String }
      ],
      config: {
        originalWidth: Number,
        originalHeight: Number,
      }
    },
    status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);
