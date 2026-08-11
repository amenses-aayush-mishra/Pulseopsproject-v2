'use strict';

/**
 * TASK-112 — Global Express error-handling middleware with production error
 * masking. Mounted last in server.js (after all routes + JSON 404 handler).
 *
 * Production:  5xx errors return a generic payload — raw internal messages and
 *               stack traces are never sent to clients (logged server-side
 *               only). Non-5xx (client) errors keep their message.
 * Non-production: the error message is returned for debugging.
 */
module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;

  if (process.env.NODE_ENV === 'production') {
    console.error(`[errorHandler] ${status}:`, err.message);
    if (status >= 500) {
      return res.status(status).json({ message: 'Internal server error' });
    }
    return res.status(status).json({ message: err.message || 'Bad request' });
  }

  console.error('[errorHandler]', err.stack || err.message);
  return res.status(status).json({ message: err.message || 'Internal server error' });
};
