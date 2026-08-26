# PulseOps MVP Audit Report

**Date:** 2026-08-24
**Version:** 1.0
**Scope decision:** Audit & test what exists; fix critical bugs + add per-ticket tests; missing UI pages marked **out of scope**.

---

## Summary

| Metric | Value |
|---|---|
| Test suites run | 7 server + 2 client = **9** |
| Assertions passed | **~101** |
| Assertions failed | **0** |
| Critical defects found | **4** (all fixed) |
| Spec-vs-code discrepancies documented | 5 |

### How to run

```bash
cd server && npm test          # runs all 7 server suites via scripts/run-tests.js
cd client && node app/_components/aiSummaryApi.test.js           # Ticket 8 API layer
cd client && node app/_components/aiSummaryPanel.syntax.test.js  # Ticket 8 JSX parse check
```

> Note: no jest/vitest/mocha/supertest is installed (offline machine). All suites are
> repo-convention console scripts (`node file.test.js`, exit code = pass/fail). `npm test`
> was added to `server/package.json` as an aggregate runner.

---

## Critical Issues Found — all FIXED during this audit

1. **GitHub webhook route crashed on load (Ticket 2).**
   `src/routes/webhooks/github.js` required `../verifyGithubWebhook` → resolves to
   `server/src/routes/verifyGithubWebhook.js`, which does not exist → `MODULE_NOT_FOUND`.
   **Fix:** require `../../middleware/verifyGithubWebhook`.

2. **Wrong normalizer import (Tickets 1–2).**
   Route imported `normalizeGitHubPayload`; the module exports `normalizeGithub`. Would have thrown at request time.
   **Fix:** corrected to `normalizeGithub`.

3. **Signature verification misused + body-parser conflict (Ticket 2).**
   The route called `verifyWebhookSignature(secret, payload, signature)` as a boolean function, but that export is an
   Express middleware `(req,res,next)`. The route also layered `express.raw()` over the app-level `express.json()`,
   making `req.body` a Buffer and breaking `req.body.repository?.id`.
   **Fix:** apply `verifyGithubWebhook` as middleware; drop the local `express.raw()`; handler uses parsed JSON while
   verification uses `req.rawBody`.

4. **Storage routes shadowed by logging stubs (pipeline dead end for Tickets 1–3).**
   `server.js` mounted `integrationRoutes` (log-only `/github`, `/jira` handlers that never store) at `/api/webhooks`
   *before* the real storage router, so `POST /api/webhooks/github` never persisted anything.
   **Fix:** removed the duplicate mount; `webhooks/index` is now the canonical `/api/webhooks/*` router;
   `integrationRoutes` keeps serving its logger under `/api/integrations/*`.

5. *(Robustness)* `normalizeGithub(null, …)` threw on `payload.action`.
   **Fix:** optional chaining.

---

## Spec-vs-Code Discrepancies (documented)

| Audit doc expects | Codebase reality | Resolution |
|---|---|---|
| Zod schema at `src/ai/schemas/ai-summary.schema` (`ZodError`) | **Joi** schema at `src/ai/validation/ai-summary.validation.js` (`ai/schemas/` empty) | Kept Joi; T6 tests target Joi errors |
| `geminiService.generateSummaryWithValidation(...)` | `generateSummary(...)` (already wraps validate+retry) | Kept existing method |
| GitHub types `pr_merged`/`pr_opened`/`push`; Jira `issue_created`/`issue_updated` | Normalizers produced raw `opened`/`closed`/`unknown` and `jira:issue_created` | **Fixed normalizers** to emit spec identifiers — required anyway because `context-builder.service.js` already tallies `pr_opened` / `pr_closed(+metadata.prState merged)` |
| Slack `file_share` type | Only `message` was produced | **Fixed**: message with `subtype:'file_share'` or `files[]` maps to `file_share` |
| Dashboard with Org Health Score, KPI trend cards, team-health list, risks & alerts; pages `/developers`, `/analytics`, `/tickets`, `/reports` | Actual dashboard = `WorkspaceDashboard.jsx` widgets + `AISummaryPanel`; sidebar has Overview / Integrations / Invitation & Password | **Out of scope** (see UI section) |


