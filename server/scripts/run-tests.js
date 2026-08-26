/*
 * run-tests.js — aggregate runner for the PulseOps console-script test suites.
 *
 * The repo has no jest/vitest; every suite is a standalone script that prints
 * ✅/❌ lines and exits non-zero on failure. This runner executes them all,
 * streams output, and exits non-zero if any suite fails.
 *
 * Usage: node scripts/run-tests.js   (from the server/ directory)
 */
const { spawnSync } = require('child_process');
const path = require('path');

const suites = [
  'src/services/normalizers/normalizers.test.js', // Ticket 1
  'src/routes/webhooks/webhooks.test.js',         // Ticket 2
  'src/services/ai/activity.service.test.js',     // Ticket 3
  'src/ai/services/context-builder.test.js',      // Ticket 4
  'src/services/ai/gemini.service.test.js',       // Ticket 5
  'src/ai/validation/ai-summary.validation.test.js', // Ticket 6
  'src/routes/ai-summaries.route.test.js',        // Ticket 7
];

let failures = 0;

console.log('🧪 PulseOps server test runner\n');
for (const suite of suites) {
  console.log(`\n─────────────────────────────────────────────`);
  console.log(`▶ ${suite}`);
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', suite)], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    failures++;
    console.log(`❌ FAILED (${suite})`);
  }
}

console.log('\n═════════════════════════════════════════════');
if (failures > 0) {
  console.log(`❌ ${failures} of ${suites.length} suites failed`);
  process.exit(1);
}
console.log(`✅ All ${suites.length} suites passed`);
process.exit(0);