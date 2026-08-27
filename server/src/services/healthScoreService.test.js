'use strict';

const { computeDeterministicHealthScore } = require('./healthScoreService');

console.log('🧪 Running Health Score Service Tests...\n');

function check(title, condition, detail = '') {
  if (condition) {
    console.log(`✅ ${title}`);
  } else {
    console.error(`❌ FAILED: ${title} (${detail})`);
    process.exitCode = 1;
  }
}

// Test 1: Ideal max activity yields 100 score
const ideal = computeDeterministicHealthScore({
  prsMerged: 10,
  prsOpened: 10,
  issuesCompleted: 10,
  issuesCreated: 10,
  slackMessages: 50,
  activeDevelopers: 5,
  staleTickets: 0,
  zeroActivityDays: 0,
});
check('Ideal activity yields score of 100', ideal.totalScore === 100, `Got score: ${ideal.totalScore}`);
check('Ideal score label is Excellent', ideal.healthLabel === 'Excellent', `Got label: ${ideal.healthLabel}`);
check('PR Velocity breakdown matches 25/25', ideal.breakdown.prVelocity.score === 25, `Got: ${ideal.breakdown.prVelocity.score}`);

// Test 2: Partial activity calculates correctly
const partial = computeDeterministicHealthScore({
  prsMerged: 5,         // 5/10 -> 12.5 -> 13
  prsOpened: 10,        // 5/10 -> 50% merge ratio -> 12.5 -> 13
  issuesCompleted: 4,   // 4/5 -> 80% resolution -> 20
  issuesCreated: 5,
  slackMessages: 25,    // 25/50 -> 12.5 -> 13
  activeDevelopers: 3,
  staleTickets: 1,      // -3
  zeroActivityDays: 1,  // -5
});
check('Partial activity score is calculated correctly', partial.totalScore > 0 && partial.totalScore < 100, `Got score: ${partial.totalScore}`);
check('Penalties calculated correctly', partial.breakdown.penalties.total === -8, `Got penalties: ${partial.breakdown.penalties.total}`);

// Test 3: Zero activity yields 0 score
const zero = computeDeterministicHealthScore({
  prsMerged: 0,
  prsOpened: 0,
  issuesCompleted: 0,
  issuesCreated: 0,
  slackMessages: 0,
  activeDevelopers: 0,
  staleTickets: 5,
  zeroActivityDays: 5,
});
check('Zero activity clamped to 0 score', zero.totalScore === 0, `Got score: ${zero.totalScore}`);

console.log('\n📊 Health Score Service unit tests completed.');
