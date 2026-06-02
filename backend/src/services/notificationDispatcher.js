const fetch = global.fetch || require('node-fetch');
const { Notification } = require('./models');
const { getIo } = require('../sockets/instance');

const WEBHOOK_URL = process.env.NOTIFICATION_WEBHOOK_URL || '';
const SMS_WEBHOOK_URL = process.env.SMS_WEBHOOK_URL || '';
const EMAIL_WEBHOOK_URL = process.env.EMAIL_WEBHOOK_URL || '';
const PUSH_WEBHOOK_URL = process.env.PUSH_WEBHOOK_URL || '';

async function postWebhook(url, payload) {
  if (!url) return { configured: false, delivered: false };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { configured: true, delivered: response.ok, status: response.status };
  } catch (error) {
    return { configured: true, delivered: false, error: error.message };
  }
}

async function dispatchChannels(notification, channels = ['email', 'sms', 'push']) {
  const payload = {
    id: String(notification._id),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    meta: notification.meta || {},
    createdAt: notification.createdAt,
  };

  const results = {};
  if (channels.includes('sms')) results.sms = await postWebhook(SMS_WEBHOOK_URL || WEBHOOK_URL, payload);
  if (channels.includes('email')) results.email = await postWebhook(EMAIL_WEBHOOK_URL || WEBHOOK_URL, payload);
  if (channels.includes('push')) results.push = await postWebhook(PUSH_WEBHOOK_URL || WEBHOOK_URL, payload);
  return results;
}

async function createAndDispatchNotification({ companyId, userId = null, type = 'shipment_update', title, message, meta = {}, channels }) {
  const notification = await Notification.create({
    companyId,
    userId,
    type,
    title,
    message,
    meta: {
      ...meta,
      channels: channels || ['email', 'sms', 'push'],
    },
  });

  const delivery = await dispatchChannels(notification, channels || ['email', 'sms', 'push']);
  notification.meta = {
    ...(notification.meta || {}),
    delivery,
  };
  await notification.save();

  const io = getIo();
  io.to(`company:${companyId}`).emit('notification:new', { notification });
  if (meta?.trackingNumber) io.to(`tracking:${meta.trackingNumber}`).emit('notification:new', { notification });

  return notification;
}

module.exports = { createAndDispatchNotification, dispatchChannels };
