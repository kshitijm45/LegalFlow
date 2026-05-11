import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/react'
import { obligationsApi } from '@/lib/api'
import type { ObligationPatch, ObligationCreate } from '@/lib/api'
export type { ObligationDTO } from '@/lib/api'

function useToken() {
  const { getToken } = useAuth()
  return async () => (await getToken()) ?? ''
}

export function useObligationsList(params?: { status_filter?: string; category?: string }) {
  const getToken = useToken()
  return useQuery({
    queryKey: ['obligations', params],
    queryFn: async () => {
      const token = await getToken()
      return obligationsApi.list(token, params)
    },
    staleTime: 30_000,
  })
}

export function useExtractObligations() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ contractIds, forceRegenerate = false }: { contractIds: string[]; forceRegenerate?: boolean }) => {
      const token = await getToken()
      return obligationsApi.extract(token, contractIds, forceRegenerate)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obligations'] }),
  })
}

export function useUpdateObligation() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ObligationPatch }) => {
      const token = await getToken()
      return obligationsApi.update(token, id, patch)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obligations'] }),
  })
}

export function useDeleteObligation() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken()
      return obligationsApi.delete(token, id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obligations'] }),
  })
}

export function useCreateObligation() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: ObligationCreate) => {
      const token = await getToken()
      return obligationsApi.create(token, body)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obligations'] }),
  })
}
