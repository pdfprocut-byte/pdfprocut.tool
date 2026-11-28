import 'dotenv/config';
import mongoose from 'mongoose';
import AnalyticsEvent from '../models/AnalyticsEvent.js';

const apply = process.argv.includes('--apply');
const confirmedDatabase = process.argv.find((argument) => argument.startsWith('--confirm-db='))?.slice('--confirm-db='.length);
// Run without flags to inspect. Applying changes requires both --apply and an exact database-name confirmation.
const redundantSingleFieldIndexes = new Map([
  ['visitorId_1', { visitorId: 1 }],
  ['visitId_1', { visitId: 1 }],
  ['userId_1', { userId: 1 }],
  ['type_1', { type: 1 }]
]);

const sameKey = (actual, expected) => JSON.stringify(Object.entries(actual)) === JSON.stringify(Object.entries(expected));

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
if (apply && !confirmedDatabase) throw new Error('Applying indexes requires --confirm-db=<exact database name>.');

try {
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  const databaseName = mongoose.connection.name;
  if (apply && databaseName !== confirmedDatabase) {
    throw new Error(`Connected database "${databaseName}" does not match --confirm-db.`);
  }

  const collectionExists = await mongoose.connection.db.listCollections({ name: AnalyticsEvent.collection.collectionName }, { nameOnly: true }).hasNext();
  const existing = collectionExists ? await AnalyticsEvent.collection.listIndexes().toArray() : [];
  const removable = existing.filter((index) => redundantSingleFieldIndexes.has(index.name)
    && sameKey(index.key, redundantSingleFieldIndexes.get(index.name)));
  const declared = AnalyticsEvent.schema.indexes().map(([key, options]) => ({ key, ...options }));
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', databaseName, createIndexes: declared, removeIndexes: removable.map(({ name }) => name) }, null, 2));

  if (apply) {
    await AnalyticsEvent.createIndexes();
    for (const index of removable) await AnalyticsEvent.collection.dropIndex(index.name);
    console.log('Analytics indexes updated. No analytics documents were changed or deleted.');
  }
} finally {
  await mongoose.disconnect();
}
