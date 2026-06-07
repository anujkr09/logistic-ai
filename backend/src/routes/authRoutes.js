const router = require('express').Router();
const fetch = global.fetch || require('node-fetch');
const { Company, User, Warehouse } = require('../services/models');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signAccessToken } = require('../utils/jwt');
const { requireAuth } = require('../middleware/authMiddleware');

const OTP_TTL_MINUTES = Number(process.env.LOGIN_OTP_TTL_MINUTES || 5);
const OTP_RESEND_SECONDS = Number(process.env.LOGIN_OTP_RESEND_SECONDS || 45);
const SMS_PROVIDER = String(process.env.SMS_PROVIDER || 'webhook').toLowerCase();
const SMS_WEBHOOK_URL = process.env.SMS_WEBHOOK_URL || process.env.OTP_SMS_WEBHOOK_URL || '';
const SMS_WEBHOOK_TOKEN = process.env.SMS_WEBHOOK_TOKEN || process.env.OTP_SMS_WEBHOOK_TOKEN || '';
const SMS_STRICT_DELIVERY = String(process.env.SMS_STRICT_DELIVERY || '').toLowerCase() === 'true';

function normalizeTaxId(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function validateCompanyTaxIds({ panNumber, gstNumber }) {
  const pan = normalizeTaxId(panNumber);
  const gst = normalizeTaxId(gstNumber);
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

  if (!pan || !gst) return { error: 'PAN number and GST number required' };
  if (!panRegex.test(pan)) return { error: 'Invalid PAN number format' };
  if (!gstRegex.test(gst)) return { error: 'Invalid GST number format' };
  if (gst.slice(2, 12) !== pan) return { error: 'GST number must contain the same PAN number' };

  return { pan, gst };
}

function normalizePhone({ phoneCountry, phoneCountryCode, phoneNumber }) {
  const country = String(phoneCountry || '').trim();
  const countryCode = String(phoneCountryCode || '').trim().replace(/[^\d+]/g, '');
  const number = String(phoneNumber || '').trim().replace(/[^\d]/g, '');
  const normalizedCode = countryCode ? (countryCode.startsWith('+') ? countryCode : `+${countryCode}`) : '';

  if (!country || !normalizedCode || !number) return { error: 'Country, country code, and mobile number required' };
  if (number.length < 6 || number.length > 15) return { error: 'Invalid mobile number length' };

  return {
    country,
    countryCode: normalizedCode,
    number,
    fullNumber: `${normalizedCode}${number}`,
  };
}

function normalizeLoginPhone({ phoneCountryCode, phoneNumber }) {
  const countryCode = String(phoneCountryCode || '').trim().replace(/[^\d+]/g, '');
  const number = String(phoneNumber || '').trim().replace(/[^\d]/g, '');
  const normalizedCode = countryCode ? (countryCode.startsWith('+') ? countryCode : `+${countryCode}`) : '';
  if (!normalizedCode || !number) return { error: 'Country code and mobile number required' };
  if (number.length < 6 || number.length > 15) return { error: 'Invalid mobile number length' };
  return { countryCode: normalizedCode, number, fullNumber: `${normalizedCode}${number}` };
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendLoginOtp({ phone, otp, user, company }) {
  const message = `Your ZYRAVIQ AI login OTP is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`;
  if (!SMS_WEBHOOK_URL) {
    if (SMS_STRICT_DELIVERY) {
      throw new Error('SMS provider is not configured. Set SMS_WEBHOOK_URL or OTP_SMS_WEBHOOK_URL.');
    }
    console.log(`[DEV OTP] ${phone}: ${otp}`);
    return { sent: false, provider: 'dev-console', message };
  }

  const response = await fetch(SMS_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SMS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${SMS_WEBHOOK_TOKEN}` } : {}),
    },
    body: JSON.stringify({
      to: phone,
      otp,
      message,
      userId: String(user._id),
      companyId: String(company._id),
      companyName: company.name,
      provider: SMS_PROVIDER,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'OTP SMS provider failed');
  }

  return { sent: true, provider: SMS_PROVIDER || 'webhook' };
}

function publicUser(user, company) {
  return {
    id: String(user._id),
    email: user.email,
    role: user.role,
    status: user.status,
    companyId: String(user.companyId),
    companyName: company.name,
    companyPlan: company.plan || '',
    companyStatus: company.status || '',
    name: user.name,
    panNumber: company.panNumber || '',
    gstNumber: company.gstNumber || '',
    phone: user.phone || {},
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

router.post('/login', async (req, res) => {
  const { email, password, companyId, companyName } = req.body || {};
  if (!email || !password || (!companyId && !companyName)) return res.status(400).json({ message: 'email, password, and companyId or companyName required' });

  const company = companyId
    ? await Company.findOne({ _id: companyId }).exec()
    : await Company.findOne({ name: String(companyName).trim() }).exec();

  if (!company) return res.status(401).json({ message: 'Invalid login credentials' });

  const user = await User.findOne({
    email: String(email).toLowerCase().trim(),
    companyId: company._id,
  }).exec();

  if (!user) return res.status(401).json({ message: 'Invalid login credentials' });
  if (user.status === 'disabled') return res.status(403).json({ message: 'Account is disabled' });

  const ok = verifyPassword(String(password), user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid login credentials' });

  const token = signAccessToken({ user });
  res.json({
    token,
    user: publicUser(user, company),
  });
});

router.post('/login/request-otp', async (req, res) => {
  const { companyName, companyId, phoneCountryCode, phoneNumber } = req.body || {};
  const phone = normalizeLoginPhone({ phoneCountryCode, phoneNumber });
  if (phone.error) return res.status(400).json({ message: phone.error });
  if (!companyId && !companyName) return res.status(400).json({ message: 'companyId or companyName required' });

  const company = companyId
    ? await Company.findOne({ _id: companyId }).exec()
    : await Company.findOne({ name: String(companyName).trim() }).exec();
  if (!company) return res.status(404).json({ message: 'Company not found. Please register first.' });

  const user = await User.findOne({
    companyId: company._id,
    'phone.fullNumber': phone.fullNumber,
  }).exec();
  if (!user) return res.status(404).json({ message: 'No user found with this mobile number. Please register first.' });
  if (user.status === 'disabled') return res.status(403).json({ message: 'Account is disabled' });

  const now = Date.now();
  const lastSentAt = user.loginOtp?.lastSentAt ? new Date(user.loginOtp.lastSentAt).getTime() : 0;
  const waitMs = OTP_RESEND_SECONDS * 1000 - (now - lastSentAt);
  if (waitMs > 0) {
    return res.status(429).json({ message: `Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting another OTP` });
  }

  const otp = generateOtp();
  user.loginOtp = {
    hash: hashPassword(otp),
    expiresAt: new Date(now + OTP_TTL_MINUTES * 60 * 1000),
    attempts: 0,
    lastSentAt: new Date(now),
  };
  await user.save();

  const delivery = await sendLoginOtp({ phone: phone.fullNumber, otp, user, company });
  res.json({
    message: delivery.sent ? 'OTP sent to your mobile number' : 'OTP generated for demo login',
    phone: phone.fullNumber.replace(/(\+\d{1,3})\d+(\d{4})$/, '$1******$2'),
    expiresInSeconds: OTP_TTL_MINUTES * 60,
    delivery,
    ...(!delivery.sent ? { demoOtp: otp } : {}),
  });
});

router.post('/login/verify-otp', async (req, res) => {
  const { companyName, companyId, phoneCountryCode, phoneNumber, otp } = req.body || {};
  const phone = normalizeLoginPhone({ phoneCountryCode, phoneNumber });
  if (phone.error) return res.status(400).json({ message: phone.error });
  if (!String(otp || '').trim()) return res.status(400).json({ message: 'OTP required' });
  if (!companyId && !companyName) return res.status(400).json({ message: 'companyId or companyName required' });

  const company = companyId
    ? await Company.findOne({ _id: companyId }).exec()
    : await Company.findOne({ name: String(companyName).trim() }).exec();
  if (!company) return res.status(401).json({ message: 'Invalid OTP login details' });

  const user = await User.findOne({
    companyId: company._id,
    'phone.fullNumber': phone.fullNumber,
  }).exec();
  if (!user) return res.status(401).json({ message: 'Invalid OTP login details' });
  if (user.status === 'disabled') return res.status(403).json({ message: 'Account is disabled' });

  const otpState = user.loginOtp || {};
  if (!otpState.hash || !otpState.expiresAt || new Date(otpState.expiresAt) < new Date()) {
    return res.status(401).json({ message: 'OTP expired. Request a new OTP.' });
  }
  if (Number(otpState.attempts || 0) >= 5) {
    return res.status(429).json({ message: 'Too many OTP attempts. Request a new OTP.' });
  }

  const ok = verifyPassword(String(otp).trim(), otpState.hash);
  if (!ok) {
    user.loginOtp.attempts = Number(user.loginOtp.attempts || 0) + 1;
    await user.save();
    return res.status(401).json({ message: 'Invalid OTP' });
  }

  user.loginOtp = { hash: '', expiresAt: null, attempts: 0, lastSentAt: user.loginOtp.lastSentAt };
  await user.save();

  const token = signAccessToken({ user });
  res.json({ token, user: publicUser(user, company) });
});

router.get('/me', requireAuth, async (req, res) => {
  const [user, company] = await Promise.all([
    User.findOne({ _id: req.user.id }).exec(),
    Company.findOne({ _id: req.user.companyId }).exec(),
  ]);

  if (!user || !company) return res.status(404).json({ message: 'Profile not found' });
  res.json({ user: publicUser(user, company) });
});

router.patch('/me', requireAuth, async (req, res) => {
  const { name, email, companyName, panNumber, gstNumber, phoneCountry, phoneCountryCode, phoneNumber } = req.body || {};

  const [user, company] = await Promise.all([
    User.findOne({ _id: req.user.id }).exec(),
    Company.findOne({ _id: req.user.companyId }).exec(),
  ]);

  if (!user || !company) return res.status(404).json({ message: 'Profile not found' });

  const nextEmail = String(email || '').toLowerCase().trim();
  if (!nextEmail) return res.status(400).json({ message: 'Email required' });

  const nextName = String(name || '').trim();
  if (!nextName) return res.status(400).json({ message: 'Name required' });

  if (nextEmail !== user.email) {
    const existing = await User.findOne({
      _id: { $ne: user._id },
      companyId: user.companyId,
      email: nextEmail,
    }).exec();
    if (existing) return res.status(409).json({ message: 'Email is already used in this company' });
    user.email = nextEmail;
  }

  const phone = normalizePhone({ phoneCountry, phoneCountryCode, phoneNumber });
  if (phone.error) return res.status(400).json({ message: phone.error });
  user.name = nextName;
  user.phone = phone;

  const nextCompanyName = String(companyName || '').trim();
  if (!nextCompanyName) return res.status(400).json({ message: 'Company name required' });

  const taxIds = validateCompanyTaxIds({ panNumber, gstNumber });
  if (taxIds.error) return res.status(400).json({ message: taxIds.error });

  if (nextCompanyName !== company.name) {
    const existingCompany = await Company.findOne({
      _id: { $ne: company._id },
      name: nextCompanyName,
    }).exec();
    if (existingCompany) return res.status(409).json({ message: 'Company name is already registered' });
    company.name = nextCompanyName;
  }

  const taxOwner = await Company.findOne({
    _id: { $ne: company._id },
    $or: [{ panNumber: taxIds.pan }, { gstNumber: taxIds.gst }],
  }).exec();
  if (taxOwner) return res.status(409).json({ message: 'PAN/GST details are already registered with another company' });

  company.panNumber = taxIds.pan;
  company.gstNumber = taxIds.gst;

  await Promise.all([user.save(), company.save()]);
  res.json({ user: publicUser(user, company) });
});

router.post('/register', async (req, res) => {
  const { companyName, email, password, name, accountRole, panNumber, gstNumber, phoneCountry, phoneCountryCode, phoneNumber } = req.body || {};
  if (!companyName || !email || !password || !name) return res.status(400).json({ message: 'companyName, name, email, password, PAN number, GST number, and mobile number required' });
  const role = accountRole === 'admin' ? 'admin' : 'customer';

  const taxIds = validateCompanyTaxIds({ panNumber, gstNumber });
  if (taxIds.error) return res.status(400).json({ message: taxIds.error });
  const phone = normalizePhone({ phoneCountry, phoneCountryCode, phoneNumber });
  if (phone.error) return res.status(400).json({ message: phone.error });

  const normalizedCompanyName = String(companyName).trim();
  const taxOwner = await Company.findOne({
    $or: [{ panNumber: taxIds.pan }, { gstNumber: taxIds.gst }],
  }).exec();

  if (taxOwner && taxOwner.name !== normalizedCompanyName) {
    return res.status(409).json({ message: 'PAN/GST details are already registered with another company' });
  }

  let company = await Company.findOne({ name: normalizedCompanyName }).exec();
  const isNewCompany = !company;
  if (!company) {
    company = await Company.create({
      name: normalizedCompanyName,
      panNumber: taxIds.pan,
      gstNumber: taxIds.gst,
      plan: 'enterprise',
    });
  } else {
    const savedPan = normalizeTaxId(company.panNumber);
    const savedGst = normalizeTaxId(company.gstNumber);
    if ((savedPan && savedPan !== taxIds.pan) || (savedGst && savedGst !== taxIds.gst)) {
      return res.status(409).json({
        message: `Company "${normalizedCompanyName}" is already registered with different PAN/GST details. Use the registered PAN/GST or enter a different company name.`,
      });
    }
    if (!savedPan || !savedGst) {
      company.panNumber = taxIds.pan;
      company.gstNumber = taxIds.gst;
      await company.save();
    }
  }

  const existing = await User.findOne({
    email: String(email).toLowerCase().trim(),
    companyId: company._id,
  }).exec();

  if (existing) return res.status(409).json({ message: 'User already exists for this company' });

  if (isNewCompany) {
    await Promise.all([
      Warehouse.create({
        companyId: company._id,
        name: 'Primary Express Hub',
        address: 'Main cargo terminal',
        city: 'Delhi',
        country: 'India',
        location: { type: 'Point', coordinates: [77.1025, 28.7041] },
        inventory: { used: 24, total: 100, summary: 'Ready for assignments' },
      }),
      Warehouse.create({
        companyId: company._id,
        name: 'Regional Delivery Hub',
        address: 'City distribution center',
        city: 'Mumbai',
        country: 'India',
        location: { type: 'Point', coordinates: [72.8777, 19.076] },
        inventory: { used: 36, total: 120, summary: 'Fast last-mile coverage' },
      }),
    ]);
  }

  const passwordHash = hashPassword(String(password));

  let user;
  try {
    user = await User.create({
      companyId: company._id,
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      passwordHash,
      phone,
      role,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'User already exists for this company' });
    }
    throw err;
  }

  const token = signAccessToken({ user });
  res.status(201).json({
    token,
    user: publicUser(user, company),
  });
});

module.exports = router;


