/* Temp DB probe: lists orgs + activity/summary counts (deleted after use). */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Organization = require('../src/models/Organization');
const Activity = require('../src/models/Activity');
const AISummary = require('../src/models/AISummary');

(async () => {
  await connectDB();
  const orgs = await Organization.find({}).lean().limit(5);
  console.log('ORGANIZATIONS:', orgs.map((o) => ({ id: o._id.toString(), name: o.name })));
  const acts = await Activity.countDocuments({});
  console.log('TOTAL ACTIVITIES:', acts);
  for (const o of orgs.slice(0, 3)) {
    console.log(`  org ${o.name}:`, await Activity.countDocuments({ organizationId: o._id }), 'activities');
    console.log(`    by source:`, JSON.stringify(await Activity.aggregate([
      { $match: { organizationId: o._id } },
      { $group: { _id: '$source', n: { $sum: 1 } } },
    ])));
  }
  console.log('AI SUMMARIES:', await AISummary.countDocuments({}));
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error('PROBE ERROR:', e.message); process.exit(1); });