const { validateAISummary, validateWithRetry, PartialAISummarySchema } = require('./ai-summary.validation');

// Test data
const validSummary = {
  summary: 'Team showed strong velocity this week with increased PR activity.',
  key_metrics: {
    prs_merged: 15,
    prs_opened: 20,
    active_developers: 8,
    jira_issues_completed: 12,
    jira_issues_created: 18,
    slack_messages: 450
  },
  top_contributors: ['alice@example.com', 'bob@example.com'],
  risks: ['PR review delays', 'Technical debt accumulation'],
  recommendations: ['Increase code review bandwidth', 'Schedule refactoring sprint']
};

const invalidSummaryMissingFields = {
  summary: 'Team showed strong velocity',
  // Missing key_metrics
  top_contributors: ['alice@example.com']
};

const invalidSummaryWrongTypes = {
  summary: 'Team showed strong velocity this week with increased PR activity.',
  key_metrics: {
    prs_merged: 'fifteen', // Should be number
    prs_opened: 20,
    active_developers: 8,
    jira_issues_completed: 12,
    jira_issues_created: 18,
    slack_messages: 450
  },
  top_contributors: ['alice@example.com', 'bob@example.com'],
  risks: ['PR review delays', 'Technical debt accumulation'],
  recommendations: ['Increase code review bandwidth', 'Schedule refactoring sprint']
};

const invalidSummaryTooShort = {
  summary: 'Too short', // Less than 10 characters
  key_metrics: {
    prs_merged: 15,
    prs_opened: 20,
    active_developers: 8,
    jira_issues_completed: 12,
    jira_issues_created: 18,
    slack_messages: 450
  },
  top_contributors: ['alice@example.com', 'bob@example.com'],
  risks: ['PR review delays', 'Technical debt accumulation'],
  recommendations: ['Increase code review bandwidth', 'Schedule refactoring sprint']
};

async function runTests() {
  console.log('🧪 Running AI Summary Validation Tests...\n');

  // Test 1: Valid summary
  try {
    const result = validateAISummary(validSummary);
    console.log('✅ Test 1 PASSED: Valid summary validated correctly');
    console.log(`   Summary: ${result.summary.substring(0, 30)}...\n`);
  } catch (error) {
    console.log('❌ Test 1 FAILED: Valid summary should pass validation');
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 2: Missing required fields
  try {
    validateAISummary(invalidSummaryMissingFields);
    console.log('❌ Test 2 FAILED: Should have thrown error for missing key_metrics\n');
  } catch (error) {
    console.log('✅ Test 2 PASSED: Correctly caught missing key_metrics');
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 3: Wrong field types
  try {
    validateAISummary(invalidSummaryWrongTypes);
    console.log('❌ Test 3 FAILED: Should have thrown error for wrong prs_merged type\n');
  } catch (error) {
    console.log('✅ Test 3 PASSED: Correctly caught wrong prs_merged type');
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 4: Summary too short
  try {
    validateAISummary(invalidSummaryTooShort);
    console.log('❌ Test 4 FAILED: Should have thrown error for summary too short\n');
  } catch (error) {
    console.log('✅ Test 4 PASSED: Correctly caught summary too short');
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 5: Partial validation
  try {
    const partialData = { summary: 'Updated summary with more than ten characters.' };
    const result = PartialAISummarySchema.validate(partialData);
    if (!result.error) {
      console.log('✅ Test 5 PASSED: Partial validation works correctly');
      console.log(`   Validated: ${result.value.summary}\n`);
    } else {
      console.log('❌ Test 5 FAILED: Partial validation should work\n');
    }
  } catch (error) {
    console.log('❌ Test 5 FAILED: Partial validation threw error');
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 6: Retry mechanism (simulating a failing then succeeding function)
  try {
    let attemptCount = 0;
    const failingThenSucceedingFn = async () => {
      attemptCount++;
      if (attemptCount < 2) {
        throw new Error('Simulated failure');
      }
      return validSummary;
    };

    const result = await validateWithRetry(failingThenSucceedingFn, 3, 10);
    if (result.summary === validSummary.summary) {
      console.log('✅ Test 6 PASSED: Retry mechanism worked correctly');
      console.log(`   Succeeded on attempt ${attemptCount}\n`);
    } else {
      console.log('❌ Test 6 FAILED: Retry mechanism did not return correct result\n');
    }
  } catch (error) {
    console.log('❌ Test 6 FAILED: Retry mechanism should have succeeded');
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 7: Retry mechanism exhaustion
  try {
    const alwaysFailingFn = async () => {
      throw new Error('Always fails');
    };

    await validateWithRetry(alwaysFailingFn, 2, 10);
    console.log('❌ Test 7 FAILED: Should have thrown error after retries exhausted\n');
  } catch (error) {
    if (error.message === 'Always fails') {
      console.log('✅ Test 7 PASSED: Retry mechanism correctly exhausted retries');
      console.log(`   Final error: ${error.message}\n`);
    } else {
      console.log('❌ Test 7 FAILED: Wrong error thrown');
      console.log(`   Error: ${error.message}\n`);
    }
  }

  console.log('🧪 Validation tests completed.');
}

runTests().catch(console.error);