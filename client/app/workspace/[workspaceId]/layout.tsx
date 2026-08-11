import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../../../lib/authOptions';
import { ThemeProvider } from '../../providers/ThemeProvider';
import WorkspaceSidebar from '../../_components/WorkspaceSidebar';
import Link from 'next/link';
import { Settings, Puzzle, UserCircle, Search, Menu } from 'lucide-react';

export default async function WorkspaceLayout({ children, params }) {
  const workspaceId = params?.workspaceId;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/workspace/${workspaceId}`)}`);
  }
  const user = session.user as any;
  if (!user.activeOrganizationId) {
    redirect('/onboarding');
  }
  
  if (user.activeOrganizationId !== workspaceId) {
    redirect(`/workspace/${user.activeOrganizationId}`);
  }

  const role = user.role || 'member';
  const isAdmin = role === 'owner' || role === 'admin';

  return (
    <ThemeProvider>
      <div className="flex min-h-screen bg-[var(--sidebar-bg,var(--tw-colors-slate-50))]">
        
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-slate-200 bg-white/50 backdrop-blur-sm transition-all hidden md:block">
          <div className="flex h-16 items-center px-6 border-b border-slate-200">
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">PulseOps</span>
          </div>
          
          <div className="p-4 space-y-1">
            <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Workspace</div>
            
            <Link href={`/workspace/${workspaceId}`} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors">
              Projects
            </Link>
            <Link href={`/workspace/${workspaceId}/tasks`} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors">
              Tasks
            </Link>
            
            <div className="mt-8 mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Administration</div>
            
            {isAdmin && (
              <>
                <Link href={`/workspace/${workspaceId}/invitations`} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors">
                  <UserCircle className="h-4 w-4" /> Team & Invites
                </Link>
                <Link href={`/workspace/${workspaceId}/settings`} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors">
                  <Settings className="h-4 w-4" /> Settings
                </Link>
                <Link href={`/workspace/${workspaceId}/integrations`} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors">
                  <Puzzle className="h-4 w-4" /> Integrations
                </Link>
              </>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
          {/* Top Header */}
          <header className="flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            <button type="button" className="-m-2.5 p-2.5 text-slate-700 md:hidden">
              <span className="sr-only">Open sidebar</span>
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
              <form className="relative flex flex-1" action="#" method="GET">
                <label htmlFor="search-field" className="sr-only">Search</label>
                <Search className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-slate-400" aria-hidden="true" />
                <input
                  id="search-field"
                  className="block h-full w-full border-0 bg-transparent py-0 pl-8 pr-0 text-slate-900 placeholder:text-slate-400 focus:ring-0 sm:text-sm"
                  placeholder="Global search across tasks, projects, members..."
                  type="search"
                  name="search"
                />
              </form>
              <div className="flex items-center gap-x-4 lg:gap-x-6">
                <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-slate-200" aria-hidden="true" />
                
                <div className="relative flex items-center gap-2">
                  <span className="hidden lg:flex lg:items-center">
                    <span className="ml-4 text-sm font-semibold leading-6 text-slate-900" aria-hidden="true">{session.user.name}</span>
                  </span>
                  <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                    {role}
                  </span>
                  <UserCircle className="h-8 w-8 text-slate-400" />
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}