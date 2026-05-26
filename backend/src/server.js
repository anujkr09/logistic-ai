require('./config/env');
const app = require('./app');
const { connectMongo } = require('./config/db');
const { initSocket } = require('./sockets');
const { startAutoTracker } = require('./services/autoTracker');

const PORT = process.env.PORT || 4000;

initSocket(app, PORT);
startAutoTracker();

connectMongo().catch((err) => {
  console.error('MongoDB connection failed. The frontend is still available, but data routes need MONGODB_URI.', err.message);
});
