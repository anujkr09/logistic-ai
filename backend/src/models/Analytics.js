const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    type: { type: String, enum: ['shipment_performance', 'revenue_summary', 'fraud_summary'], default: 'shipment_performance' },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Optional cached aggregation time
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Analytics', AnalyticsSchema);

