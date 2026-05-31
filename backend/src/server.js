require('./config/env');
const app = require('./app');
const { connectMongo } = require('./config/db');
const { initSocket } = require('./sockets');
const { startAutoTracker } = require('./services/autoTracker');

const PORT = process.env.PORT || 4000;

initSocket(app, PORT);

connectMongo()
  .then(() => {
    startAutoTracker();
  })
  .catch((err) => {
    console.error('MongoDB connection failed. Data routes and auto tracking need MONGODB_URI.', err.message);
  });