---

## Ticket-by-Ticket Results

### Ticket 1 — Normalize incoming webhooks ✅ (14/14)
File: `server/src/services/normalizers/normalizers.test.js`

| Test | Status |
|---|---|
| T1-01 GitHub PR opened → `pr_opened`, actor from sender | ✅ |
| T1-02 GitHub PR merged → `pr_merged`; closed-not-merged → `pr_closed` | ✅ |
| T1-03 GitHub push → `push` | ✅ |
| T1-04 Slack message → `message` | ✅ |
| T1-05 Slack file share → `file_share` | ✅ |
| T1-06 Jira issue created → `issue_created` | ✅ |
| T1-07 Jira issue updated → `issue_updated` | ✅ |
| T1-08 null payload handled without throwing (`unknown` type) | ✅ |
| T1-09 missing organizationId propagates undefined (routes guard it) | ✅ |
| Shape: source/type/actor/timestamp(Date)/metadata on every activity; ping robustness | ✅ |

### Ticket 2 — Store normalized events ✅ (14/14)
File: `server/src/routes/webhooks/webhooks.test.js` (real HTTP + mocked `Integration`/`Activity`, HMAC-signed payloads)

| Test | Status |
|---|---|
| T2-01 `POST /api/webhooks/github` → 200 `{received:true, activityId}` | ✅ |
| T2-04 GitHub payload stored (source=github) | ✅ |
| T2-05 Slack message stored (valid X-Slack-Signature, tracked team) | ✅ |
| T2-06 Jira payload stored (orgId in body); missing orgId → 400 | ✅ |
| T2-07 duplicate payload → two Activity documents (no dedup) | ✅ |
| T2-08 Slack `url_verification` → challenge echoed | ✅ |
| T2-09 invalid signature (GitHub & Slack) → 401 | ✅ |
| T2-10 untracked repository → 200 "not tracked" | ✅ |

### Ticket 3 — Fetch activities for a time window ✅ (11/11)
File: `server/src/services/ai/activity.service.test.js` (query construction asserted against a mocked model)

T3-01 by orgId (+ ObjectId cast, `$gte/$lte` window) · T3-02 custom date window · T3-03 source filter ·
T3-04 type filter · T3-05 actor filter · T3-06 no activities → `[]` · T3-07 reversed range matches nothing — **all pass**.
Also verified: filters compose (source+actor), sort is timestamp descending.

### Ticket 4 — Context building ✅ (12/12)
File: `server/src/ai/services/context-builder.test.js`

T4-01 empty input message · T4-02/03/04 per-source contexts · T4-05 mixed sources with totals, breakdown and
contributors · T4-06 100+ activities truncated ("... and 80 more activities") · T4-07 absent-source fallbacks ·
plain-text output (no JSON braces) — **all pass**.

### Ticket 5 — Gemini structured output ✅ (9/9, mocked transport)
File: `server/src/services/ai/gemini.service.test.js` (mocks `@google/generative-ai`; no key/network needed)

T5-01 valid context → summary object with integer metrics · T5-03 minimal context generates ·
T5-04 persistent failure throws after retries · T5-06 non-JSON rejected · missing `key_metrics` rejected by Joi ·
retry invalid→valid succeeds on exactly 2 calls · numeric coercion `"8"`→`8` — **all pass**.

⚠️ **Not verified live:** `GEMINI_API_KEY` absent from `server/.env`; machine is offline. Add the key and run one
`POST /api/ai-summaries` to close the live leg.

### Ticket 6 — Validation ✅ (existing suite passes)
File: `server/src/ai/validation/ai-summary.validation.test.js`
Valid summary passes; missing `key_metrics`, wrong types, too-short summary rejected; partial schema validates;
retry-with-backoff succeeds on attempt 2; exhausted retries throw. *Implemented in Joi → `ValidationError`, not `ZodError`.*

### Ticket 7 — Save + serve ✅ (27/27)
File: `server/src/routes/ai-summaries.route.test.js`
Save + 201 with normalized enum type (`weekly`→`weekly_summary`), `key_metrics`/`generatedAt` persisted, context +
short type fed to Gemini; `GET /latest` 200 / 404+`data:null` / orgId required; `GET /` pagination incl. clamping
(`limit≤50`, `offset≥0`) and `hasMore`; `GET /:id` found / not-found / CastError→400.

### Ticket 8 — Dashboard button ✅ (13 client checks + production build)
Files: `client/app/_components/aiSummaryApi.test.js` (11), `aiSummaryPanel.syntax.test.js` (2)
API layer: GET-latest URL encodes orgId, `.data` unwrapping, 404→null empty state, error propagation, POST path/method/body.
Component parses as valid JSX; full `next build` compiles with ESLint clean (unescaped entities fixed).

---

## UI/UX Audit (current dashboard only)

Implemented & verified:
- ✅ `WorkspaceDashboard`: top bar, workspace switcher, invite modal trigger, sign-out
- ✅ Overview widgets: Active Services / Deployment Status / Team Members
- ✅ `AISummaryPanel`: loading spinner, empty state, error banner + dismiss, generate button pending state,
      6-metric grid, contributors / risks / recommendations sections, refresh, report id footer
- ✅ React Query provider wired (`QueryClientProvider` inside `SessionProvider`)
- ✅ Responsive rules in `AISummaryPanel.css` (≤768px, ≤480px)

Out of scope (referenced by the audit doc but **not part of the current MVP build**):
- ❌ Org Health Score card, KPI cards with week-over-week trends, Team health list, Risks & alerts list
- ❌ Pages: `/developers`, `/analytics`, `/tickets`, `/channels` (dashboard level), `/reports`
- These need new backend aggregation endpoints before frontend work → follow-up tickets.

---

## End-to-End Integration Status

| Leg | Status |
|---|---|
| Webhook → normalize → store | ✅ verified (mocked models over real HTTP) |
| Retrieval filters / window | ✅ verified (mocked model, real query builder) |
| Context building | ✅ verified |
| Gemini generation | ✅ mocked transport; ⚠️ live call unverified (no API key, offline) |
| Save + serve endpoints | ✅ verified (mocked model over real HTTP) |
| Dashboard rendering | ✅ JSX/build verified; runtime browser pass needs `next dev` + live API |
| Live MongoDB E2E | ⛔ Blocked — Atlas URI configured but unreachable here (`querySrv ECONNREFUSED`). Probe: `node server/scripts/mongo-probe.js` |

---

## Recommendations

1. Set `GEMINI_API_KEY` in `server/.env`, then run one live generation to close Ticket 5's live leg.
2. Re-run with MongoDB reachable to convert mocked persistence assertions into real DB writes
   (`cd server && npm test` needs no DB; the curl-based manual checks do).
3. Consolidate Slack handling: `webhooks/slack.js` (storage) currently answers `/api/webhooks/slack` before
   `slackWebhookRoutes.js` (queue) which is also mounted there — works today via first-match-wins, but should be
   one handler with an explicit storage-vs-queue strategy.
4. Follow-up tickets for out-of-scope dashboard pages (health score, developers, reports) require new
   aggregation endpoints first.
5. If jest/vitest is adopted later, these console suites port directly.

## Sign-off

- [x] Critical issues resolved (5 fixed)
- [x] All runnable suites passing (~101 assertions, 0 failures)
- [ ] Live Gemini + live MongoDB verification (blocked on environment)
- [x] Out-of-scope UI items documented
(continued below)