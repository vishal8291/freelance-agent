import mongoose from 'mongoose';

let connected = false;

export async function connectDatabase() {
  if (connected) return mongoose.connection;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set — required for multi-user accounts and data storage.');
  }

  await mongoose.connect(uri);
  connected = true;
  console.log('[db] Connected to MongoDB');
  return mongoose.connection;
}
