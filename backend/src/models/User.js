const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: {
      country: { type: String, trim: true, default: '' },
      countryCode: { type: String, trim: true, default: '' },
      number: { type: String, trim: true, default: '' },
      fullNumber: { type: String, trim: true, default: '' },
    },
    loginOtp: {
      hash: { type: String, default: '' },
      expiresAt: { type: Date, default: null },
      attempts: { type: Number, default: 0 },
      lastSentAt: { type: Date, default: null },
    },
    role: { type: String, enum: ['customer', 'admin', 'warehouse_manager'], default: 'customer' },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  },
  { timestamps: true }
);

// Unique user email per tenant (company)
UserSchema.index({ companyId: 1, email: 1 }, { unique: true });
UserSchema.index({ 'phone.fullNumber': 1, companyId: 1 });

module.exports = mongoose.model('User', UserSchema);

