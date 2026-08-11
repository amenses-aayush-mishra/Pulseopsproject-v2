// TASK-113 — landing hero (light glassmorphic aesthetic, gradient wordmark).
export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F9FAFB] text-slate-900">
      {/* Subtle grid + soft gradient glows */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(99,102,241,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.07) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-300/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-violet-300/40 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pt-28 pb-20 text-center">
        <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 text-xl font-bold text-white shadow-lg shadow-indigo-500/30">
          P
        </span>
        <h1 className="bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
          PulseOps
        </h1>
        <p className="mt-4 max-w-xl text-lg text-slate-500">
          Infrastructure monitoring and incident response for modern teams.
          Set up your workspace in minutes — invite your teammates, watch your
          services, and deploy with confidence.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/register"
            className="rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-opacity hover:opacity-90"
          >
            Get started
          </a>
          <a
            href="/login"
            className="rounded-xl border border-slate-300 bg-white/80 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-xl transition-colors hover:bg-white hover:text-indigo-700"
          >
            Sign in
          </a>
        </div>

        <dl className="mt-16 grid w-full gap-4 sm:grid-cols-3">
          {[
            {
              title: 'Workspaces',
              body: 'Multi-tenant organizations with owner, admin, tech-lead and developer roles.',
            },
            {
              title: 'Invitations',
              body: 'One-click secure invites with email locking and pending-invite awareness.',
            },
            {
              title: 'Secure by default',
              body: 'Email verification, JWT sessions, rate limiting and hardened headers.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/60 bg-white/70 p-5 text-left shadow-sm shadow-indigo-100/50 backdrop-blur-xl"
            >
              <dt className="text-sm font-semibold text-slate-900">{item.title}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-slate-500">{item.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </main>
  );
}

