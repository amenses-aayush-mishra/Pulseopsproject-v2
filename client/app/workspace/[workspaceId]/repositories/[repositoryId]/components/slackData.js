/**
 * Structured dummy Slack data for the Repository Intelligence dashboard.
 *
 * Kept intentionally isolated in its own module so swapping in live Slack
 * messages later is a drop-in change — each entry already mirrors the shape of
 * a real Slack message event (user / text / ts).
 */

const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString();

export const channelName = '#pulseops-releases';

export const slackConnected = true;

export const messages = [
  {
    id: 'm1',
    user: {
      name: 'Aarav Mehta',
      initials: 'AM',
      color: 'bg-indigo-500',
      role: 'Engineering Manager',
    },
    ts: minutesAgo(6),
    text: 'v2.4.1 rolled out to all regions. Zero regressions in the canary — great release train, team! 🚀',
  },
  {
    id: 'm2',
    user: {
      name: 'Priya Sharma',
      initials: 'PS',
      color: 'bg-violet-500',
      role: 'Senior Backend Engineer',
    },
    ts: minutesAgo(12),
    text: 'Merged the auth refactor (#482). Cut p95 latency on /login from 480ms down to 190ms.',
  },
  {
    id: 'm3',
    user: {
      name: 'Rahul Verma',
      initials: 'RV',
      color: 'bg-sky-500',
      role: 'Frontend Engineer',
    },
    ts: minutesAgo(19),
    text: 'Fixed the flickering sidebar in dark mode. Root cause was a race in the theme provider CSS variables.',
  },
  {
    id: 'm4',
    user: {
      name: 'Sneha Iyer',
      initials: 'SI',
      color: 'bg-emerald-500',
      role: 'QA Lead',
    },
    ts: minutesAgo(28),
    text: 'Smoke suite is green on staging — 214/214 passed. Ready to promote the release candidate.',
  },
  {
    id: 'm5',
    user: {
      name: 'Vikram Rao',
      initials: 'VR',
      color: 'bg-amber-500',
      role: 'DevOps Engineer',
    },
    ts: minutesAgo(34),
    text: 'CI matrix now spans 3 Node versions. Median build time down to 4m12s from 7m30s.',
  },
  {
    id: 'm6',
    user: {
      name: 'Ananya Gupta',
      initials: 'AG',
      color: 'bg-rose-500',
      role: 'Product Manager',
    },
    ts: minutesAgo(47),
    text: 'Sprint 24 planning notes are up. The team landed 5 commits on the insights-pipeline epic today.',
  },
  {
    id: 'm7',
    user: {
      name: 'Karan Malhotra',
      initials: 'KM',
      color: 'bg-teal-500',
      role: 'Mobile Engineer',
    },
    ts: minutesAgo(58),
    text: 'Push notifications arrived in TestFlight — deep links working end to end. 🔔',
  },
  {
    id: 'm8',
    user: {
      name: 'Neha Kulkarni',
      initials: 'NK',
      color: 'bg-cyan-500',
      role: 'Data Engineer',
    },
    ts: minutesAgo(72),
    text: 'Backfill job for the metrics warehouse finished. Weekly rollups are in sync for every repo.',
  },
];