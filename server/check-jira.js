const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const JiraIssue = mongoose.model(
    'JiraIssue',
    new mongoose.Schema({}, { strict: false })
  );

  const issues = await JiraIssue.find({}).lean();

  console.log('JiraIssue count:', issues.length);
  console.log(JSON.stringify(issues, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);