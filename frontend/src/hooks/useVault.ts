import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/react'
import { vaultApi, type ContractDTO, type ChatMessageDTO, type ContractsParams } from '@/lib/api'
export type { ContractDTO, ContractsParams }

function useToken() {
  const { getToken } = useAuth()
  return async () => (await getToken()) ?? ''
}

// ─── Contracts list ───────────────────────────────────────────────────────────

export function useContracts(params?: ContractsParams) {
  const getToken = useToken()
  return useQuery({
    queryKey: ['contracts', params],
    queryFn: async () => {
      const token = await getToken()
      return vaultApi.listContracts(token, params)
    },
    staleTime: 30_000,
  })
}

// ─── Single contract (with presigned URL) ─────────────────────────────────────

export function useContract(id: string | null) {
  const getToken = useToken()
  return useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      const token = await getToken()
      return vaultApi.getContract(token, id!)
    },
    enabled: !!id,
    staleTime: 50_000,
  })
}

// ─── Status polling ───────────────────────────────────────────────────────────

export function useContractStatus(id: string | null, enabled: boolean) {
  const getToken = useToken()
  const qc = useQueryClient()
  return useQuery({
    queryKey: ['contract-status', id],
    queryFn: async () => {
      const token = await getToken()
      const result = await vaultApi.getStatus(token, id!)
      if (result.status === 'ready' || result.status === 'failed') {
        qc.invalidateQueries({ queryKey: ['contracts'] })
      }
      return result
    },
    enabled: !!id && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'pending' || status === 'processing' ? 2000 : false
    },
  })
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export function useUploadContract() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, collectionId }: { file: File; collectionId?: string }) => {
      const token = await getToken()
      return vaultApi.upload(token, file, collectionId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })
}

// ─── Rename ───────────────────────────────────────────────────────────────────

export function useRenameContract() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const token = await getToken()
      return vaultApi.renameContract(token, id, name)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })
}

// ─── Move to collection ───────────────────────────────────────────────────────

export function useMoveToCollection() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, collectionId }: { id: string; collectionId: string | null }) => {
      const token = await getToken()
      return vaultApi.moveToCollection(token, id, collectionId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })
}

// ─── Delete (single) ──────────────────────────────────────────────────────────

export function useDeleteContract() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken()
      return vaultApi.deleteContract(token, id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })
}

// ─── Bulk delete ──────────────────────────────────────────────────────────────

export function useBulkDelete() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const token = await getToken()
      return vaultApi.bulkDelete(token, ids)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })
}

// ─── Collections ──────────────────────────────────────────────────────────────

export function useCollections() {
  const getToken = useToken()
  return useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const token = await getToken()
      return vaultApi.listCollections(token)
    },
    staleTime: 60_000,
  })
}

export function useCreateCollection() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, color, parent_id }: { name: string; color?: string; parent_id?: string | null }) => {
      const token = await getToken()
      return vaultApi.createCollection(token, name, color, parent_id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections'] }),
  })
}

export function useUpdateCollection() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name, color, parent_id }: { id: string; name?: string; color?: string; parent_id?: string | null }) => {
      const token = await getToken()
      const patch: { name?: string; color?: string; parent_id?: string | null } = {}
      if (name !== undefined) patch.name = name
      if (color !== undefined) patch.color = color
      if (parent_id !== undefined) patch.parent_id = parent_id
      return vaultApi.updateCollection(token, id, patch)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections'] }),
  })
}

export function useDeleteCollection() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken()
      return vaultApi.deleteCollection(token, id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections'] })
      qc.invalidateQueries({ queryKey: ['contracts'] })
    },
  })
}

// ─── Search ───────────────────────────────────────────────────────────────────

export function useVaultSearch() {
  const getToken = useToken()
  return useMutation({
    mutationFn: async (query: string) => {
      const token = await getToken()
      return vaultApi.search(token, query)
    },
  })
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export function useVaultChat() {
  const getToken = useToken()
  return useMutation({
    mutationFn: async ({
      contractIds,
      message,
      history,
    }: {
      contractIds: string[]
      message: string
      history: ChatMessageDTO[]
    }) => {
      const token = await getToken()
      return vaultApi.chat(token, contractIds, message, history)
    },
  })
}

// ─── Download / View ──────────────────────────────────────────────────────────

export function useDownloadContract() {
  const getToken = useToken()
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken()
      const contract = await vaultApi.getContract(token, id)
      if (contract.download_url) window.open(contract.download_url, '_blank')
    },
  })
}

export function useContractViewUrl(id: string | null) {
  const getToken = useToken()
  return useQuery({
    queryKey: ['contract-view-url', id],
    queryFn: async () => {
      const token = await getToken()
      const contract = await vaultApi.getContract(token, id!)
      return contract.download_url ?? null
    },
    enabled: !!id,
    staleTime: 45_000,
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
