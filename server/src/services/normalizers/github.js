/**
 * Normalize a GitHub webhook payload into the Activity shape.
 *
 * Event-type mapping follows the PulseOps spec:
 *   - pull_request opened         -> pr_opened
 *   - pull_request closed+merged  -> pr_merged
 *   - pull_request closed         -> pr_closed
 *   - other pull_request actions  -> pr_<action>
 *   - push                        -> push
 *   - ping                        -> ping
 *
 * These identifiers are the ones `context-builder.service.js` (buildGitHubContext)
 * and the Gemini prompts tally, so the pipeline stays consistent end-to-end.
 *
 * @param {Object} payload - Raw GitHub webhook body
 * @param {string} organizationId - Resolved organization id
 * @returns {Object} Normalized Activity shape
 */
function getGithubEventType(payload) {
  // Push events carry `ref` + a `commits` array.
  if (payload && payload.ref && Array.isArray(payload.commits)) {
    return 'push';
  }

  // Pull request events carry a `pull_request` object.
  if (payload && payload.pull_request) {
    const action = payload.action;
    if (action === 'opened') return 'pr_opened';
    if (action === 'closed') {
      return payload.pull_request.merged === true ? 'pr_merged' : 'pr_closed';
    }
    return `pr_${action}`; // e.g. pr_synchronize, pr_reopened, pr_edited
  }

  // GitHub pings the endpoint when a webhook is created/updated.
  if (payload && payload.zen) {
    return 'ping';
  }

  return (payload && payload.action) || 'unknown';
}

function normalizeGithub(payload, organizationId) {
  const actor =
    payload?.sender?.login ||
    payload?.pull_request?.user?.login ||
    payload?.pusher?.name ||
    'unknown';

  let sourceId = '';
  if (payload?.pull_request?.id) {
    sourceId = payload.pull_request.id.toString();
  } else if (payload?.repository?.id) {
    sourceId = payload.repository.id.toString();
  } else if (payload?.action) {
    sourceId = `${payload.action}_${Date.now()}`;
  } else {
    sourceId = 'unknown';
  }

  const type = getGithubEventType(payload);

  return {
    organizationId,
    source: 'github',
    sourceId,
    actor,
    timestamp: new Date(), // GitHub webhooks carry no timestamp; use receipt time
    type,
    metadata: {
      ...payload,
      // Cached convenience fields for cheap filtering / debugging.
      event_type: type,
      repository: payload?.repository,
      sender: payload?.sender,
      pull_request: payload?.pull_request,
    },
  };
}

module.exports = { normalizeGithub };