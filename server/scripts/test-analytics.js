const mongoose = require('mongoose');
require('dotenv').config({path:'.env'});
const connectDB = require('../src/config/db');
const Activity = require('../src/models/Activity');

connectDB().then(async () => {
  const orgId = '6a85a2c34a3f09d3b6413889';
  
  // Test the analytics dashboard aggregation (similar to what the route does)
  const now = Date.now();
  const dayMs = 7 * 24 * 60 * 60 * 1000;
  const curFrom = new Date(now - dayMs);
  const curTo = new Date(now);
  
  const rows = await Activity.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(orgId),
        timestamp: { $gte: curFrom, $lte: curTo },
      },
    },
    { $group: { _id: '$type', n: { $sum: 1 } } },
  ]);
  
  const map = {};
  rows.forEach((r) => { map[r._id] = r.n; });
  
  console.log('Activity counts by type:', map);
  
  // Test slack count
  const slackRows = await Activity.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(orgId),
        source: 'slack',
        timestamp: { $gte: curFrom, $lte: curTo },
      },
    },
    { $group: { _id: null, n: { $sum: 1 } } },
  ]);
  console.log('Slack count:', slackRows.length ? slackRows[0].n : 0);
  
  // Test team rows
  const teamRows = await Activity.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(orgId),
        timestamp: { $gte: curFrom, $lte: curTo },
      },
    },
    {
      $group: {
        _id: '$actor',
        total: { $sum: 1 },
        prsMerged: { $sum: { $cond: [{ $eq: ['$type', 'pr_merged'] }, 1, 0] } },
        prsOpened: { $sum: { $cond: [{ $eq: ['$type', 'pr_opened'] }, 1, 0] } },
        issuesCompleted: { $sum: { $cond: [{ $eq: ['$type', 'issue_completed'] }, 1, 0] } },
        lastActive: { $max: '$timestamp' },
        sources: { $addToSet: '$source' },
      },
    },
    { $sort: { total: -1 } },
    { $limit: 8 },
  ]);
  
  console.log('Team rows:', teamRows.map(r => ({ actor: r._id, total: r.total, prsMerged: r.prsMerged, prsOpened: r.prsOpened, issuesCompleted: r.issuesCompleted })));
  
  mongoose.disconnect();
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });