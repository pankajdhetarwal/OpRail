/**
 * PlanHistoryView.tsx — Mission 9: Plan History Archive
 *
 * The /api/plan/history endpoint returns a flat list of PlanBlocks.
 * Blocks from the same generation run share the same run_id.
 * This view groups them into "plan runs" for display.
 *
 * NO mock data. NO invented plan status. Everything comes from the backend.
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
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  Database,
  Filter,
  Layers3,
  Loader2,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  X,
  Zap,
} from 'lucide-react'
import { api } from '../../core/api/client'
import type { PlanBlock } from '../../types/api'
import { EmptyState, Panel } from '../../components/common'
import { deptAccent } from '../../utils/format'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A PlanRun is derived by grouping PlanBlocks that share the same run_id.
 * It is not a backend type — it is assembled on the frontend.
 */
interface PlanRun {
  run_id: string
  schedule_date: string       // from first block
  created_at: string | null   // from first block that has one
  horizon: string             // from first block
  blocks: PlanBlock[]
  total_blocks: number
  total_tasks: number
  joint_blocks: number
  avg_efficiency: number
  sections: string[]          // unique section codes
  departments: string[]       // unique departments
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normaliseHorizon(raw: string | undefined | null): string {
  if (!raw) return '—'
  const s = String(raw).toLowerCase()
  if (s === '7' || s === 'weekly') return 'Weekly'
  if (s === '30' || s === 'monthly') return 'Monthly'
  return raw
}

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
      new Date(`${iso}T00:00:00`),
    )
  } catch {
    return iso
  }
}

