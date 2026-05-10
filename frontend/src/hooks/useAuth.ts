import { useUser, useAuth as useClerkAuth, useClerk } from '@clerk/react'
import { useNavigate } from 'react-router-dom'
import type { User, UserRole } from '@/types'
import { getInitials } from '@/lib/utils'

export function useAuth() {
  const { user: clerkUser, isLoaded: userLoaded } = useUser()
  const { isSignedIn, isLoaded: authLoaded } = useClerkAuth()
  const { signOut } = useClerk()
  const navigate = useNavigate()

  const logout = async () => {
    await signOut()
    navigate('/login')
  }

  // Map Clerk user → our User type.
  // role comes from Clerk publicMetadata (set by backend on onboarding).
  // Falls back to 'associate' until the backend assigns a real role.
  const user: User | null = clerkUser
    ? {
        id: clerkUser.id,
        name:
          clerkUser.fullName ??
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ??
          'User',
        email: clerkUser.primaryEmailAddress?.emailAddress ?? '',
        role: ((clerkUser.publicMetadata?.role as UserRole) ?? 'associate'),
        avatarInitials: getInitials(
          clerkUser.fullName ?? clerkUser.firstName ?? 'U'
        ),
        avatarColor: '#4338CA',
        status: 'active',
        lastActive: new Date().toISOString(),
        joinedAt:
          clerkUser.createdAt?.toISOString() ?? new Date().toISOString(),
      }
    : null

  return {
    user,
    isAuthenticated: isSignedIn ?? false,
    isLoaded: authLoaded && userLoaded,
    logout,
  }
}
