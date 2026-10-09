import { useState, type ReactNode } from 'react'
import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { APP_NAV, ROLE_LABELS, isNavGroup } from '@shared/navigation'
import { useSession } from '../auth/session'
import { api } from '../lib/api'

export function AppShell() {
  const { user, loaded, setUser } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!loaded) return <p className="p-8 text-sm text-slate-500">Loading…</p>
  if (!user) return <Navigate to="/login" replace />

  async function signOut() {
    await api('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="min-w-0">
          <p className="font-semibold">FactoryOS</p>
          <p className="truncate text-xs text-slate-500">{user.company.name}</p>
        </div>
        <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>Menu</button>
      </header>
      {menuOpen ? <button type="button" className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" aria-label="Close menu" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`${menuOpen ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-50 w-72 flex-col border-r border-slate-200 bg-white p-4 lg:static lg:flex lg:w-auto`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-semibold">FactoryOS</p>
            <p className="text-sm text-slate-500">{user.company.name}</p>
          </div>
          <button type="button" className="rounded-lg px-2 py-1 text-sm text-slate-600 lg:hidden" onClick={() => setMenuOpen(false)}>Close</button>
        </div>
        <nav className="mt-6 flex-1 space-y-5 overflow-auto text-sm">
          {APP_NAV.map(entry => isNavGroup(entry)
            ? (
                <div key={entry.label}>
                  <p className="mb-1 px-3 text-xs font-medium tracking-wide text-slate-500 uppercase">{entry.label}</p>
                  {entry.items.map(item => <Item key={item.to} to={item.to} label={item.label} onPick={() => setMenuOpen(false)} />)}
                </div>
              )
            : <Item key={entry.to} to={entry.to} label={entry.label} onPick={() => setMenuOpen(false)} />)}
        </nav>
        <div className="mt-6 border-t border-slate-200 pt-4 text-sm">
          <p className="font-medium">{user.name}</p>
          <p className="text-slate-500">{ROLE_LABELS[user.role]}</p>
          <button type="button" className="mt-3 text-slate-700 underline-offset-2 hover:underline" onClick={() => void signOut()}>Sign out</button>
        </div>
      </aside>
      <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}

function Item({ to, label, onPick }: { to: string, label: string, onPick: () => void }) {
  return (
    <NavLink to={to} onClick={onPick} className={({ isActive }) => `block rounded-lg px-3 py-2 ${isActive ? 'bg-teal-50 font-medium text-teal-900' : 'text-slate-700 hover:bg-slate-50'}`}>
      {label}
    </NavLink>
  )
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loaded } = useSession()
  if (!loaded) return <p className="p-8 text-sm text-slate-500">Loading…</p>
  if (user) return <Navigate to="/dashboard" replace />
  return children
}
