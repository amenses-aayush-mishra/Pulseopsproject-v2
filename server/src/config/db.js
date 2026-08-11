const mongoose = require('mongoose');

const redactMongoUri = (uri) => {
  try {
    const url = new URL(uri);
    if (url.username) {
      url.username = '***';
    }
    if (url.password) {
      url.password = '***';
    }
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return uri ? '[redacted]' : '(not set)';
  }
};

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pulseops_v2';
  try {
    console.log(`Connecting to MongoDB at: ${redactMongoUri(mongoURI)}`);

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log('✅ MongoDB connected');
} catch (err) {
  const sanitized = redactMongoUri(mongoURI);
  console.error(`MongoDB connection failed. URI: ${sanitized}`);
  console.error(`Error: ${err?.name ?? 'Unknown'} — ${err?.code ?? 'no code'}`);
  process.exit(1);
}

};

module.exports = connectDB;