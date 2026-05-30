const mongoose = require('mongoose');

const Company = require('../models/Company');
const User = require('../models/User');
const Warehouse = require('../models/Warehouse');
const Shipment = require('../models/Shipment');
const Notification = require('../models/Notification');
const Analytics = require('../models/Analytics');
const WorkspaceItem = require('../models/WorkspaceItem');

async function connectMongo() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zyraviq_ai_logistics';

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 5000,
  });

  console.log('MongoDB connected successfully');
}

module.exports = { connectMongo, Company, User, Warehouse, Shipment, Notification, Analytics, WorkspaceItem };
