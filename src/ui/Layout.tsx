import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { IconFood, IconPlan, IconSettings, IconStats, IconToday, IconWeek } from './icons'
import { BackupBanner } from './components/BackupBanner'

const TABS = [
  { to: '/aujourdhui', label: "Aujourd'hui", Icon: IconToday },
  { to: '/semaine', label: 'Semaine', Icon: IconWeek },
  { to: '/plan', label: 'Plan', Icon: IconPlan },
  { to: '/nutrition', label: 'Nutrition', Icon: IconFood },
  { to: '/suivi', label: 'Suivi', Icon: IconStats },
]

export function Layout() {
  const { pathname } = useLocation()
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-12">
          <span className="display text-lg">Coach</span>
          {pathname !== '/reglages' && (
            <Link to="/reglages" aria-label="Réglages" className="w-11 h-11 -mr-2 flex items-center justify-center text-muted">
              <IconSettings />
            </Link>
          )}
        </div>
      </header>
      <BackupBanner />
      <main className="flex-1 px-4 pt-3 pb-[calc(84px+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <nav
        aria-label="Navigation principale"
        className="fixed bottom-0 inset-x-0 z-10 bg-surface/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-5">
          {TABS.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 h-16 text-xs font-medium ${isActive ? 'text-ink' : 'text-muted'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`flex items-center justify-center w-12 h-7 rounded-full ${isActive ? 'bg-accent text-on-accent' : ''}`}>
                      <Icon width={20} height={20} />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h1 className="display text-2xl">{children}</h1>
      {sub && <p className="text-muted mt-1">{sub}</p>}
    </div>
  )
}
