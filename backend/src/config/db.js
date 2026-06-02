const mongoose = require('mongoose');

const Company = require('../models/Company');
const User = require('../models/User');
const Warehouse = require('../models/Warehouse');
const Shipment = require('../models/Shipment');
const Notification = require('../models/Notification');
const Analytics = require('../models/Analytics');
const WorkspaceItem = require('../models/WorkspaceItem');
const AuditLog = require('../models/AuditLog');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const { MONGODB_URI } = require('./env');

async function connectMongo() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required to connect MongoDB');
  }

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 5000,
  });

  console.log('MongoDB connected successfully');
}

module.exports = { connectMongo, Company, User, Warehouse, Shipment, Notification, Analytics, WorkspaceItem, AuditLog, Driver, Vehicle };
