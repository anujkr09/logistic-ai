const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    vehicleNumber: { type: String, required: true, trim: true },
    driverName: { type: String, default: '', trim: true },
    vehicleType: { type: String, default: 'Truck', trim: true },
    currentLocation: {
      text: { type: String, default: '' },
      coordinates: { type: [Number], default: undefined },
    },
    fuelStatus: { type: String, default: 'Operational', trim: true },
    speedKmph: { type: Number, default: 0 },
    route: { type: String, default: '', trim: true },
    eta: { type: Date, default: null },
    lastGpsUpdate: { type: Date, default: null },
    assignedShipments: { type: [String], default: [] },
    status: { type: String, default: 'Available', enum: ['Available', 'Assigned', 'In Transit', 'Maintenance', 'Inactive'] },
  },
  { timestamps: true }
);

VehicleSchema.index({ companyId: 1, vehicleNumber: 1 }, { unique: true });

module.exports = mongoose.model('Vehicle', VehicleSchema);
