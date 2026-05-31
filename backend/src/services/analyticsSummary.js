const { Analytics } = require('./models');

function readRevenue(payload = {}) {
  const value = payload.revenue ?? payload.totalRevenue ?? payload.amount ?? payload.total;
  const revenue = Number(value);
  return Number.isFinite(revenue) ? revenue : 0;
}

async function getRevenueSummary(companyId) {
  const summary = await Analytics.findOne({ companyId, type: 'revenue_summary' })
    .sort({ computedAt: -1, updatedAt: -1, createdAt: -1 })
    .lean()
    .exec();

  return {
    revenue: readRevenue(summary?.payload),
    computedAt: summary?.computedAt || null,
  };
}

module.exports = { getRevenueSummary };
