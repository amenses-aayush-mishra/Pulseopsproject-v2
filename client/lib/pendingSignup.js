// Transient, in-memory holder for a signup form in progress, so a user who goes
// Back from /verify-email lands on /register with their Username / Email /
// Password / Confirm Password restored (e.g. to fix a mistyped email).
//
// Lives only in the browser's JS heap — never persisted to localStorage /
// sessionStorage, never in URLs or API payloads — and is cleared as soon as
// /register consumes it (or when the tab is closed). Used purely for the
// client-side Back navigation between the two pages.
const pending = { username: '', email: '', password: '', confirm: '' };

export function setPendingSignup(values) {
  pending.username = values?.username || '';
  pending.email = values?.email || '';
  pending.password = values?.password || '';
  pending.confirm = values?.confirm || '';
}

export function takePendingSignup() {
  const values = { ...pending };
  pending.username = '';
  pending.email = '';
  pending.password = '';
  pending.confirm = '';
  return values;
}
