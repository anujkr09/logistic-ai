const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    type: { type: String, enum: ['shipment_update', 'fraud_alert', 'system'], default: 'shipment_update' },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    readAt: { type: Date, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', NotificationSchema);

