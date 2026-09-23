import type {
  BlockWindow,
  BundleCandidatesResponse,
  DashboardKPIs,
  PlanGenerateResponse,
  PlanHistoryResponse,
  PlanValidateResponse,
  Task,
  TaskListResponse,
  TimeSpaceResponse,
  TrainSchedule,
} from '../../types/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail || `Request failed: ${res.status}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  health: () => request<{ status: string; service: string; version: string }>('/health'),

  dashboard: () => request<DashboardKPIs>('/api/dashboard/'),

  tasks: (params: Record<string, string | number | boolean | undefined>) => {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== false) q.set(k, String(v))
    })
    return request<TaskListResponse>(`/api/tasks/?${q.toString()}`)
  },
  taskDetail: (id: number) => request<Task>(`/api/tasks/${id}`),
  taskExplain: (id: number) =>
  request<{
    shap_explanation: {
      shap_values: Record<string, number>
      global_importance: Record<string, number>
      model_version: string
      bias: number
      prediction: number
      contribution_sum: number
      error?: string
      fallback?: {
        total_score: number
        label: string
        breakdown: Record<
          string,
          {
            raw?: number
            raw_days?: number
            normalized: number
            weight: number
            contribution: number
          }
        >
      }
    }
    priority_score: number
    task_code: string
    task_id: number
    section?: string | null
    department?: string | null
  }>(`/api/tasks/explain/${id}`),
  scoreAllTasks: () => request<{ updated: number; message: string }>('/api/tasks/score-all', { method: 'POST' }),

  tms: (params: URLSearchParams) => request<TaskListResponse>(`/api/tms/tasks?${params.toString()}`),
  smms: (params: URLSearchParams) => request<TaskListResponse>(`/api/smms/tasks?${params.toString()}`),
  tdms: (params: URLSearchParams) => request<TaskListResponse>(`/api/tdms/tasks?${params.toString()}`),
  simulateFault: () => request<{ message: string; task_code: string; section: string; ai_priority_score: number }>('/api/tdms/simulate-fault', { method: 'POST' }),

  trains: (params: URLSearchParams) => request<TrainSchedule[]>(`/api/coa/trains?${params.toString()}`),
  windows: (params: URLSearchParams) => request<BlockWindow[]>(`/api/coa/windows?${params.toString()}`),

  generatePlan: (body: unknown) => request<PlanGenerateResponse>('/api/plan/generate', { method: 'POST', body: JSON.stringify(body) }),
  planHistory: (limit = 20) => request<PlanHistoryResponse>(`/api/plan/history?limit=${limit}`),
  validatePlan: (body: unknown) => request<PlanValidateResponse>('/api/plan/validate', { method: 'POST', body: JSON.stringify(body) }),
  bundleCandidates: (body: unknown, method = 'pairwise') =>
    request<BundleCandidatesResponse>(`/api/plan/bundle-candidates?method=${method}`, { method: 'POST', body: JSON.stringify(body) }),

  timeSpace: (params: URLSearchParams) => request<TimeSpaceResponse>(`/api/visualization/time-space?${params.toString()}`),
}