function fmtDateTimeCompact(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

/** Group a flat PlanBlock[] into PlanRun[] sorted newest-first. */
function groupIntoRuns(blocks: PlanBlock[]): PlanRun[] {
  const map = new Map<string, PlanBlock[]>()

  for (const block of blocks) {
    const key = block.run_id ?? `__no_run_${block.id}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(block)
  }

  const runs: PlanRun[] = []

  map.forEach((runBlocks, runId) => {
    const first = runBlocks[0]
    const sections = [...new Set(runBlocks.map((b) => b.section_code))]
    const departments = [
      ...new Set(runBlocks.flatMap((b) => b.departments_involved)),
    ]
    const totalTasks = runBlocks.reduce((s, b) => s + b.task_ids.length, 0)
    const jointBlocks = runBlocks.filter((b) => b.is_joint_block).length
    const avgEff =
      runBlocks.reduce((s, b) => s + b.efficiency_score, 0) / runBlocks.length

    // Pick the best created_at across all blocks in the run
    const createdAt =
      runBlocks
        .map((b) => b.created_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null

    runs.push({
      run_id: runId,
      schedule_date: first.schedule_date,
      created_at: createdAt ?? null,
      horizon: first.horizon ?? '',
      blocks: runBlocks,
      total_blocks: runBlocks.length,
      total_tasks: totalTasks,
      joint_blocks: jointBlocks,
      avg_efficiency: Math.round(avgEff * 10) / 10,
      sections,
      departments,
    })
  })

  // Sort newest creation first (fallback to schedule_date)
  return runs.sort((a, b) => {
    const ta = a.created_at ?? a.schedule_date
    const tb = b.created_at ?? b.schedule_date
    return tb.localeCompare(ta)
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Single metric chip for the aggregate strip */
function MetricChip({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: typeof Layers3
}) {
  return (
    <div className="phv-metric">
      <div className="phv-metric-icon">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
      <div>
        <span className="phv-metric-label">{label}</span>
        <strong className="phv-metric-value">{value}</strong>
      </div>
    </div>
  )
}

/** Skeleton loading rows */
function SkeletonRows({ n = 5 }: { n?: number }) {
  return (
    <div className="phv-skeleton">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="phv-skeleton-row">
          <span style={{ width: '9%' }} />
          <span style={{ width: '12%' }} />
          <span style={{ width: '10%' }} />
          <span style={{ width: '18%' }} />
          <span style={{ width: '8%' }} />
          <span style={{ width: '8%' }} />
          <span style={{ width: '8%' }} />
          <span style={{ width: '12%' }} />
        </div>
      ))}
    </div>
  )
}

/** Department badges row */
function DeptBadges({ depts }: { depts: string[] }) {
  return (
    <>
      {depts.map((d) => (
        <span key={d} className={`phv-dept-badge ${deptAccent[d] ?? ''}`}>
          {d}
        </span>
      ))}
    </>
  )
}

/** Efficiency bar */
function EffBar({ value }: { value: number }) {
  const cls =
    value >= 75 ? 'is-good' : value >= 50 ? 'is-mid' : 'is-low'
  return (
    <div className={`phv-eff-bar ${cls}`} aria-label={`${value}% efficiency`}>
      <div className="phv-eff-track">
        <span style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <b>{value}%</b>
    </div>
  )
}

/** Expanded block list inside a plan run row */
function RunBlockList({ blocks }: { blocks: PlanBlock[] }) {
  return (
    <div className="phv-run-blocks">
      <div className="phv-run-blocks-header">
        <span>Block ID</span>
        <span>Section</span>
        <span>Date</span>
        <span>Window</span>
        <span>Duration</span>
        <span>Tasks</span>
        <span>Dept(s)</span>
        <span>Efficiency</span>
      </div>

      {blocks.map((b) => (
        <div key={b.id} className={`phv-run-block-row ${b.is_joint_block ? 'is-joint' : ''}`}>
          <span className="phv-run-block-id">
            B-{String(b.id).padStart(2, '0')}
            {b.is_joint_block && <span className="phv-joint-chip">JOINT</span>}
          </span>
          <span>{b.section_code}</span>
          <span>{fmtDate(b.schedule_date)}</span>
          <span className="phv-mono">
            {b.start_time}–{b.end_time}
          </span>
          <span>{b.duration_minutes} min</span>
          <span>{b.task_ids.length}</span>
          <span className="phv-dept-list">
            <DeptBadges depts={b.departments_involved} />
          </span>
          <span>
            <EffBar value={b.efficiency_score} />
          </span>
        </div>
      ))}
    </div>
  )
}

/** Full plan detail drawer */
function PlanDrawer({
  run,
  onClose,
}: {
  run: PlanRun
  onClose: () => void
}) {
  const [expandedBlockId, setExpandedBlockId] = useState<number | null>(null)

  const toggleBlock = (id: number) =>
    setExpandedBlockId((cur) => (cur === id ? null : id))

  return (
    <>
      {/* Backdrop */}
      <div
        className="task-drawer-backdrop"
        role="button"
        aria-label="Close plan detail"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      />

      {/* Drawer */}
      <aside
        className="task-drawer"
        aria-label={`Plan detail: ${run.run_id}`}
        role="complementary"
      >
        {/* Drawer header */}
        <div className="task-drawer-header">
          <div>
            <p className="shell-eyebrow">Plan run</p>
            <h2>{run.run_id}</h2>
            <p>
              {fmtDate(run.schedule_date)} ·{' '}
              {normaliseHorizon(run.horizon)} horizon
            </p>
          </div>
          <button
            className="phv-drawer-close"
            type="button"
            onClick={onClose}
            aria-label="Close plan detail drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="task-drawer-body">
          {/* Plan info */}
          <section className="phv-drawer-section">
            <h3>Plan Information</h3>
            <div className="phv-drawer-info-grid">
              <div>
                <span>Run ID</span>
                <strong>{run.run_id}</strong>
              </div>
              <div>
                <span>Generated</span>
                <strong>{fmtDateTimeCompact(run.created_at)}</strong>
              </div>
              <div>
                <span>Schedule date</span>
                <strong>{fmtDate(run.schedule_date)}</strong>
              </div>
              <div>
                <span>Horizon</span>
                <strong>{normaliseHorizon(run.horizon)}</strong>
              </div>
              <div>
                <span>Sections</span>
                <strong>{run.sections.join(', ') || '—'}</strong>
              </div>
              <div>
                <span>Departments</span>
                <strong>{run.departments.join(', ') || '—'}</strong>
              </div>
            </div>
          </section>

          {/* Plan summary */}
          <section className="phv-drawer-section">
            <h3>Plan Summary</h3>
            <div className="phv-drawer-metrics">
              <div>
                <span>Blocks</span>
                <strong>{run.total_blocks}</strong>
              </div>
              <div>
                <span>Tasks scheduled</span>
                <strong>{run.total_tasks}</strong>
              </div>
              <div>
                <span>Joint blocks</span>
                <strong>{run.joint_blocks}</strong>
              </div>
              <div>
                <span>Avg efficiency</span>
                <strong>{run.avg_efficiency}%</strong>
              </div>
            </div>
          </section>

          {/* Blocks */}
          <section className="phv-drawer-section phv-drawer-blocks-section">
            <h3>
              Blocks
              <span className="phv-drawer-section-count">{run.total_blocks}</span>
            </h3>

            {run.blocks.map((block) => {
              const isOpen = expandedBlockId === block.id
              return (
                <div
                  key={block.id}
                  className={`phv-drawer-block ${block.is_joint_block ? 'is-joint' : ''} ${isOpen ? 'is-open' : ''}`}
                >
                  {/* Block summary row */}
                  <button
                    className="phv-drawer-block-toggle"
                    type="button"
                    onClick={() => toggleBlock(block.id)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} block B-${block.id}`}
                  >
                    <span className="phv-drawer-block-id">
                      B-{String(block.id).padStart(2, '0')}
                      {block.is_joint_block && (
                        <span className="phv-joint-chip">JOINT</span>
                      )}
                    </span>

                    <span className="phv-drawer-block-section">
                      <Route className="h-3 w-3" aria-hidden="true" />
                      {block.section_code} · {block.section_name}
                    </span>

                    <span className="phv-drawer-block-time">
                      <Clock3 className="h-3 w-3" aria-hidden="true" />
                      {block.start_time}–{block.end_time}
                    </span>

                    <span className="phv-drawer-block-dur">
                      {block.duration_minutes} min
                    </span>

                    <span className="phv-drawer-block-tasks">
                      <Layers3 className="h-3 w-3" aria-hidden="true" />
                      {block.task_ids.length} task{block.task_ids.length !== 1 ? 's' : ''}
                    </span>

                    {isOpen ? (
                      <ChevronUp className="h-3.5 w-3.5 phv-drawer-chevron" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 phv-drawer-chevron" />
                    )}
                  </button>

                  {/* Expanded block detail */}
                  {isOpen && (
                    <div className="phv-drawer-block-detail">
                      {/* Metrics */}
                      <div className="phv-drawer-block-metrics">
                        <div>
                          <span>Efficiency</span>
                          <strong>{block.efficiency_score}%</strong>
                        </div>
                        <div>
                          <span>Priority total</span>
                          <strong>{block.total_priority_score.toFixed(1)}</strong>
                        </div>
                        <div>
                          <span>Date</span>
                          <strong>{fmtDate(block.schedule_date)}</strong>
                        </div>
                        <div>
                          <span>Departments</span>
                          <strong>{block.departments_involved.join(' / ')}</strong>
                        </div>
                      </div>

                      {/* Why explanation */}
                      {block.why_explanation && (
                        <div className="phv-drawer-explanation">
                          <span className="phv-drawer-explanation-label">
                            Rationale
                          </span>
                          <p>{block.why_explanation}</p>
                        </div>
                      )}

                      {/* Task IDs */}
                      <div className="phv-drawer-task-ids">
                        <span className="phv-drawer-explanation-label">
                          Scheduled task IDs
                        </span>
                        <div className="phv-drawer-task-id-list">
                          {block.task_ids.map((tid) => (
                            <span key={tid} className="phv-task-id-chip">
                              #{tid}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        </div>
      </aside>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const LIMIT_OPTIONS = [50, 100, 200] as const
type LimitOption = (typeof LIMIT_OPTIONS)[number]

export function PlanHistoryView() {
  // ── Data state ─────────────────────────────────────────────────────────────
  const [allBlocks, setAllBlocks] = useState<PlanBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState<LimitOption>(100)

  // ── Selection ──────────────────────────────────────────────────────────────
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [filterHorizon, setFilterHorizon] = useState<string>('all')
  const [filterDate, setFilterDate] = useState('')
  const [filterDept, setFilterDept] = useState<string>('all')

  // ── Load history ───────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const res = await api.planHistory(limit)
      setAllBlocks(res.blocks)
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Unable to load plan history.',
      )
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  // ── Group blocks into plan runs ────────────────────────────────────────────
  const allRuns = useMemo(() => groupIntoRuns(allBlocks), [allBlocks])

  // ── Filter runs ───────────────────────────────────────────────────────────
  const filteredRuns = useMemo(() => {
    const q = search.toLowerCase().trim()

    return allRuns.filter((run) => {
      if (filterHorizon !== 'all') {
        const h = normaliseHorizon(run.horizon).toLowerCase()
        if (filterHorizon === 'weekly' && !h.includes('week')) return false
        if (filterHorizon === 'monthly' && !h.includes('month')) return false
      }

      if (filterDate && run.schedule_date !== filterDate) return false

      if (filterDept !== 'all' && !run.departments.includes(filterDept))
        return false

      if (q) {
        const match =
          run.run_id.toLowerCase().includes(q) ||
          run.sections.some((s) => s.toLowerCase().includes(q)) ||
          run.schedule_date.includes(q)
        if (!match) return false
      }

      return true
    })
  }, [allRuns, search, filterHorizon, filterDate, filterDept])

  // ── Aggregate metrics (derived from ALL loaded blocks, not just filtered) ──
  const metrics = useMemo(() => {
    const totalPlans = allRuns.length
    const totalBlocks = allBlocks.length
    const totalTasks = allBlocks.reduce((s, b) => s + b.task_ids.length, 0)
    const jointBlocks = allBlocks.filter((b) => b.is_joint_block).length
    const avgEff =
      allBlocks.length > 0
        ? Math.round(
            (allBlocks.reduce((s, b) => s + b.efficiency_score, 0) /
              allBlocks.length) *
              10,
          ) / 10
        : 0
    return { totalPlans, totalBlocks, totalTasks, jointBlocks, avgEff }
  }, [allRuns, allBlocks])

  const hasFilters = !!(search || filterHorizon !== 'all' || filterDate || filterDept !== 'all')

  const clearFilters = () => {
    setSearch('')
    setFilterHorizon('all')
    setFilterDate('')
    setFilterDept('all')
  }

  const selectedRun = selectedRunId
    ? allRuns.find((r) => r.run_id === selectedRunId) ?? null
    : null

  const toggleRunExpansion = (runId: string) =>
    setExpandedRunId((cur) => (cur === runId ? null : runId))

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div className={`planning-page ${selectedRun ? 'phv-has-drawer' : ''}`}>
        {/* ── Page header ───────────────────────────────────────────── */}
        <header className="planning-page-header">
          <div>
            <p className="shell-eyebrow">Planning / History</p>
            <h2 className="planning-title">Plan Archive</h2>
            <p className="planning-subtitle">
              Review, compare and inspect previously generated maintenance block
              plans.
            </p>
          </div>

          <div className="phv-header-actions">
            {/* Limit selector */}
            <label className="phv-limit-label">
              <span>Show</span>
              <select
                className="input phv-limit-select"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) as LimitOption)}
                aria-label="Records to load"
              >
                {LIMIT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} records
                  </option>
                ))}
              </select>
            </label>

            <button
              className="pgv-icon-btn"
              type="button"
              onClick={() => void loadHistory()}
              disabled={loading}
              aria-label="Refresh plan history"
              title="Refresh"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </header>

        {/* ── Aggregate metrics ─────────────────────────────────────── */}
        {!loading && allBlocks.length > 0 && (
          <div className="phv-metrics-strip" aria-label="Aggregate plan metrics">
            <MetricChip
              label="Plans generated"
              value={metrics.totalPlans}
              icon={Database}
            />
            <MetricChip
              label="Total blocks"
              value={metrics.totalBlocks}
              icon={Layers3}
            />
            <MetricChip
              label="Tasks scheduled"
              value={metrics.totalTasks}
              icon={ShieldAlert}
            />
            <MetricChip
              label="Joint blocks"
              value={metrics.jointBlocks}
              icon={Route}
            />
            <MetricChip
              label="Avg efficiency"
              value={`${metrics.avgEff}%`}
              icon={Zap}
            />
            <div className="phv-metrics-note">
              Derived from {allBlocks.length} loaded block
              {allBlocks.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* ── Filter bar ────────────────────────────────────────────── */}
        <div className="phv-filter-bar" role="search" aria-label="Filter plans">
          <div className="phv-search-wrap">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <input
              className="phv-search-input"
              type="search"
              placeholder="Search run ID, section code, date…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search plans"
            />
          </div>

          <div className="phv-filter-fields">
            <label className="phv-filter-field">
              <Filter className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">Horizon</span>
              <select
                className="input phv-filter-select"
                value={filterHorizon}
                onChange={(e) => setFilterHorizon(e.target.value)}
                aria-label="Filter by horizon"
              >
                <option value="all">All horizons</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>

            <label className="phv-filter-field">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">Date</span>
              <input
                className="input phv-filter-date"
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                aria-label="Filter by schedule date"
              />
            </label>

            <label className="phv-filter-field">
              <span className="sr-only">Department</span>
              <select
                className="input phv-filter-select"
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                aria-label="Filter by department"
              >
                <option value="all">All departments</option>
                <option value="ENG">ENG</option>
                <option value="ST">ST</option>
                <option value="OHE">OHE</option>
              </select>
            </label>

            {hasFilters && (
              <button
                className="pgv-icon-btn phv-clear-btn"
                type="button"
                onClick={clearFilters}
                aria-label="Clear all filters"
                title="Clear filters"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>

          {!loading && (
            <span className="phv-filter-count" aria-live="polite">
              {filteredRuns.length} of {allRuns.length} plan run
              {allRuns.length !== 1 ? 's' : ''}
              {hasFilters ? ' (filtered)' : ''}
            </span>
          )}
        </div>

        {/* ── Main plan archive ─────────────────────────────────────── */}
        <Panel
          title="Plan archive"
          actions={
            <span className="panel-meta">
              {loading
                ? 'Loading…'
                : `${allRuns.length} plan run${allRuns.length !== 1 ? 's' : ''}`}
            </span>
          }
        >
          {error ? (
            <div className="planning-inline-error" role="alert">
              <AlertTriangle className="h-4 w-4" />
              {error}
              <button type="button" onClick={() => void loadHistory()}>
                Retry
              </button>
            </div>
          ) : loading ? (
            <SkeletonRows n={6} />
          ) : allRuns.length === 0 ? (
            /* No history at all */
            <div className="phv-empty-archive">
              <EmptyState label="No generated plans found. Plans will appear here after you run the Planning Generator." />
            </div>
          ) : filteredRuns.length === 0 ? (
            /* Filters matched nothing */
            <div className="phv-empty-archive">
              <EmptyState label="No plans match the current filters. Try clearing some filters." />
              <button
                className="pgv-toggle-btn"
                type="button"
                onClick={clearFilters}
                style={{ marginTop: 12 }}
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </button>
            </div>
          ) : (
            /* Table */
            <div className="phv-table-wrap">
              {/* Column headers */}
              <div className="phv-table-head">
                <span>Run ID</span>
                <span>Schedule date</span>
                <span>Horizon</span>
                <span>Generated</span>
                <span>Blocks</span>
                <span>Tasks</span>
                <span>Joint</span>
                <span>Departments</span>
                <span>Avg eff.</span>
                <span>{/* expand / inspect */}</span>
              </div>

              {/* Plan run rows */}
              {filteredRuns.map((run) => {
                const isExpanded = expandedRunId === run.run_id
                const isSelected = selectedRunId === run.run_id

                return (
                  <div
                    key={run.run_id}
                    className={`phv-run-group ${isExpanded ? 'is-expanded' : ''} ${isSelected ? 'is-selected' : ''}`}
                  >
                    {/* Summary row */}
                    <div className="phv-run-row">
                      <span className="phv-run-id">{run.run_id}</span>

                      <span className="phv-run-date">
                        <Calendar className="h-3 w-3" aria-hidden="true" />
                        {fmtDate(run.schedule_date)}
                      </span>

                      <span className="phv-horizon-badge">
                        {normaliseHorizon(run.horizon)}
                      </span>

                      <span className="phv-run-generated">
                        {fmtDateTimeCompact(run.created_at)}
                      </span>

                      <span className="phv-run-num">{run.total_blocks}</span>

                      <span className="phv-run-num">{run.total_tasks}</span>

                      <span className="phv-run-num">
                        {run.joint_blocks > 0 ? (
                          <span className="phv-joint-count">{run.joint_blocks}</span>
                        ) : (
                          <span className="phv-zero">0</span>
                        )}
                      </span>

                      <span className="phv-run-depts">
                        <DeptBadges depts={run.departments} />
                      </span>

                      <span>
                        <EffBar value={run.avg_efficiency} />
                      </span>

                      <span className="phv-run-actions">
                        {/* Inline expand */}
                        <button
                          className="phv-action-btn"
                          type="button"
                          onClick={() => toggleRunExpansion(run.run_id)}
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} blocks for plan ${run.run_id}`}
                          aria-expanded={isExpanded}
                          title={isExpanded ? 'Collapse blocks' : 'Show blocks'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>

                        {/* Detail drawer */}
                        <button
                          className={`phv-action-btn phv-inspect-btn ${isSelected ? 'is-active' : ''}`}
                          type="button"
                          onClick={() =>
                            setSelectedRunId((cur) =>
                              cur === run.run_id ? null : run.run_id,
                            )
                          }
                          aria-label={`Inspect plan ${run.run_id}`}
                          title="Inspect plan detail"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>

                    {/* Inline block list */}
                    {isExpanded && (
                      <div className="phv-run-expand-area">
                        <RunBlockList blocks={run.blocks} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Detail drawer ─────────────────────────────────────────────── */}
      {selectedRun && (
        <PlanDrawer
          run={selectedRun}
          onClose={() => setSelectedRunId(null)}
        />
      )}
    </>
  )
}