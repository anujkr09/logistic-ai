require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET;

if (isProduction && !JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

if (!JWT_SECRET) {
  console.warn('JWT_SECRET is not set. Using an insecure development-only secret.');
}

module.exports = {
  JWT_SECRET: JWT_SECRET || 'dev_only_secret_for_local_runs',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/zyraviq_ai_logistics',
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:8001',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-5.2',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  CORS_ORIGIN: process.env.CORS_ORIGIN || process.env.SOCKET_CORS_ORIGIN || '*',
  SOCKET_CORS_ORIGIN: process.env.SOCKET_CORS_ORIGIN || process.env.CORS_ORIGIN || '*'
};

