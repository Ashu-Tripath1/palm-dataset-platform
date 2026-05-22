import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'palm_dataset';

let cachedClient = null;
let cachedDb = null;

export async function getDb() {
  if (cachedDb) return cachedDb;
  if (!cachedClient) {
    cachedClient = new MongoClient(uri, {
      // Force IPv4 to avoid Node.js SRV/IPv6 DNS issues on Windows
      family: 4,
      // Atlas TLS settings
      tls: uri.includes('mongodb+srv') || uri.includes('mongodb.net') ? true : false,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    await cachedClient.connect();
  }
  cachedDb = cachedClient.db(dbName);
  // Ensure indexes
  try {
    await cachedDb.collection('participants').createIndex({ id: 1 }, { unique: true });
    await cachedDb.collection('photos').createIndex({ participantId: 1 });
    await cachedDb.collection('photos').createIndex({ id: 1 }, { unique: true });
  } catch (e) {
    // ignore duplicate index errors
  }
  return cachedDb;
}
