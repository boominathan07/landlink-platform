const mongoose = require('mongoose');

const plotSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },

  plotNumber: { type: String, required: true },
  plotNumberInt: { type: Number, default: 0 }, // for sorting

  // Extracted from image — each plot has its OWN unique values
  widthMeters:  { type: Number, default: null },
  lengthMeters: { type: Number, default: null },
  areaSqMeters: { type: Number, default: null },
  areaSqFeet:   { type: Number, default: null },
  cents:        { type: Number, default: null },
  needsReview:  { type: Boolean, default: false },

  // Backward compatibility aliases
  length: { type: Number, default: null },
  width: { type: Number, default: null },
  cent: { type: Number, default: null },
  areaSqft: { type: Number, default: null },
  price: { type: Number, default: 0 },

  // Grid layout
  gridPosition: { row: Number, col: Number },
  position: { x: Number, y: Number, width: Number, height: Number },

  rawText: { type: String, default: '' },
  extractedArea: { type: String, default: '' },

  plotType: {
    type: String,
    enum: ['regular', 'corner', 'road_facing', 'not_for_sale'],
    default: 'regular'
  },
  status: {
    type: String,
    enum: ['available', 'hold', 'booked', 'sold', 'not_for_sale'],
    default: 'available'
  },

  // Booking refs
  holdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  holdExpiry: { type: Date, default: null },
  bookedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },

}, { timestamps: true });

// Index for fast project queries sorted by plot number
plotSchema.index({ projectId: 1, plotNumberInt: 1 });
plotSchema.index({ projectId: 1, plotNumber: 1 }, { unique: true });

module.exports = mongoose.model('Plot', plotSchema);
