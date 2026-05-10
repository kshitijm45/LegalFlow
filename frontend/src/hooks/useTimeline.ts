import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@clerk/react'
import { timelineApi, type TimelineEventDTO } from '@/lib/api'
export type { TimelineEventDTO }

function useToken() {
  const { getToken } = useAuth()
  return async () => (await getToken()) ?? ''
}

export function useGenerateTimeline() {
  const getToken = useToken()
  return useMutation({
    mutationFn: async ({ contractIds, forceRegenerate = false }: { contractIds: string[]; forceRegenerate?: boolean }) => {
      const token = await getToken()
      return timelineApi.generate(token, contractIds, forceRegenerate)
    },
  })
}
