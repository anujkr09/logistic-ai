const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    panNumber: { type: String, trim: true, uppercase: true, default: undefined },
    gstNumber: { type: String, trim: true, uppercase: true, default: undefined },
    plan: { type: String, default: 'enterprise' },
    status: { type: String, default: 'active' },
  },
  { timestamps: true }
);

// Company names should be unique across tenants
CompanySchema.index({ name: 1 }, { unique: true });
CompanySchema.index({ panNumber: 1 }, { unique: true, sparse: true });
CompanySchema.index({ gstNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Company', CompanySchema);

