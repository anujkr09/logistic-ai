const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zyraviq_ai_logistics';
const legacyLower = ['sh', 'ipx'].join('');
const legacyDisplay = ['sh', 'ipX'].join('');
const legacyTitle = ['Sh', 'ipX'].join('');
const legacyCarrier = ['Fe', 'dEx'].join('');
const legacyCarrierShort = ['Fe', 'dX'].join('');
const legacyCarrierLower = legacyCarrier.toLowerCase();
const legacyCarrierShortLower = legacyCarrierShort.toLowerCase();

const replacements = [
  [`${legacyDisplay} AI Logistics`, 'ZYRAVIQ AI Logistics'],
  [`${legacyDisplay} AI`, 'ZYRAVIQ AI'],
  [legacyDisplay, 'ZYRAVIQ'],
  [legacyTitle, 'ZYRAVIQ'],
  [legacyLower, 'zyraviq'],
  [legacyCarrier, 'ZYRAVIQ'],
  [legacyCarrierShort, 'ZYRAVIQ'],
  [legacyCarrierLower, 'zyraviq'],
  [legacyCarrierShortLower, 'zyraviq'],
];

function replaceText(value) {
  return replacements.reduce((text, [from, to]) => text.split(from).join(to), value);
}

function transform(value) {
  if (typeof value === 'string') return replaceText(value);
  if (!value || value instanceof Date || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map(transform);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, transform(val)]));
  }
  return value;
}

function changed(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

async function updateDatabase(uri) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db();
  const collections = await db.listCollections().toArray();
  let touched = 0;

  for (const { name } of collections) {
    const col = db.collection(name);
    const docs = await col.find({}).toArray();
    let collectionTouched = 0;

    for (const doc of docs) {
      const next = transform(doc);
      if (!changed(doc, next)) continue;
      await col.replaceOne({ _id: doc._id }, next);
      touched += 1;
      collectionTouched += 1;
    }

    if (collectionTouched) console.log(`${db.databaseName}.${name}: updated ${collectionTouched}`);
  }

  await client.close();
  return touched;
}

(async () => {
  console.log(`Updating DB from MONGODB_URI: ${mongoUri}`);
  const updated = await updateDatabase(mongoUri);
  console.log(JSON.stringify({ updated }, null, 2));
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
