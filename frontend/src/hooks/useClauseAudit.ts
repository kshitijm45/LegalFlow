import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/react'
import { clauseAuditApi } from '@/lib/api'

function useToken() {
  const { getToken } = useAuth()
  return async () => (await getToken()) ?? ''
}

export function usePlaybooks() {
  const getToken = useToken()
  return useQuery({
    queryKey: ['clause-audit-playbooks'],
    queryFn: async () => {
      const token = await getToken()
      return clauseAuditApi.listPlaybooks(token)
    },
    staleTime: Infinity,
  })
}

export function useDetectPlaybook() {
  const getToken = useToken()
  return useMutation({
    mutationFn: async (contractId: string) => {
      const token = await getToken()
      return clauseAuditApi.detect(token, contractId)
    },
  })
}

export function useRunAudit() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ contractId, playbookTypes }: { contractId: string; playbookTypes: string[] }) => {
      const token = await getToken()
      return clauseAuditApi.run(token, contractId, playbookTypes)
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['clause-audit-history', data.contract_id] })
    },
  })
}

export function useUpdateClauseResult() {
  const getToken = useToken()
  return useMutation({
    mutationFn: async ({
      resultId,
      overrideStatus,
      overrideNote,
    }: {
      resultId: string
      overrideStatus: string | null
      overrideNote: string | null
    }) => {
      const token = await getToken()
      return clauseAuditApi.updateResult(token, resultId, {
        override_status: overrideStatus,
        override_note: overrideNote,
      })
    },
  })
}

export function useAuditHistory(contractId: string | null) {
  const getToken = useToken()
  return useQuery({
    queryKey: ['clause-audit-history', contractId],
    queryFn: async () => {
      const token = await getToken()
      return clauseAuditApi.listForContract(token, contractId!)
    },
    enabled: !!contractId,
    staleTime: 30_000,
  })
}
