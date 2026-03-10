import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { currentUser } from '@/mocks/users'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: async (_email: string, _password: string) => {
        // Mock login — accepts any credentials
        await new Promise((resolve) => setTimeout(resolve, 600))
        set({ user: currentUser, isAuthenticated: true })
      },
      logout: () => {
        set({ user: null, isAuthenticated: false })
      },
    }),
    {
      name: 'legalflow-auth',
    }
  )
)
