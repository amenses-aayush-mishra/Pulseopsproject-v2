const express = require('express');
const githubRoutes = require('./github');
const slackRoutes = require('./slack');
const jiraRoutes = require('./jira');

const router = express.Router();

router.use('/github', githubRoutes);
router.use('/slack', slackRoutes);
router.use('/jira', jiraRoutes);

module.exports = router;