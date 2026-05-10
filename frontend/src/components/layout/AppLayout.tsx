import { useEffect, useRef } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuth as useClerkAuth } from '@clerk/react'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/hooks/useAuth'
import { apiFetch } from '@/lib/api'

export function AppLayout() {
  const { isAuthenticated, isLoaded, user } = useAuth()
  const { getToken } = useClerkAuth()
  const onboarded = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || !user || onboarded.current) return
    onboarded.current = true

    getToken().then((token) => {
      if (!token) return
      apiFetch('/api/v1/users/onboard', token, {
        method: 'POST',
        body: JSON.stringify({
          first_name: user.name.split(' ')[0] ?? null,
          last_name: user.name.split(' ').slice(1).join(' ') || null,
          role: user.role,
        }),
      }).catch(() => {
        // Non-fatal — user can still use the app, onboard will retry next load
      })
    })
  }, [isAuthenticated, user, getToken])

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <div className="w-5 h-5 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
