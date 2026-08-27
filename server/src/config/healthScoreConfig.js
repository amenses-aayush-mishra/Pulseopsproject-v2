/**
 * Configuration constants for the deterministic PulseOps Org Health Score engine.
 * Total base score max = 100 points, subject to penalties.
 */
module.exports = {
  WEIGHTS: {
    prVelocity: 25,       // Max 25 points
    avgReviewTime: 25,    // Max 25 points
    ticketResolution: 25, // Max 25 points
    commsActivity: 25,    // Max 25 points
  },
  TARGETS: {
    prVelocityTarget: 10,       // Target: 10 merged PRs / period
    avgReviewHoursTarget: 24,   // Target: under 24 hours review time
    ticketResolutionRateTarget: 0.8, // Target: 80% resolution rate
    commsActivityTarget: 50,    // Target: 50 Slack messages / period
  },
  PENALTIES: {
    staleTicketDeduction: 3,     // -3 points per stale/overdue ticket (capped at -15)
    zeroActivityDayDeduction: 5, // -5 points per zero-activity day (capped at -20)
    maxStalePenalty: 15,
    maxQuietPenalty: 20,
  },
};
