/**
 * Activity service for fetching and processing activity data
 * @typedef {Object} Activity
 * @property {mongoose.Types.ObjectId} organizationId
 * @property {string} source - github, slack, or jira
 * @property {string} sourceId
 * @property {string} actor
 * @property {Date} timestamp
 * @property {string} type
 * @property {Object} metadata
 */

/**
 * Options for filtering activity data
 * @typedef {Object} GetActivityOptions
 * @property {string} organizationId - Organization ID (string format for compatibility)
 * @property {Date} startDate - Start date for query (inclusive)
 * @property {Date} endDate - End date for query (inclusive)
 * @property {'github'|'slack'|'jira'} [source] - Optional source filter
 * @property {string} [type] - Optional activity type filter
 * @property {string} [actor] - Optional actor filter
 */

const Activity = require('../../models/Activity');
const mongoose = require('mongoose');

/**
 * Convert organizationId to ObjectId, handling both string and ObjectId formats
 * @param {string|mongoose.Types.ObjectId} orgId - Organization ID
 * @returns {mongoose.Types.ObjectId} Valid ObjectId
 */
function toObjectId(orgId) {
  if (!orgId) return null;
  if (orgId instanceof mongoose.Types.ObjectId) return orgId;
  if (typeof orgId === 'string' && /^[0-9a-fA-F]{24}$/.test(orgId)) {
    return new mongoose.Types.ObjectId(orgId);
  }
  // If it's not a valid ObjectId, throw an error with helpful message
  throw new Error(`Invalid organizationId format: "${orgId}". Expected a 24-character hex string.`);
}

/**
 * Get activities for a specific organization and date range with optional filters
 * @param {GetActivityOptions} options - Filter options
 * @returns {Promise<Array>} Array of activity documents
 */
async function getActivityForRange(options) {
  const { organizationId, startDate, endDate, source, type, actor } = options;

  // Build query - convert organizationId to ObjectId
  let orgObjectId;
  try {
    orgObjectId = toObjectId(organizationId);
  } catch (error) {
    console.error('❌ Invalid organizationId:', error.message);
    return []; // Return empty array instead of throwing
  }

  const query = {
    organizationId: orgObjectId,
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  };

  // Add optional filters
  if (source) query.source = source;
  if (type) query.type = type;
  if (actor) query.actor = actor;

  console.log(`🔍 Querying activities for org: ${orgObjectId}, date range: ${startDate} to ${endDate}`);

  // Execute query with sorting (newest first) and lean() for performance
  const activities = await Activity.find(query)
    .sort({ timestamp: -1 })
    .lean()
    .exec();

  console.log(`✅ Found ${activities.length} activities`);
  return activities;
}

/**
 * Get activity counts by type for a specific organization and date range
 * @param {string} organizationId - Organization ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Object with activity types as keys and counts as values
 */
async function getActivityCountsByType(organizationId, startDate, endDate) {
  try {
    const activities = await getActivityForRange({
      organizationId,
      startDate,
      endDate
    });

    const counts = {};
    activities.forEach(activity => {
      const type = activity.type;
      counts[type] = (counts[type] || 0) + 1;
    });

    return counts;
  } catch (error) {
    console.error('Error in getActivityCountsByType:', error);
    throw error;
  }
}

/**
 * Get all activities for a specific week (7 days starting from weekStart)
 * @param {string} organizationId - Organization ID
 * @param {Date} weekStart - Start of the week (Monday 00:00:00)
 * @returns {Promise<Array>} Array of activity documents for the week
 */
async function getWeeklyActivity(organizationId, weekStart) {
  try {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return getActivityForRange({
      organizationId,
      startDate: weekStart,
      endDate: weekEnd
    });
  } catch (error) {
    console.error('Error in getWeeklyActivity:', error);
    throw error;
  }
}

module.exports = {
  getActivityForRange,
  getActivityCountsByType,
  getWeeklyActivity
};