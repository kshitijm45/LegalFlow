import { useQuery } from '@tanstack/react-query'
import { delay } from '@/lib/utils'
import { mockDocuments } from '@/mocks/documents'
import { mockClauseCategories } from '@/mocks/clauses'
import { mockMarketClauses } from '@/mocks/marketData'
import { mockObligations, getObligationStats } from '@/mocks/obligations'
import { mockTimelineEvents } from '@/mocks/timeline'
import { mockWorkflows } from '@/mocks/workflow'
import { mockUsers } from '@/mocks/users'

export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      await delay(400)
      return mockDocuments
    },
  })
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: async () => {
      await delay(300)
      return mockDocuments.find((d) => d.id === id) ?? mockDocuments[0]
    },
  })
}

export function useClauseCategoriesForDoc(_docId: string) {
  return useQuery({
    queryKey: ['clauses', _docId],
    queryFn: async () => {
      await delay(500)
      return mockClauseCategories
    },
  })
}

export function useMarketClauses() {
  return useQuery({
    queryKey: ['market-clauses'],
    queryFn: async () => {
      await delay(450)
      return mockMarketClauses
    },
  })
}

export function useObligations() {
  return useQuery({
    queryKey: ['obligations'],
    queryFn: async () => {
      await delay(400)
      return mockObligations
    },
  })
}

export function useObligationStats() {
  return useQuery({
    queryKey: ['obligation-stats'],
    queryFn: async () => {
      await delay(300)
      return getObligationStats()
    },
  })
}

export function useTimelineEvents() {
  return useQuery({
    queryKey: ['timeline'],
    queryFn: async () => {
      await delay(400)
      return mockTimelineEvents
    },
  })
}

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      await delay(400)
      return mockWorkflows
    },
  })
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      await delay(400)
      return mockUsers
    },
  })
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      await delay(350)
      return {
        totalContracts: mockDocuments.filter((d) => d.status === 'processed').length,
        overdueObligations: mockObligations.filter((o) => o.status === 'overdue').length,
        contractsThisMonth: 4,
        avgCoverageScore: Math.round(
          mockDocuments
            .filter((d) => d.coverage > 0)
            .reduce((sum, d) => sum + d.coverage, 0) /
            mockDocuments.filter((d) => d.coverage > 0).length
        ),
      }
    },
  })
}
