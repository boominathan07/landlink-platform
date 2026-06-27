const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    plotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plot', required: true },
    brokerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customerName: { type: String, required: true },
    customerPhone: String,
    customerAddress: String,
    advanceAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    paymentMode: {
      type: String,
      enum: ['cash', 'cheque', 'bank_transfer', 'upi'],
      default: 'cash',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'pending',
    },
    commissionPercent: Number,
    commissionAmount: Number,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    completedAt: Date,
    notes: String,
    rejectReason: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
