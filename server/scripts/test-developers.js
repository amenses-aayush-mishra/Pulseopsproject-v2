const mongoose = require('mongoose');
require('dotenv').config({path:'.env'});
const connectDB = require('../src/config/db');
const Activity = require('../src/models/Activity');

connectDB().then(async () => {
  const orgId = '6a85a2c34a3f09d3b6413889';
  const days = 30;
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await Activity.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(orgId),
        timestamp: { $gte: from },
      },
    },
    {
      $group: {
        _id: '$actor',
        total: { $sum: 1 },
        prsMerged: { $sum: { $cond: [{ $eq: ['$type', 'pr_merged'] }, 1, 0] } },
        prsOpened: { $sum: { $cond: [{ $eq: ['$type', 'pr_opened'] }, 1, 0] } },
        pushes: { $sum: { $cond: [{ $eq: ['$type', 'push'] }, 1, 0] } },
        githubCount: { $sum: { $cond: [{ $eq: ['$source', 'github'] }, 1, 0] } },
        slackCount: { $sum: { $cond: [{ $eq: ['$source', 'slack'] }, 1, 0] } },
        jiraCount: { $sum: { $cond: [{ $eq: ['$source', 'jira'] }, 1, 0] } },
        issuesCompleted: { $sum: { $cond: [{ $eq: ['$type', 'issue_completed'] }, 1, 0] } },
        lastActive: { $max: '$timestamp' },
      },
    },
    { $sort: { total: -1 } },
  ]);

  // Status calculation
  const totals = rows.map((r) => r.total).sort((a, b) => a - b);
  const median = totals.length ? totals[Math.floor(totals.length / 2)] : 0;

  const developers = rows.map((r) => {
    let status = 'Critical';
    if (median === 0) status = 'At Risk';
    else if (r.total >= median) status = 'Healthy';
    else if (r.total >= median * 0.5) status = 'At Risk';
    const daysIdle = Math.floor((Date.now() - new Date(r.lastActive).getTime()) / 86400000);
    if (daysIdle > 7) status = 'Critical';
    else if (status === 'Healthy' && daysIdle > 3) status = 'At Risk';
    return {
      actor: r._id,
      total: r.total,
      prsMerged: r.prsMerged,
      prsOpened: r.prsOpened,
      pushes: r.pushes,
      issuesCompleted: r.issuesCompleted,
      github: r.githubCount,
      slack: r.slackCount,
      jira: r.jiraCount,
      lastActive: r.lastActive,
      daysIdle,
      status,
    };
  });

  console.log('Developers:', developers);
  console.log('Median activity:', median);

  mongoose.disconnect();
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });