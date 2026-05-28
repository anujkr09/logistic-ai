const router = require('express').Router();
const { Company, User, Warehouse } = require('../services/models');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signAccessToken } = require('../utils/jwt');
const { requireAuth } = require('../middleware/authMiddleware');

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

router.get('/me', requireAuth, async (req, res) => {
  const [user, company] = await Promise.all([
    User.findOne({ _id: req.user.id }).exec(),
    Company.findOne({ _id: req.user.companyId }).exec(),
  ]);

  if (!user || !company) return res.status(404).json({ message: 'Profile not found' });
  res.json({ user: publicUser(user, company) });
});

router.patch('/me', requireAuth, async (req, res) => {
  const { email, phoneCountry, phoneCountryCode, phoneNumber } = req.body || {};

  const [user, company] = await Promise.all([
    User.findOne({ _id: req.user.id }).exec(),
    Company.findOne({ _id: req.user.companyId }).exec(),
  ]);

  if (!user || !company) return res.status(404).json({ message: 'Profile not found' });

  const nextEmail = String(email || '').toLowerCase().trim();
  if (!nextEmail) return res.status(400).json({ message: 'Email required' });

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
  user.phone = phone;

  await user.save();
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


