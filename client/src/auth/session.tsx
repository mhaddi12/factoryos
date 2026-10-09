import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { SessionUser } from '@shared/types/auth'
import { api } from '../lib/api'

type SessionValue = {
  user: SessionUser | null
  loaded: boolean
  refresh: () => Promise<void>
  setUser: (user: SessionUser | null) => void
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loaded, setLoaded] = useState(false)

  async function refresh() {
    try {
      const data = await api<{ user: SessionUser }>('/api/auth/me')
      setUser(data.user)
    } catch {
      setUser(null)
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <SessionContext.Provider value={{ user, loaded, refresh, setUser }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) {
    throw new Error('Session is not available.')
  }
  return value
}

export function useCan() {
  const { user } = useSession()
  return (permission: string) => Boolean(user?.permissions.includes(permission as SessionUser['permissions'][number]))
}
