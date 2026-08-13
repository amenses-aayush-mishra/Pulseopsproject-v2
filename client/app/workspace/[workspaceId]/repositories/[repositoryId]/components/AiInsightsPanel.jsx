'use client';

import { Sparkles, BrainCircuit } from 'lucide-react';

const healthScore = 86;

const metrics = [
  { label: 'Code Quality', value: 92, bar: 'from-indigo-500 to-violet-500' },
  { label: 'Delivery Velocity', value: 78, bar: 'from-violet-500 to-fuchsia-500' },
  { label: 'Collaboration Score', value: 84, bar: 'from-sky-500 to-indigo-500' },
  { label: 'Sprint Progress', value: 64, bar: 'from-emerald-500 to-teal-500' },
];

const week = [
  { day: 'M', value: 6 },
  { day: 'T', value: 10 },
  { day: 'W', value: 5 },
  { day: 'T', value: 13 },
  { day: 'F', value: 8 },
  { day: 'S', value: 3 },
  { day: 'S', value: 2 },
];

function HealthRing({ value }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#eef2f7" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#healthGradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="healthGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-900">{value}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">/ 100</span>
      </div>
    </div>
  );
}

export default function AiInsightsPanel() {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <BrainCircuit className="h-4 w-4 text-violet-500" />
          AI Engineering Insights
        </h2>
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600">
          UI Preview
        </span>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {/* Health score */}
        <div className="flex items-center gap-4">
          <HealthRing value={healthScore} />
          <div>
            <p className="text-sm font-semibold text-slate-900">Engineering Health</p>
            <p className="mt-1 max-w-[150px] text-xs leading-relaxed text-slate-500">
              Overall repository health across quality, velocity and collaboration.
            </p>
          </div>
        </div>

        {/* Metric bars */}
        <div className="space-y-4">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[13px] font-medium text-slate-700">{m.label}</span>
                <span className="text-[13px] font-semibold text-slate-900">{m.value}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${m.bar} transition-all`}
                  style={{ width: `${m.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Weekly activity */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Weekly Activity</p>
            <span className="text-[11px] text-slate-400">commits</span>
          </div>
          <div className="flex h-32 items-end gap-2">
            {week.map((d) => (
              <div key={`${d.day}-${d.value}`} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] font-medium text-slate-400">{d.value}</span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-indigo-500 to-violet-500 transition-transform"
                  style={{ height: `${Math.max(6, d.value * 9)}px` }}
                />
                <span className="text-[10px] text-slate-400">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5 text-[11px] text-violet-700">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          AI estimates refresh daily. Composable with Slack + Jira signals in Phase&nbsp;2.
        </div>
      </div>
    </section>
  );
}