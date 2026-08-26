/* Temp: mint a local dev JWT for a real member of the seeded org (deleted after). */
require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('../src/config/db');
const OrganizationMember = require('../src/models/OrganizationMember');

(async () => {
  await connectDB();
  const ORG = process.argv[2] || '6a8b2ad0cbaddd12cb32dc51';
  const member = await OrganizationMember.findOne({ organizationId: ORG, status: 'active' }).lean();
  if (!member) {
    console.log('NO_ACTIVE_MEMBER');
    await mongoose.disconnect();
    process.exit(1);
  }
  const token = jwt.sign(
    { userId: member.userId.toString(), activeOrganizationId: ORG, role: member.role || 'admin', email: 'audit@local' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
  console.log(token);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });