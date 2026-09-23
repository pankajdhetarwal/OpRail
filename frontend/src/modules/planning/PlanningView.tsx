/**
 * PlanningView.tsx — Mission 8: Planning Generator
 *
 * Full planning workspace with step-by-step workflow:
 *   1. Select planning context
 *   2. Review eligible tasks
 *   3. Generate plan
 *   4. Analyse blocks / task relationships
 *   5. Review operational impact / COA context
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Database,
  Filter,
  Layers3,
  Loader2,
  RefreshCw,
  Route,
  ShieldAlert,
  ShieldCheck,
  SquareStack,
  TrainFront,
  XCircle,
  Zap,
} from 'lucide-react'
import { api } from '../../core/api/client'
import type {
  BlockWindow,
  PlanBlock,
  PlanGenerateResponse,
  Task,
  TrainSchedule,
} from '../../types/api'
import { EmptyState, Panel } from '../../components/common'
import { deptAccent, toMinutes } from '../../utils/format'

// ─── Constants ────────────────────────────────────────────────────────────────

const HORIZONS = [
  { label: 'Weekly (7 days)', value: '7' },
  { label: 'Monthly (30 days)', value: '30' },
]

const DEPARTMENTS = [
  { code: 'ENG', label: 'Engineering', color: 'var(--warning)' },
  { code: 'ST', label: 'Signal & Telecom', color: '#b89bd4' },
  { code: 'OHE', label: 'Traction / OHE', color: 'var(--active)' },
]

const formatDate = (d: Date) => d.toISOString().slice(0, 10)

const displayDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(`${value}T00:00:00`),
  )

const clockMinutes = (v: string) => {
  const [h, m] = v.split(':').map(Number)
  return h * 60 + m
}

const intervalEnd = (start: number, end: number) =>
  end < start ? end + 1440 : end

// ─── Priority helpers ─────────────────────────────────────────────────────────

function priorityTier(score: number): { label: string; cls: string } {
  if (score >= 75) return { label: 'CRITICAL', cls: 'is-critical' }
  if (score >= 55) return { label: 'HIGH', cls: 'is-high' }
  if (score >= 35) return { label: 'MEDIUM', cls: 'is-medium' }
  return { label: 'LOW', cls: 'is-low' }
}

// ─── Timeline component ───────────────────────────────────────────────────────

function Timeline({
  blocks,
  trains,
  windows,
  selectedId,
  onSelect,
}: {
  blocks: PlanBlock[]
  trains: TrainSchedule[]
  windows: BlockWindow[]
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  const allTimes = [
    ...blocks.flatMap((b) => {
      const s = toMinutes(b.start_time)
      return [s, intervalEnd(s, toMinutes(b.end_time))]
    }),
    ...trains.flatMap((t) => {
      const s = clockMinutes(t.entry_time)
      return [s, intervalEnd(s, clockMinutes(t.exit_time))]
    }),
    ...windows.flatMap((w) => {
      const s = clockMinutes(w.start_time)
      return [s, intervalEnd(s, clockMinutes(w.end_time))]
    }),
  ]

  const firstMinute =
    allTimes.length > 0
      ? Math.max(0, Math.floor((Math.min(...allTimes) - 60) / 60) * 60)
      : 0
  const lastMinute =
    allTimes.length > 0
      ? Math.min(24 * 60, Math.ceil((Math.max(...allTimes) + 60) / 60) * 60)
      : 24 * 60

  const span = Math.max(240, lastMinute - firstMinute)

  const ticks = Array.from(
    { length: Math.floor(span / 60) + 1 },
    (_, i) => firstMinute + i * 60,
  )

  const laneNames = [
    ...new Set([
      ...trains.map((t) => `TRAIN ${t.train_no}`),
      ...blocks.map((b) => b.section_code),
    ]),
  ]

  const pos = (m: number) =>
    `${Math.max(0, Math.min(100, ((m - firstMinute) / span) * 100))}%`

  const w = (s: number, e: number) =>
    `${Math.max(2, ((intervalEnd(s, e) - s) / span) * 100)}%`

  return (
    <div
      className="planning-timeline"
      aria-label="Generated maintenance blocks and timetable"
    >
      <div className="planning-timeline-scroll">
        <div
          className="timeline-canvas"
          style={{ minWidth: `${Math.max(860, ticks.length * 116)}px` }}
        >
          <div className="timeline-axis">
            <div className="timeline-lane-label">TIME / LANE</div>
            <div className="timeline-axis-track">
              {ticks.map((tick) => (
                <span key={tick} style={{ left: pos(tick) }}>
                  {`${String(Math.floor(tick / 60)).padStart(2, '0')}:00`}
                </span>
              ))}
            </div>
          </div>

          {laneNames.length === 0 ? (
            <EmptyState label="No timetable or block lanes available for this plan." />
          ) : (
            laneNames.map((lane) => (
              <div className="timeline-row" key={lane}>
                <div className="timeline-lane-label">{lane}</div>
                <div className="timeline-track">
                  {ticks.map((tick) => (
                    <i
                      className="timeline-gridline"
                      key={tick}
                      style={{ left: pos(tick) }}
                    />
                  ))}

                  {trains
                    .filter((t) => `TRAIN ${t.train_no}` === lane)
                    .map((t) => (
                      <div
                        className="train-bar"
                        key={t.id}
                        style={{
                          left: pos(clockMinutes(t.entry_time)),
                          width: w(
                            clockMinutes(t.entry_time),
                            clockMinutes(t.exit_time),
                          ),
                        }}
                        title={`${t.train_no} ${t.train_name ?? ''} · ${t.entry_time}–${t.exit_time}`}
                      >
                        <TrainFront className="h-3 w-3" aria-hidden="true" />
                        {t.train_no}
                      </div>
                    ))}

                  {windows
                    .filter((wnd) =>
                      blocks.some(
                        (b) =>
                          b.section_code === lane &&
                          b.section_id === wnd.section_id,
                      ),
                    )
                    .map((wnd) => (
                      <span
                        className="window-band"
                        key={wnd.id}
                        style={{
                          left: pos(clockMinutes(wnd.start_time)),
                          width: w(
                            clockMinutes(wnd.start_time),
                            clockMinutes(wnd.end_time),
                          ),
                        }}
                        title={`Available window · ${wnd.start_time}–${wnd.end_time} · ${wnd.duration_minutes} min`}
                      />
                    ))}

                  {blocks
                    .filter((b) => b.section_code === lane)
                    .map((b) => (
                      <button
                        className={`timeline-block ${selectedId === b.id ? 'is-selected' : ''}`}
                        key={b.id}
                        type="button"
                        style={{
                          left: pos(toMinutes(b.start_time)),
                          width: w(
                            toMinutes(b.start_time),
                            toMinutes(b.end_time),
                          ),
                        }}
                        onClick={() => onSelect(b.id)}
                        title={`${b.section_code}: ${b.start_time}–${b.end_time}`}
                      >
                        <span>{b.departments_involved.join(' / ')}</span>
                        <b>
                          {b.start_time}–{b.end_time}
                        </b>
                      </button>
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="timeline-legend">
        <span>
          <i className="legend-swatch is-train" />
          Train movement
        </span>
        <span>
          <i className="legend-swatch is-block" />
          Maintenance block
        </span>
        <span>
          <i className="legend-swatch is-window" />
          Available COA window
        </span>
      </div>
    </div>
  )
}

// ─── Task eligibility row ─────────────────────────────────────────────────────

function TaskEligibilityRow({
  task,
  inPlan,
  blockId,
}: {
  task: Task
  inPlan: boolean
  blockId?: number
}) {
  const tier = priorityTier(task.priority_score)

  return (
    <div
      className={`pgv-task-row ${inPlan ? 'is-scheduled' : ''}`}
      aria-label={`Task ${task.task_code}`}
    >
      <div className="pgv-task-code-col">
        <span className="task-code">{task.task_code}</span>
        <span className="pgv-task-type">{task.task_type}</span>
      </div>

      <div className="pgv-task-section-col">
        <span>{task.section.code}</span>
        <small>{task.section.name}</small>
      </div>

      <div>
        <span
          className="task-dept"
          style={{ color: task.department.color_hex }}
        >
          <i
            style={{
              height: 6,
              width: 6,
              borderRadius: '50%',
              background: task.department.color_hex,
              display: 'inline-block',
            }}
          />
          {task.department.code}
        </span>
      </div>

      <div className={`task-priority ${tier.cls}`}>
        <div className="task-priority-track">
          <span style={{ width: `${task.priority_score}%` }} />
        </div>
        <b>{task.priority_score.toFixed(0)}</b>
      </div>

      <div className="pgv-task-flags">
        {task.safety_critical && (
          <span
            className="pgv-flag is-safety"
            title="Safety critical"
            aria-label="Safety critical"
          >
            <ShieldAlert className="h-3 w-3" />
          </span>
        )}
        {task.requires_line_block && (
          <span
            className="pgv-flag is-block-req"
            title="Requires line block"
            aria-label="Requires line block"
          >
            <SquareStack className="h-3 w-3" />
          </span>
        )}
        {task.days_overdue > 0 && (
          <span
            className="pgv-flag is-overdue"
            title={`${task.days_overdue} days overdue`}
          >
            {task.days_overdue}d overdue
          </span>
        )}
      </div>

      <div className="pgv-task-duration">
        <Clock3 className="h-3 w-3" aria-hidden="true" />
        {task.duration_minutes} min
      </div>

      <div className="pgv-task-status-col">
        {inPlan ? (
          <span className="pgv-scheduled-badge">
            <CheckCircle2 className="h-3 w-3" />
            Block #{blockId}
          </span>
        ) : (
          <span className="pgv-unscheduled-badge">Unscheduled</span>
        )}
      </div>
    </div>
  )
}

// ─── Block card ───────────────────────────────────────────────────────────────

function BlockCard({
  block,
  tasks,
  selected,
  onSelect,
}: {
  block: PlanBlock
  tasks: Task[]
  selected: boolean
  onSelect: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const blockTasks = tasks.filter((t) => block.task_ids.includes(t.id))

  const effClass =
    block.efficiency_score >= 80
      ? 'is-high-eff'
      : block.efficiency_score >= 60
        ? 'is-mid-eff'
        : 'is-low-eff'

  return (
    <div
      className={`pgv-block-card ${selected ? 'is-selected' : ''} ${block.is_joint_block ? 'is-joint' : ''}`}
      aria-selected={selected}
    >
      {/* Card header */}
      <div className="pgv-block-card-header">
        <div className="pgv-block-card-identity">
          <button
            className="pgv-block-card-select"
            type="button"
            onClick={onSelect}
            aria-label={`Select block ${block.id}`}
          >
            <span className="pgv-block-id">B-{String(block.id).padStart(2, '0')}</span>
            {block.is_joint_block && (
              <span className="pgv-joint-badge">JOINT</span>
            )}
          </button>

          <div className="pgv-block-section">
            <Route className="h-3 w-3" aria-hidden="true" />
            {block.section_code} · {block.section_name}
          </div>
        </div>

        <button
          className="pgv-block-expand-btn"
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse block details' : 'Expand block details'}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Time strip */}
      <div className="pgv-block-timestrip">
        <div className="pgv-block-time-range">
          <Calendar className="h-3 w-3" aria-hidden="true" />
          {displayDate(block.schedule_date)}
          <span className="pgv-time-sep">·</span>
          <Clock3 className="h-3 w-3" aria-hidden="true" />
          {block.start_time}
          <span className="pgv-time-sep">—</span>
          {block.end_time}
          <span className="pgv-duration-badge">{block.duration_minutes} min</span>
        </div>

        <div className={`pgv-efficiency ${effClass}`}>
          <Zap className="h-3 w-3" aria-hidden="true" />
          {block.efficiency_score}% utilisation
        </div>
      </div>

      {/* Department tags */}
      <div className="pgv-block-depts">
        {block.departments_involved.map((d) => (
          <span key={d} className={`pgv-dept-tag ${deptAccent[d] ?? ''}`}>
            {d}
          </span>
        ))}
        <span className="pgv-task-count">
          <Layers3 className="h-3 w-3" aria-hidden="true" />
          {block.task_ids.length} task{block.task_ids.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="pgv-block-expanded">
          {/* Explanation */}
          {block.why_explanation && (
            <p className="pgv-block-explanation">{block.why_explanation}</p>
          )}

          {/* Task→Block relationship */}
          <div className="pgv-block-tasks-heading">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Scheduled tasks
          </div>

          {blockTasks.length > 0 ? (
            <div className="pgv-block-task-list">
              {blockTasks.map((t) => (
                <div className="pgv-block-task-item" key={t.id}>
                  <span className="pgv-block-task-code">{t.task_code}</span>
                  <span className="pgv-block-task-type">{t.task_type}</span>
                  <span
                    className="pgv-block-task-dept"
                    style={{ color: t.department.color_hex }}
                  >
                    {t.department.code}
                  </span>
                  <span className="pgv-block-task-dur">
                    {t.duration_minutes} min
                  </span>
                  {t.safety_critical && (
                    <ShieldAlert
                      className="h-3 w-3 text-amber-400"
                      aria-label="Safety critical"
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="pgv-block-task-ids">
              Task IDs: {block.task_ids.join(', ')}
            </p>
          )}

          {/* Priority total */}
          <div className="pgv-block-metrics">
            <span>
              <small>Priority total</small>
              <b>{block.total_priority_score.toFixed(1)}</b>
            </span>
            <span>
              <small>Run ID</small>
              <b>{block.run_id ?? '—'}</b>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Summary metrics strip ────────────────────────────────────────────────────

function SummaryMetric({
  label,
  value,
  sub,
  icon: Icon,
  variant,
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof Layers3
  variant?: 'default' | 'warning' | 'critical' | 'success'
}) {
  const variantClass = variant ? `pgv-metric-${variant}` : ''
  return (
    <div className={`pgv-metric ${variantClass}`}>
      <div className="pgv-metric-icon">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div>
        <span className="pgv-metric-label">{label}</span>
        <strong className="pgv-metric-value">{value}</strong>
        {sub && <span className="pgv-metric-sub">{sub}</span>}
      </div>
    </div>
  )
}

// ─── Empty/workflow hint ──────────────────────────────────────────────────────

function WorkflowHint() {
  return (
    <div className="pgv-workflow-hint">
      <div className="pgv-workflow-steps">
        {[
          {
            n: '1',
            title: 'Select Planning Context',
            desc: 'Set dates, horizon, departments, and railway sections.',
          },
          {
            n: '2',
            title: 'Review Eligible Tasks',
            desc: 'Inspect pending and overdue maintenance tasks in scope.',
          },
          {
            n: '3',
            title: 'Generate Coordinated Plan',
            desc: 'The optimizer assigns tasks to available COA block windows.',
          },
          {
            n: '4',
            title: 'Analyse Generated Blocks',
            desc: 'Review block cards, task assignments, and efficiency scores.',
          },
        ].map((step) => (
          <div className="pgv-workflow-step" key={step.n}>
            <div className="pgv-workflow-step-number">{step.n}</div>
            <div>
              <strong>{step.title}</strong>
              <p>{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PlanningView() {
  // ── Planning context state ─────────────────────────────────────────────────
  const [startDate, setStartDate] = useState(() => formatDate(new Date()))
  const [endDate, setEndDate] = useState(() =>
    formatDate(new Date(Date.now() + 6 * 86400000)),
  )
  const [horizon, setHorizon] = useState('7')
  const [density, setDensity] = useState(1)
  const [depts, setDepts] = useState<string[]>(['ENG', 'ST', 'OHE'])
  const [sectionIds, setSectionIds] = useState<number[]>([])

  // ── Sections (derived from tasks endpoint) ─────────────────────────────────
  const [sections, setSections] = useState<
    { id: number; name: string; code: string }[]
  >([])

  // ── Task eligibility panel ─────────────────────────────────────────────────
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [tasksError, setTasksError] = useState('')
  const [taskFilter, setTaskFilter] = useState('')
  const [showTasksPanel, setShowTasksPanel] = useState(true)

  // ── Plan generation ────────────────────────────────────────────────────────
  const [plan, setPlan] = useState<PlanGenerateResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Selected block (for timeline + detail) ─────────────────────────────────
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null)

  // ── COA context ────────────────────────────────────────────────────────────
  const [trains, setTrains] = useState<TrainSchedule[]>([])
  const [windows, setWindows] = useState<BlockWindow[]>([])
  const [coaLoading, setCoaLoading] = useState(false)
  const [coaError, setCoaError] = useState('')

  // ── Panel visibility ───────────────────────────────────────────────────────
  const [showTimeline, setShowTimeline] = useState(true)
  const [showCoaContext, setShowCoaContext] = useState(true)

  // ─────────────────────────────────────────────────────────────────────────
  // Data loading
  // ─────────────────────────────────────────────────────────────────────────

  const loadSections = useCallback(async () => {
    try {
      const res = await api.tasks({ min_severity: 1, limit: 500, skip: 0 })
      const unique = new Map<number, { id: number; name: string; code: string }>()
      res.tasks.forEach((t: Task) => {
        unique.set(t.section.id, {
          id: t.section.id,
          name: t.section.name,
          code: t.section.code,
        })
      })
      setSections([...unique.values()].sort((a, b) => a.code.localeCompare(b.code)))
    } catch {
      setSections([])
    }
  }, [])

  const loadEligibleTasks = useCallback(async () => {
    setTasksLoading(true)
    setTasksError('')
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        limit: 200,
        skip: 0,
        min_severity: 1,
      }
      if (sectionIds.length === 1) params.section_id = sectionIds[0]
      if (depts.length < 3) params.dept = depts[0] // only if exactly one selected
      const res = await api.tasks(params)
      setTasks(res.tasks)
    } catch (e: unknown) {
      setTasksError(
        e instanceof Error ? e.message : 'Unable to load eligible tasks.',
      )
    } finally {
      setTasksLoading(false)
    }
  }, [sectionIds, depts])

  const loadCoa = useCallback(async () => {
    setCoaLoading(true)
    setCoaError('')
    try {
      const q = new URLSearchParams({ limit: '200' })
      const wq = new URLSearchParams({ available_only: 'true' })
      if (sectionIds.length === 1) {
        q.set('section_id', String(sectionIds[0]))
        wq.set('section_id', String(sectionIds[0]))
      }
      if (startDate) {
        q.set('schedule_date', startDate)
        wq.set('schedule_date', startDate)
      }
      const [trainData, windowData] = await Promise.all([
        api.trains(q),
        api.windows(wq),
      ])
      setTrains(trainData.trains)
      setWindows(windowData)
    } catch (e: unknown) {
      setCoaError(
        e instanceof Error ? e.message : 'Unable to load COA context.',
      )
    } finally {
      setCoaLoading(false)
    }
  }, [sectionIds, startDate])

  useEffect(() => {
    void loadSections()
  }, [loadSections])

  useEffect(() => {
    void loadEligibleTasks()
  }, [loadEligibleTasks])

  useEffect(() => {
    void loadCoa()
  }, [loadCoa])

  // ─────────────────────────────────────────────────────────────────────────
  // Plan generation
  // ─────────────────────────────────────────────────────────────────────────

  const generatePlan = async () => {
    setLoading(true)
    setError('')
    // Do NOT clear the previous plan until we have a new one — preserve on error
    setSelectedBlockId(null)

    try {
      const result = await api.generatePlan({
        start_date: startDate,
        end_date: endDate,
        horizon: String(horizon),
        train_density_multiplier: density,
        dept_codes: depts.length ? depts : null,
        section_ids: sectionIds.length ? sectionIds : null,
      })

      setPlan(result)

      if (result.blocks[0]) {
        setSelectedBlockId(result.blocks[0].id)
      }

      // Refresh COA context to reflect the new schedule date
      void loadCoa()
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Unable to generate optimised plan.',
      )
    } finally {
      setLoading(false)
    }
  }

  const resetPlan = () => {
    setPlan(null)
    setSelectedBlockId(null)
    setError('')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Derived data
  // ─────────────────────────────────────────────────────────────────────────

  // Map task_id -> block for scheduled tasks
  const taskBlockMap = useMemo(() => {
    const map = new Map<number, number>()
    if (plan) {
      plan.blocks.forEach((b) => {
        b.task_ids.forEach((tid) => map.set(tid, b.id))
      })
    }
    return map
  }, [plan])

  // Filter tasks for eligibility panel
  const filteredTasks = useMemo(() => {
    if (!taskFilter.trim()) return tasks
    const q = taskFilter.toLowerCase()
    return tasks.filter(
      (t) =>
        t.task_code.toLowerCase().includes(q) ||
        t.task_type.toLowerCase().includes(q) ||
        t.section.code.toLowerCase().includes(q) ||
        t.department.code.toLowerCase().includes(q),
    )
  }, [tasks, taskFilter])

  // Tasks that ended up scheduled in plan
  const scheduledTaskIds = useMemo(
    () => (plan ? new Set(plan.blocks.flatMap((b) => b.task_ids)) : new Set<number>()),
    [plan],
  )

  const selectedBlock = plan?.blocks.find((b) => b.id === selectedBlockId)

  const toggleDept = (code: string, checked: boolean) => {
    setDepts((cur) =>
      checked ? [...cur, code] : cur.filter((d) => d !== code),
    )
  }

  const toggleSection = (id: number, checked: boolean) => {
    setSectionIds((cur) =>
      checked ? [...cur, id] : cur.filter((s) => s !== id),
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="planning-page">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <header className="planning-page-header">
        <div>
          <p className="shell-eyebrow">Planning / Generator</p>
          <h2 className="planning-title">Planning Generator</h2>
          <p className="planning-subtitle">
            Generate coordinated railway maintenance blocks from maintenance
            tasks, operational constraints and train movement information.
          </p>
        </div>

        <div className="pgv-header-status">
          <span
            className={`status-dot ${loading ? '' : plan ? 'is-healthy' : ''}`}
          />
          {loading
            ? 'Optimiser running…'
            : plan
              ? `Plan ${plan.run_id} generated`
              : 'Ready for planning'}
        </div>
      </header>

      {/* ── Step 1: Planning context ─────────────────────────────────────── */}
      <section
        className="planning-control-surface pgv-step"
        aria-labelledby="pgv-context-heading"
      >
        <div className="planning-control-heading">
          <div>
            <p className="shell-eyebrow">Step 1</p>
            <h3 id="pgv-context-heading">Planning Context</h3>
          </div>
          <span className="planning-control-note">
            All controls map to the plan generation API
          </span>
        </div>

        <div className="planning-control-grid">
          <label>
            <span>Start date</span>
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Planning start date"
            />
          </label>

          <label>
            <span>End date</span>
            <input
              className="input"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="Planning end date"
            />
          </label>

          <label>
            <span>Planning horizon</span>
            <select
              className="input"
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
              aria-label="Planning horizon"
            >
              {HORIZONS.map((h) => (
                <option value={h.value} key={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>
              Train density <b>{density.toFixed(1)}x</b>
            </span>
            <input
              className="planning-range"
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={density}
              onChange={(e) => setDensity(Number(e.target.value))}
              aria-label={`Train density multiplier: ${density.toFixed(1)}`}
            />
          </label>
        </div>

        <div className="planning-control-lower">
          {/* Department filter */}
          <div className="planning-departments">
            <span>Departments</span>
            {DEPARTMENTS.map((d) => (
              <label
                key={d.code}
                className={depts.includes(d.code) ? 'is-selected' : ''}
              >
                <input
                  type="checkbox"
                  checked={depts.includes(d.code)}
                  onChange={(e) => toggleDept(d.code, e.target.checked)}
                  aria-label={`Include ${d.label} department`}
                />
                {d.code}
                <small>{d.label}</small>
              </label>
            ))}
          </div>

          {/* Section filter */}
          <div className="planning-sections">
            <span>Railway sections</span>
            <div className="planning-section-picker">
              {sections.length ? (
                sections.map((s) => (
                  <label key={s.id}>
                    <input
                      type="checkbox"
                      checked={sectionIds.includes(s.id)}
                      onChange={(e) => toggleSection(s.id, e.target.checked)}
                      aria-label={`Include section ${s.code}`}
                    />
                    {s.code}
                    <small>{s.name}</small>
                  </label>
                ))
              ) : (
                <span className="planning-muted">Loading sections…</span>
              )}
            </div>
          </div>

          {/* Generate button */}
          <button
            className="pgv-generate-button"
            type="button"
            onClick={() => void generatePlan()}
            disabled={loading || !startDate || !endDate}
            aria-busy={loading}
            aria-label={loading ? 'Generating plan, please wait' : 'Generate maintenance plan'}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Route className="h-4 w-4" aria-hidden="true" />
            )}
            {loading ? 'Optimising plan…' : 'Generate Plan'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="planning-error" role="alert">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span>{error}</span>
            <button type="button" onClick={() => void generatePlan()}>
              Retry
            </button>
          </div>
        )}

        {/* Reset plan (only if one exists) */}
        {plan && !loading && (
          <div className="pgv-reset-row">
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>Plan {plan.run_id} generated.</span>
            <button
              type="button"
              className="pgv-reset-btn"
              onClick={resetPlan}
              aria-label="Clear current plan and start over"
            >
              Start over
            </button>
          </div>
        )}
      </section>

      {/* ── Step 2: Task eligibility ─────────────────────────────────────── */}
      <section className="pgv-step" aria-labelledby="pgv-tasks-heading">
        <div className="pgv-section-header">
          <div>
            <p className="shell-eyebrow">Step 2</p>
            <h3 id="pgv-tasks-heading">Eligible Maintenance Tasks</h3>
          </div>

          <div className="pgv-section-header-actions">
            {!tasksLoading && (
              <span className="panel-meta">
                {filteredTasks.length} of {tasks.length} task
                {tasks.length !== 1 ? 's' : ''}
                {plan
                  ? ` · ${scheduledTaskIds.size} scheduled`
                  : ''}
              </span>
            )}
            <button
              className="pgv-icon-btn"
              type="button"
              onClick={() => void loadEligibleTasks()}
              aria-label="Refresh eligible tasks"
              title="Refresh eligible tasks"
              disabled={tasksLoading}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              className="pgv-toggle-btn"
              type="button"
              onClick={() => setShowTasksPanel((v) => !v)}
              aria-expanded={showTasksPanel}
              aria-controls="pgv-tasks-panel"
            >
              {showTasksPanel ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {showTasksPanel ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        {showTasksPanel && (
          <div id="pgv-tasks-panel" className="surface-panel">
            {/* Filter bar */}
            <div className="pgv-tasks-filter">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              <input
                className="pgv-tasks-search"
                type="search"
                placeholder="Filter by task code, type, section or department…"
                value={taskFilter}
                onChange={(e) => setTaskFilter(e.target.value)}
                aria-label="Filter tasks"
              />
              {plan && (
                <span className="pgv-tasks-filter-note">
                  {scheduledTaskIds.size} scheduled ·{' '}
                  {tasks.length - scheduledTaskIds.size} not in plan
                </span>
              )}
            </div>

            {/* Task list */}
            <div className="pgv-tasks-list">
              {tasksLoading ? (
                <div className="pgv-tasks-skeleton">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="pgv-task-skeleton-row">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ))}
                </div>
              ) : tasksError ? (
                <div className="planning-inline-error" role="alert">
                  <AlertTriangle className="h-4 w-4" />
                  {tasksError}
                  <button
                    type="button"
                    onClick={() => void loadEligibleTasks()}
                  >
                    Retry
                  </button>
                </div>
              ) : filteredTasks.length === 0 ? (
                <EmptyState label="No tasks match the current planning context." />
              ) : (
                <>
                  {/* Column header */}
                  <div className="pgv-task-header">
                    <span>Task / Type</span>
                    <span>Section</span>
                    <span>Dept</span>
                    <span>Priority</span>
                    <span>Flags</span>
                    <span>Duration</span>
                    <span>Plan status</span>
                  </div>
                  {filteredTasks.map((t) => (
                    <TaskEligibilityRow
                      key={t.id}
                      task={t}
                      inPlan={scheduledTaskIds.has(t.id)}
                      blockId={taskBlockMap.get(t.id)}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Generate CTA if no plan yet ──────────────────────────────────── */}
      {!plan && !loading && (
        <div className="pgv-step">
          <WorkflowHint />
        </div>
      )}

      {/* ── Loading state ────────────────────────────────────────────────── */}
      {loading && (
        <div className="pgv-generation-loading" role="status" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          <div>
            <strong>Generating coordinated maintenance plan…</strong>
            <p>
              The optimiser is assigning tasks to COA block windows. This may
              take a moment.
            </p>
          </div>
        </div>
      )}

      {/* ── Step 3+: Generated plan ──────────────────────────────────────── */}
      {plan && (
        <>
          {/* Executive summary */}
          <section
            className="pgv-step"
            aria-labelledby="pgv-summary-heading"
          >
            <div className="pgv-section-header">
              <div>
                <p className="shell-eyebrow">Step 3 · Run {plan.run_id}</p>
                <h3 id="pgv-summary-heading">Plan Summary</h3>
              </div>
              <span className="panel-meta">
                Horizon: {plan.horizon === 7 ? 'Weekly' : 'Monthly'}
              </span>
            </div>

            <div className="pgv-metrics-grid">
              <SummaryMetric
                label="Blocks generated"
                value={plan.total_blocks}
                icon={Layers3}
              />
              <SummaryMetric
                label="Tasks scheduled"
                value={plan.total_tasks_scheduled}
                icon={CheckCircle2}
                variant="success"
              />
              <SummaryMetric
                label="Tasks dropped"
                value={plan.tasks_dropped}
                sub={plan.tasks_dropped > 0 ? 'No suitable window' : undefined}
                icon={XCircle}
                variant={plan.tasks_dropped > 0 ? 'warning' : 'default'}
              />
              <SummaryMetric
                label="Joint blocks"
                value={plan.joint_blocks}
                sub="Multi-dept"
                icon={Database}
              />
              <SummaryMetric
                label="Avg efficiency"
                value={`${plan.avg_efficiency}%`}
                icon={Zap}
                variant={
                  plan.avg_efficiency >= 75
                    ? 'success'
                    : plan.avg_efficiency >= 50
                      ? 'default'
                      : 'warning'
                }
              />
              <SummaryMetric
                label="Asset availability"
                value={`${plan.asset_availability_pct}%`}
                icon={TrainFront}
              />
            </div>

            {/* Dropped tasks warning */}
            {plan.tasks_dropped > 0 && (
              <div className="pgv-dropped-warning" role="alert">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <div>
                  <strong>
                    {plan.tasks_dropped} task
                    {plan.tasks_dropped !== 1 ? 's were' : ' was'} not
                    scheduled.
                  </strong>
                  <p>
                    These tasks could not fit into any available COA block
                    window within the planning horizon. Review the task
                    durations and available windows, or extend the planning
                    horizon.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* ── Step 4: Block cards ──────────────────────────────────────── */}
          <section
            className="pgv-step"
            aria-labelledby="pgv-blocks-heading"
          >
            <div className="pgv-section-header">
              <div>
                <p className="shell-eyebrow">Step 4</p>
                <h3 id="pgv-blocks-heading">Generated Blocks</h3>
              </div>
              <span className="panel-meta">
                {plan.blocks.length} block
                {plan.blocks.length !== 1 ? 's' : ''} ·{' '}
                {plan.joint_blocks} joint
              </span>
            </div>

            <div className="pgv-block-cards-grid">
              {plan.blocks.map((block) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  tasks={tasks}
                  selected={selectedBlockId === block.id}
                  onSelect={() => setSelectedBlockId(block.id)}
                />
              ))}
            </div>
          </section>

          {/* ── Timeline ─────────────────────────────────────────────────── */}
          <section className="pgv-step" aria-labelledby="pgv-timeline-heading">
            <div className="pgv-section-header">
              <div>
                <p className="shell-eyebrow">Step 4 · Visual</p>
                <h3 id="pgv-timeline-heading">Planning Timeline</h3>
              </div>
              <div className="pgv-section-header-actions">
                {selectedBlock && (
                  <span className="panel-meta">
                    Selected: {selectedBlock.section_code}{' '}
                    {selectedBlock.start_time}–{selectedBlock.end_time}
                  </span>
                )}
                <button
                  className="pgv-toggle-btn"
                  type="button"
                  onClick={() => setShowTimeline((v) => !v)}
                  aria-expanded={showTimeline}
                >
                  {showTimeline ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {showTimeline ? 'Collapse' : 'Expand'}
                </button>
              </div>
            </div>

            {showTimeline && (
              <Panel
                title="Time — section layout"
                actions={
                  <span className="panel-meta">
                    {plan.blocks.length} block
                    {plan.blocks.length !== 1 ? 's' : ''}
                  </span>
                }
              >
                <Timeline
                  blocks={plan.blocks}
                  trains={trains}
                  windows={windows}
                  selectedId={selectedBlockId}
                  onSelect={setSelectedBlockId}
                />

                {coaLoading && (
                  <div className="planning-loading">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading COA timetable context…
                  </div>
                )}

                {coaError && (
                  <div className="planning-inline-error" role="alert">
                    <AlertTriangle className="h-4 w-4" />
                    {coaError}
                    <button type="button" onClick={() => void loadCoa()}>
                      Retry
                    </button>
                  </div>
                )}
              </Panel>
            )}
          </section>
        </>
      )}

      {/* ── COA operational context (always visible after data loads) ─────── */}
      <section className="pgv-step" aria-labelledby="pgv-coa-heading">
        <div className="pgv-section-header">
          <div>
            <p className="shell-eyebrow">Operational Context</p>
            <h3 id="pgv-coa-heading">Train Operations · COA</h3>
          </div>
          <div className="pgv-section-header-actions">
            <span className="panel-meta">{startDate}</span>
            <button
              className="pgv-icon-btn"
              type="button"
              onClick={() => void loadCoa()}
              aria-label="Refresh COA data"
              title="Refresh COA data"
              disabled={coaLoading}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              className="pgv-toggle-btn"
              type="button"
              onClick={() => setShowCoaContext((v) => !v)}
              aria-expanded={showCoaContext}
            >
              {showCoaContext ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {showCoaContext ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        {showCoaContext && (
          <div className="planning-context-grid">
            {/* Train movements */}
            <Panel
              title="Train movements"
              actions={
                <span className="panel-meta">
                  {coaLoading ? 'Loading…' : `${trains.length} trains`}
                </span>
              }
            >
              {coaLoading ? (
                <div className="planning-loading">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading train movements
                </div>
              ) : coaError ? (
                <div className="planning-inline-error" role="alert">
                  <AlertTriangle className="h-4 w-4" />
                  {coaError}
                  <button type="button" onClick={() => void loadCoa()}>
                    Retry
                  </button>
                </div>
              ) : trains.length > 0 ? (
                <div className="planning-train-list">
                  {trains.slice(0, 12).map((t) => (
                    <div className="planning-train-row" key={t.id}>
                      <span className="train-time">{t.entry_time}</span>
                      <span className="train-line">
                        <TrainFront className="h-3.5 w-3.5" aria-hidden="true" />
                        {t.train_no}
                        <small>
                          {t.train_name ?? t.train_type} · {t.direction}
                        </small>
                      </span>
                      <span className={`train-priority is-${t.train_priority}`}>
                        {t.train_priority}
                      </span>
                      <span>{t.exit_time}</span>
                    </div>
                  ))}
                  {trains.length > 12 && (
                    <p className="pgv-more-note">
                      +{trains.length - 12} more trains
                    </p>
                  )}
                </div>
              ) : (
                <EmptyState label="No train movements for this date and scope." />
              )}
            </Panel>

            {/* Available windows */}
            <Panel
              title="Available COA windows"
              actions={
                <span className="panel-meta">
                  {coaLoading ? 'Loading…' : `${windows.length} available`}
                </span>
              }
            >
              {coaLoading ? (
                <div className="planning-loading">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading block windows
                </div>
              ) : windows.length > 0 ? (
                <div className="planning-window-list">
                  {windows.slice(0, 10).map((wnd) => (
                    <div className="planning-window-row" key={wnd.id}>
                      <span className="window-time">
                        {wnd.start_time} – {wnd.end_time}
                      </span>
                      <span>Section {wnd.section_id}</span>
                      <span>{wnd.duration_minutes} min</span>
                      <span className="pgv-window-type">{wnd.window_type}</span>
                    </div>
                  ))}
                  {windows.length > 10 && (
                    <p className="pgv-more-note">
                      +{windows.length - 10} more windows
                    </p>
                  )}
                </div>
              ) : (
                <EmptyState label="No available windows for the current date and scope." />
              )}
            </Panel>
          </div>
        )}
      </section>
    </div>
  )
}