require('./config/env');
const app = require('./app');
const { connectMongo } = require('./config/db');
const { initSocket } = require('./sockets');
const { startAutoTracker } = require('./services/autoTracker');

const PORT = process.env.PORT || 4000;

connectMongo()
  .then(() => {
    initSocket(app, PORT);
    startAutoTracker();
  })
  .catch((err) => {
    console.error('Failed to start backend', err);
    process.exit(1);
  });

