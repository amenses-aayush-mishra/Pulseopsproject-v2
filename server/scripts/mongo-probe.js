/* Temp connectivity probe (deleted after the audit). */
require('dotenv').config();
const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
console.log('URI present:', Boolean(uri));
if (uri === null || uri === undefined || uri === '') {
  console.log('NO_URI');
  process.exit(0);
}
mongoose
  .connect(uri, { serverSelectionTimeoutMS: 4000 })
  .then(() => { console.log('MONGO_REACHABLE'); return mongoose.disconnect(); })
  .catch((e) => { console.log('MONGO_UNREACHABLE:', String(e.message).split('\n')[0]); });