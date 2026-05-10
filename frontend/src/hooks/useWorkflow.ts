import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/react'
import { workflowApi, type WorkflowDTO } from '@/lib/api'
import type { Workflow } from '@/types'

function useToken() {
  const { getToken } = useAuth()
  return async () => (await getToken()) ?? ''
}

export function dtoToWorkflow(dto: WorkflowDTO): Workflow {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? '',
    lastRun: dto.last_run,
    status: dto.status,
    nodes: dto.nodes.map(n => ({
      id: n.id,
      type: n.type as Workflow['nodes'][0]['type'],
      position: n.position,
      data: n.data as Workflow['nodes'][0]['data'],
    })),
    edges: dto.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
    })),
  }
}

export function useWorkflows() {
  const getToken = useToken()
  return useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const token = await getToken()
      const data = await workflowApi.list(token)
      return data.workflows.map(dtoToWorkflow)
    },
    staleTime: 10_000,
  })
}

export function useCreateWorkflow() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      name: string
      description?: string
      nodes?: WorkflowDTO['nodes']
      edges?: WorkflowDTO['edges']
    }) => {
      const token = await getToken()
      const dto = await workflowApi.create(token, body)
      return dtoToWorkflow(dto)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  })
}

export function useUpdateWorkflow() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string
      name?: string
      description?: string
      status?: string
      nodes?: WorkflowDTO['nodes']
      edges?: WorkflowDTO['edges']
    }) => {
      const token = await getToken()
      const dto = await workflowApi.update(token, id, body)
      return dtoToWorkflow(dto)
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['workflows'] })
      qc.invalidateQueries({ queryKey: ['workflow', vars.id] })
    },
  })
}

export function useDeleteWorkflow() {
  const getToken = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken()
      await workflowApi.delete(token, id)
      return id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  })
}

export function useRunWorkflow() {
  const getToken = useToken()
  return useMutation({
    mutationFn: async ({ id, contractId }: { id: string; contractId?: string }) => {
      const token = await getToken()
      return workflowApi.run(token, id, contractId)
    },
  })
}

export function useWorkflowRuns(workflowId: string | null) {
  const getToken = useToken()
  return useQuery({
    queryKey: ['workflow-runs', workflowId],
    queryFn: async () => {
      const token = await getToken()
      return workflowApi.listRuns(token, workflowId!)
    },
    enabled: !!workflowId,
    staleTime: 5_000,
  })
}

export function useWorkflowRun(runId: string | null) {
  const getToken = useToken()
  return useQuery({
    queryKey: ['workflow-run', runId],
    queryFn: async () => {
      const token = await getToken()
      return workflowApi.getRun(token, runId!)
    },
    enabled: !!runId,
    refetchInterval: query => {
      const status = query.state.data?.status
      return status === 'pending' || status === 'running' ? 1500 : false
    },
  })
}
