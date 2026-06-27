const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'booking_request',
        'booking_approved',
        'booking_rejected',
        'plot_sold',
        'commission_earned',
        'broker_invited',
        'broker_accepted',
        'broker_declined',
        'broker_joined',
        'hold_expired',
        'document_uploaded',
      ],
      required: true,
    },
    title: String,
    message: String,
    data: mongoose.Schema.Types.Mixed,
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
