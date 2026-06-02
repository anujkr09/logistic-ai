const mongoose = require('mongoose');

const WarehouseSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    country: { type: String, default: '' },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },
    inventory: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    capacity: { type: Number, default: 0 },
    occupancy: { type: Number, default: 0 },
    incomingShipments: { type: Number, default: 0 },
    outgoingShipments: { type: Number, default: 0 },
    pendingShipments: { type: Number, default: 0 },
    hubDelayScore: { type: Number, default: 0 },
    riskLevel: { type: String, default: 'Low' },
  },
  { timestamps: true }
);

WarehouseSchema.index({ companyId: 1, 'location.coordinates': '2dsphere' });

module.exports = mongoose.model('Warehouse', WarehouseSchema);

