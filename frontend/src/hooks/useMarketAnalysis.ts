import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/react'
import { marketAnalysisApi } from '@/lib/api'

function useToken() {
  const { getToken } = useAuth()
  return async () => (await getToken()) ?? ''
}

export function useDealTypes() {
  const getToken = useToken()
  return useQuery({
    queryKey: ['market-analysis-deal-types'],
    queryFn: async () => {
      const token = await getToken()
      return marketAnalysisApi.getDealTypes(token)
    },
    staleTime: Infinity,
  })
}

export function useDetectDealType() {
  const getToken = useToken()
  return useMutation({
    mutationFn: async (contractId: string) => {
      const token = await getToken()
      return marketAnalysisApi.detect(token, contractId)
    },
  })
}

export function useRunMarketAnalysis() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      contractId,
      dealType,
      perspective,
    }: {
      contractId: string
      dealType: string
      perspective: string
    }) => {
      const token = await getToken()
      return marketAnalysisApi.run(token, contractId, dealType, perspective)
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['market-analyses', data.contract_id] })
      qc.setQueryData(['market-analysis', data.id], data)
    },
  })
}

export function useMarketAnalysesForContract(contractId: string | null) {
  const getToken = useToken()
  return useQuery({
    queryKey: ['market-analyses', contractId],
    queryFn: async () => {
      const token = await getToken()
      return marketAnalysisApi.listForContract(token, contractId!)
    },
    enabled: !!contractId,
    staleTime: 30_000,
  })
}

export function useMarketAnalysis(analysisId: string | null) {
  const getToken = useToken()
  return useQuery({
    queryKey: ['market-analysis', analysisId],
    queryFn: async () => {
      const token = await getToken()
      return marketAnalysisApi.get(token, analysisId!)
    },
    enabled: !!analysisId,
    staleTime: 60_000,
  })
}
