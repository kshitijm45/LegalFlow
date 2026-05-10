import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/react'
import { orgApi } from '@/lib/api'
export type { OrgMemberDTO, OrgInvitationDTO, OrgOverviewDTO } from '@/lib/api'

function useToken() {
  const { getToken } = useAuth()
  return async () => (await getToken()) ?? ''
}

export function useOrgMembers() {
  const getToken = useToken()
  return useQuery({
    queryKey: ['org-members'],
    queryFn: async () => {
      const token = await getToken()
      return orgApi.listMembers(token)
    },
    staleTime: 30_000,
  })
}

export function useInviteMember() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, role, note }: { email: string; role: string; note?: string }) => {
      const token = await getToken()
      return orgApi.invite(token, email, role, note)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members'] }),
  })
}

export function useUpdateMemberRole() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ membershipId, role }: { membershipId: string; role: string }) => {
      const token = await getToken()
      return orgApi.updateRole(token, membershipId, role)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members'] }),
  })
}

export function useSetMemberStatus() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ membershipId, memberStatus }: { membershipId: string; memberStatus: 'active' | 'suspended' }) => {
      const token = await getToken()
      return orgApi.setStatus(token, membershipId, memberStatus)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members'] }),
  })
}

export function useRemoveMember() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (membershipId: string) => {
      const token = await getToken()
      return orgApi.removeMember(token, membershipId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members'] }),
  })
}

export function useRevokeInvitation() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const token = await getToken()
      return orgApi.revokeInvitation(token, invitationId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members'] }),
  })
}

export function useResendInvitation() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const token = await getToken()
      return orgApi.resendInvitation(token, invitationId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members'] }),
  })
}

export function memberDisplayName(m: { first_name: string | null; last_name: string | null; email: string }): string {
  const parts = [m.first_name ?? '', m.last_name ?? ''].filter(Boolean)
  return parts.length ? parts.join(' ') : m.email
}

export function memberInitials(m: { first_name: string | null; last_name: string | null; email: string }): string {
  if (m.first_name && m.last_name) return (m.first_name[0] + m.last_name[0]).toUpperCase()
  if (m.first_name) return m.first_name.slice(0, 2).toUpperCase()
  return m.email.slice(0, 2).toUpperCase()
}
