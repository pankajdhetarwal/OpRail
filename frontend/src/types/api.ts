export type DepartmentCode = 'ENG' | 'ST' | 'OHE'

export interface DashboardKPIs {
  asset_availability_pct: number
  total_tasks: number
  critical_tasks: number
  overdue_tasks: number
  scheduled_tasks: number
  todays_blocks: number
  joint_blocks_today: number
  active_conflicts: number
  avg_block_efficiency: number

  availability_trend: {
    date: string
    availability: number
  }[]

  dept_stats: {
    code: string
    name: string
    total_tasks: number
    critical_tasks: number
    overdue_tasks: number
    scheduled_tasks: number
    color_hex: string
  }[]

  section_statuses: {
    section_code: string
    section_name: string
    criticality_level: number
    pending_tasks: number
    overdue_tasks: number
  }[]
}

export interface Task {
  id: number
  task_code: string
  task_type: string
  description?: string
  severity: number
  days_overdue: number
  duration_minutes: number
  due_date: string
  safety_critical: boolean
  requires_line_block: boolean
  requires_ohe_disconnection: boolean
  priority_score: number
  status: string
  created_at: string

  department: {
    id: number
    code: string
    name: string
    color_hex: string
  }

  section: {
    id: number
    code: string
    name: string
    criticality_level: number
  }
}

export interface TaskListResponse {
  total: number
  tasks: Task[]
}

export interface PlanBlock {
  id: number
  section_id: number
  section_code: string
  section_name: string
  schedule_date: string
  start_time: string
  end_time: string
  duration_minutes: number
  task_ids: number[]
  departments_involved: string[]
  is_joint_block: boolean
  efficiency_score: number
  total_priority_score: number
  why_explanation?: string
  run_id?: string
  horizon?: string
  created_at?: string
}

export interface PlanGenerateResponse {
  run_id: string

  // Backend response model expects an integer.
  // Weekly request ("7") becomes 7.
  // Monthly request ("30") becomes 30.
  horizon: number

  total_blocks: number
  joint_blocks: number
  total_tasks_scheduled: number
  tasks_dropped: number
  avg_efficiency: number
  asset_availability_pct: number
  blocks: PlanBlock[]
}

export interface PlanHistoryResponse {
  total: number
  blocks: PlanBlock[]
}

export interface PlanValidateResponse {
  valid: boolean
  conflict_train?: string
  conflict_time?: string
  message: string
}

export interface BundleCandidate {
  section: string
  task_ids: number[]
  bundle_duration_minutes: number
  downtime_saved_minutes: number
}

export interface BundleCandidatesResponse {
  method_used: string
  bundles: BundleCandidate[]
}

export interface TrainSchedule {
  id: number
  train_no: string
  train_name: string | null
  section_id: number
  train_type: string
  train_priority: string
  entry_time: string
  exit_time: string
  schedule_date: string
  direction: string
}

export interface BlockWindow {
  id: number
  section_id: number
  schedule_date: string
  start_time: string
  end_time: string
  duration_minutes: number
  is_available: boolean
  corridor_id: string | null
  window_type: string
}

export interface TimeSpaceResponse {
  trains: {
    train_number: string
    points: {
      station: string
      minute: number
    }[]
  }[]

  blocks: {
    start_station: string
    end_station: string
    start_minute: number
    end_minute: number
  }[]
}