const mongoose = require('mongoose');

const REPLICA_SET_ONLY_ERROR =
  'Transaction numbers are only allowed on a replica set';

/**
 * Executes workFn inside a MongoDB transaction when the deployment supports it.
 *
 * - On a replica set (or sharded cluster): runs workFn(session) inside a
 *   transaction, commits on success, aborts on failure.
 * - On a standalone MongoDB instance: the driver throws
 *   "Transaction numbers are only allowed on a replica set" when the session
 *   transaction starts. We detect that specific error and transparently
 *   fall back to non-transactional execution via workFn(null).
 *
 * @param {Function} workFn - Async function that receives (session). When the
 *   standalone fallback is active, session is null.
 * @returns {Promise<any>} The value returned by workFn.
 */
const runInTransaction = async (workFn) => {
  const session = await mongoose.startSession();
  try {
    await session.startTransaction();
    const result = await workFn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (error && error.message && error.message.includes(REPLICA_SET_ONLY_ERROR)) {
      console.warn('Standalone MongoDB detected, falling back to non-transactional execution');
      return await workFn(null);
    }
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

module.exports = { runInTransaction };