const { Analytics } = require('./models');

const DEFAULT_REVENUE_TYPE = 'revenue_summary';

function normalizeAmount(value, fallback = 0) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : Number(fallback) || 0;
}

async function upsertRevenueSummary({
  companyId,
  amount,
  source = 'shipment_automation',
  currency = 'INR',
  metadata = {},
  recordType = DEFAULT_REVENUE_TYPE,
}) {
  if (!companyId) {
    throw new Error('companyId is required to persist revenue analytics.');
  }

  const revenue = normalizeAmount(amount, 0);
  const computedAt = new Date();
  const payload = {
    revenue,
    totalRevenue: revenue,
    currency,
    source,
    basis: metadata.basis || 'pricing_pipeline',
    ...metadata,
  };

  const summary = await Analytics.findOneAndUpdate(
    { companyId, type: recordType, source },
    {
      $set: {
        companyId,
        type: 'revenue_summary',
        source,
        payload,
        computedAt,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  ).lean().exec();

  return {
    revenue,
    source,
    currency,
    computedAt: summary?.computedAt || computedAt,
    payload: summary?.payload || payload,
  };
}

module.exports = { upsertRevenueSummary, normalizeAmount };
