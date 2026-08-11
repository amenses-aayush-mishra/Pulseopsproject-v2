require('dotenv').config();
const dns = require("dns");

if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
}
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const orgRoutes = require('./src/routes/orgRoutes');
const integrationRoutes = require('./src/routes/integrationRoutes');
const securityHeaders = require('./src/middleware/securityHeaders');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

// TASK-112: security headers mounted at root (helmet-equivalent stand-in — the
// helmet package cannot be installed offline on this machine; same headers).
app.use(securityHeaders);

// TASK-112: dynamic CORS allowlist.
//  - Requests with no Origin (curl, server-to-server NextAuth -> Express) pass.
//  - process.env.FRONTEND_URL is always allowed.
//  - In non-production, http://localhost:3000 and http://localhost:3100 are
//    also allowed (client dev server + production-build smoke-test ports).
const FRONTEND_URL =
  process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
const LOCAL_DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:3100'];

app.use(
  cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-organization-id'],
  })
);
app.options('*', cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-organization-id'],
}));

// TASK-112: JSON body parser. The `verify` callback captures the RAW request
// body so the GitHub webhook route can recompute X-Hub-Signature-256 over the
// exact bytes GitHub sent (parsed req.body is not byte-for-byte stable).
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
// Mount orgRoutes at /api also so /api/workspaces/:id/invitations resolves correctly.
app.use('/api', orgRoutes);
app.use('/api/integrations', integrationRoutes);

// Webhook routes (GitHub, Slack, Jira) — raw-body access is already set up
// by the express.json verify callback above, so these share the same parser.
app.use('/api/webhooks', integrationRoutes);

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'PulseOps server is running' });
});

// TASK-112: JSON 404 + global error handler (production error masking).
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use(errorHandler);

const startServer = async () => {
  await connectDB();
  app.listen(process.env.PORT || 5000, () => {
    console.log(`Server running on port ${process.env.PORT || 5000}`);
  });
};

// Start only when executed directly (`node server.js`); exporting the app lets
// gate/test harnesses exercise the full wiring without binding a port or
// requiring a live database.
if (require.main === module) {
  startServer();
}

module.exports = app;
