import { create } from 'zustand'
import { api, onSignedOut } from './api'
import type { User, UserRole } from './types'

interface Auth {
  user: User | null
  /** false until the first /api/auth/me answered */
  checked: boolean
  /** set when the backend can't be reached at all */
  offline: string | null
  check: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (current: string, next: string) => Promise<void>
}

export const ROLE_LABEL: Record<UserRole, string> = { admin: 'Admin', estimator: 'Estimator', viewer: 'Viewer' }
export const ROLE_HELP: Record<UserRole, string> = {
  admin: 'Works on tenders and manages users',
  estimator: 'Imports, prices, approves and exports tenders',
  viewer: 'Opens tenders and downloads exports, changes nothing',
}

export const useAuth = create<Auth>((set) => ({
  user: null,
  checked: false,
  offline: null,
  check: async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/auth/me`)
      set({ user: res.ok ? await res.json() : null, checked: true, offline: res.status >= 500 ? `The pricing API answered ${res.status}` : null })
    } catch (err) {
      set({ user: null, checked: true, offline: (err as Error).message })
    }
  },
  login: async (email, password) => set({ user: await api.login(email, password), offline: null }),
  logout: async () => {
    await api.logout().catch(() => {})
    set({ user: null })
  },
  changePassword: async (current, next) => set({ user: await api.changePassword(current, next) }),
}))

onSignedOut(() => useAuth.setState({ user: null }))

/** The signed-in user; only used below the sign-in gate, where there always is one. */
export const useUser = () => useAuth((s) => s.user)!
export const canEdit = (u: User | null) => !!u && u.role !== 'viewer'
