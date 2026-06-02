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
    description: { type: String, default: '' },
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

    shipmentType: { type: String, default: 'Standard' },
    priority: { type: String, default: 'Normal' },
    weight: { type: Number, default: 0 },
    dimensions: {
      length: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
      unit: { type: String, default: 'cm' },
    },
    packageCount: { type: Number, default: 1 },

    sender: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      address: { type: String, default: '' },
      contactName: { type: String, default: '' },
    },
    receiver: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    driver: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      licenseNumber: { type: String, default: '' },
      status: { type: String, default: 'Available' },
    },
    vehicle: {
      number: { type: String, default: '' },
      type: { type: String, default: '' },
      fuelStatus: { type: String, default: '' },
      speedKmph: { type: Number, default: 0 },
    },
    gpsDeviceId: { type: String, default: '' },
    routeCode: { type: String, default: '' },
    expectedDeliveryDate: { type: Date, default: null },
    logistics: {
      totalDistanceKm: { type: Number, default: 0 },
      coveredDistanceKm: { type: Number, default: 0 },
      remainingDistanceKm: { type: Number, default: 0 },
      averageSpeedKmph: { type: Number, default: 0 },
      deliveryConfidence: { type: Number, default: 0 },
      expectedDelayMinutes: { type: Number, default: 0 },
      weatherImpact: { type: String, default: '' },
      weatherRiskScore: { type: Number, default: 0 },
      lastGpsPingAt: { type: Date, default: null },
      hubDelayScore: { type: Number, default: 0 },
      roadCondition: { type: String, default: '' },
    },

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

