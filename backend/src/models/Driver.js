const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    vehicleNumber: { type: String, default: '', trim: true },
    vehicleType: { type: String, default: '', trim: true },
    licenseNumber: { type: String, default: '', trim: true },
    currentStatus: { type: String, default: 'Available', enum: ['Available', 'Assigned', 'On Route', 'Off Duty', 'Suspended'] },
    currentGps: {
      text: { type: String, default: '' },
      coordinates: { type: [Number], default: undefined },
      lastPingAt: { type: Date, default: null },
    },
    availability: { type: Boolean, default: true },
    assignedShipments: { type: [String], default: [] },
  },
  { timestamps: true }
);

DriverSchema.index({ companyId: 1, phone: 1 });
DriverSchema.index({ companyId: 1, licenseNumber: 1 });

module.exports = mongoose.model('Driver', DriverSchema);
