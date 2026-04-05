import { Link, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const links = [
  { to: '/', label: 'Home' },
  { to: '/upload', label: 'Upload' },
  { to: '/settings', label: 'Settings' },
]

export function Navbar() {
  const { theme, setTheme } = useApp()
  const loc = useLocation()

  const cycleTheme = () => {
    const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const i = order.indexOf(theme)
    setTheme(order[(i + 1) % order.length])
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link
          to="/"
          className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-violet-600 dark:text-violet-400"
        >
          AI Voice News
        </Link>
        <nav className="flex flex-1 items-center justify-center gap-1 sm:gap-2">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                loc.pathname === to
                  ? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          onClick={cycleTheme}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-600"
          title="Toggle theme"
        >
          {theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'}
        </button>
      </div>
    </header>
  )
}
