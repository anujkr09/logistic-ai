const mongoose = require('mongoose');

const ShipmentHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    location: {
      text: { type: String, default: '' },
      city: { type: String, default: '' },
      country: { type: String, default: '' },
      coordinates: { type: [Number], default: undefined }, // [lng, lat]
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const ShipmentSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null, index: true },
    trackingNumber: { type: String, required: true, unique: true, index: true },

    origin: {
      text: { type: String, default: '' },
      city: { type: String, default: '' },
      country: { type: String, default: '' },
      coordinates: { type: [Number], default: undefined },
    },
    destination: {
      text: { type: String, default: '' },
      city: { type: String, default: '' },
      country: { type: String, default: '' },
      coordinates: { type: [Number], default: undefined },
    },

    currentLocation: {
      text: { type: String, default: '' },
      city: { type: String, default: '' },
      country: { type: String, default: '' },
      coordinates: { type: [Number], default: undefined },
    },

    status: { type: String, default: 'Created', index: true },
    estimatedDelivery: { type: Date, default: null },

    history: { type: [ShipmentHistorySchema], default: [] },

    fraud: {
      isFlagged: { type: Boolean, default: false },
      riskScore: { type: Number, default: 0 },
      alerts: { type: [String], default: [] },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Shipment', ShipmentSchema);

