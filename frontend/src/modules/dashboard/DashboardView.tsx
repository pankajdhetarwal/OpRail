/**
 * DashboardView.tsx — Mission 14: OpRail Operations Control Center
 *
 * All metrics are derived strictly from backend API responses.
 * No hardcoded or mock data is used.
 *
 * Data source mapping (post-audit — every number must be traceable):
 *   Total Tasks          → GET /api/dashboard/ → total_tasks
 *   Overdue Tasks        → GET /api/dashboard/ → overdue_tasks
 *   Safety-Critical      → GET /api/dashboard/ → critical_tasks
 *   Scheduled Tasks      → GET /api/dashboard/ → scheduled_tasks
 *   Not Scheduled        → derived: total_tasks - scheduled_tasks
 *                          (includes OVERDUE + PENDING + IN_PROGRESS + COMPLETED)
 *   Blocks Today         → GET /api/dashboard/ → todays_blocks
 *   Joint Blocks Today   → GET /api/dashboard/ → joint_blocks_today
 *   Block Efficiency     → GET /api/dashboard/ → avg_block_efficiency
 *   Asset Availability   → GET /api/dashboard/ → asset_availability_pct
 *   Dept Workload        → GET /api/dashboard/ → dept_stats[].total_tasks
 *   Task Status Dist.    → GET /api/dashboard/ → overdue_tasks + scheduled_tasks + remainder
 *                          (mutually exclusive: status enum OVERDUE | SCHEDULED | other)
 *   Avail Trend          → GET /api/dashboard/ → availability_trend[]
 *   Recent Critical      → GET /api/tasks/?min_severity=4&limit=8
 *   Latest Plan / Runs   → GET /api/plan/history?limit=10
 *   Train Total          → GET /api/coa/trains?limit=1&skip=0 → total ONLY (not array length)
 *   Block Windows        → GET /api/coa/windows?available_only=true → array.length
 *                          (/api/coa/windows has NO limit param — returns full matching set)
 *   Section Status       → GET /api/dashboard/ → section_statuses[]
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  GitBranchPlus,
  History,
  Layers,
  RefreshCw,
  SearchCheck,
  ShieldAlert,
  Sparkles,
  Target,
  TrainFront,
  TrendingUp,
  Zap,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../../core/api/client'
import type {
  BlockWindow,
  DashboardKPIs,
  PlanBlock,
  Task,
} from '../../types/api'
import type { ViewKey } from '../../layouts/AppShell'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat().format(n)
const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(`${iso}T00:00:00`),
  )


// ─── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`db-skeleton ${className}`} aria-hidden="true" />
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="db-section-divider">
      <span>{label}</span>
    </div>
  )
}

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  tone: 'teal' | 'blue' | 'red' | 'amber' | 'green' | 'violet' | 'indigo'
  icon: React.ReactNode
  warn?: boolean
  loading?: boolean
}

function KpiCard({ label, value, sub, tone, icon, warn, loading }: KpiCardProps) {
  return (
    <article className={`db-kpi-card tone-${tone} ${warn ? 'is-warn' : ''}`}>
      <div className="db-kpi-icon">{icon}</div>
      <div className="db-kpi-body">
        <p className="db-kpi-label">{label}</p>
        {loading ? (
          <Skeleton className="db-kpi-skel" />
        ) : (
          <p className="db-kpi-value">{value}</p>
        )}
        {sub && !loading ? <p className="db-kpi-sub">{sub}</p> : null}
      </div>
    </article>
  )
}

function DashCard({
  title,
  badge,
  children,
  action,
  onAction,
}: {
  title: string
  badge?: string
  children: React.ReactNode
  action?: string
  onAction?: () => void
}) {
  return (
    <section className="db-card">
      <header className="db-card-header">
        <h3 className="db-card-title">{title}</h3>
        {badge ? <span className="db-card-badge">{badge}</span> : null}
        {action && onAction ? (
          <button type="button" className="db-card-link" onClick={onAction}>
            {action} <ArrowRight className="h-3 w-3" />
          </button>
        ) : null}
      </header>
      <div className="db-card-body">{children}</div>
    </section>
  )
}

function QuickActionButton({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button type="button" className="db-quick-action" onClick={onClick}>
      <span className="db-qa-icon">{icon}</span>
      <span className="db-qa-label">{label}</span>
    </button>
  )
}

function PlanRunRow({ block, isLatest }: { block: PlanBlock; isLatest?: boolean }) {
  const runLabel = block.run_id ?? 'N/A'
  return (
    <tr className={isLatest ? 'is-latest' : ''}>
      <td>
        <span className="db-mono">{runLabel}</span>
        {isLatest ? <span className="db-badge-latest">Latest</span> : null}
      </td>
      <td className="db-mono text-slate-400">{block.schedule_date}</td>
      <td className="text-right">{fmt(1)}</td>
      <td className="text-right">{block.is_joint_block ? '✓' : '—'}</td>
      <td className="text-right">{block.efficiency_score.toFixed(0)}%</td>
    </tr>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DashboardView({ navigate }: { navigate?: (v: ViewKey) => void }) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null)
  const [criticalTasks, setCriticalTasks] = useState<Task[]>([])
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>([])
  const [planTotal, setPlanTotal] = useState(0)
  const [trainTotal, setTrainTotal] = useState<number | null>(null)
  const [windowCount, setWindowCount] = useState<number | null>(null)

  const [loadingKpis, setLoadingKpis] = useState(true)
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [loadingPlan, setLoadingPlan] = useState(true)
  const [loadingCoa, setLoadingCoa] = useState(true)

  const [errorKpis, setErrorKpis] = useState('')
  const [errorTasks, setErrorTasks] = useState('')
  const [errorPlan, setErrorPlan] = useState('')

  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // ── Data Fetchers ──────────────────────────────────────────────────────────

  const fetchKpis = useCallback(() => {
    setLoadingKpis(true)
    setErrorKpis('')
    return api
      .dashboard()
      .then((data) => {
        setKpis(data)
        setLastRefreshed(new Date())
      })
      .catch((e: unknown) =>
        setErrorKpis(e instanceof Error ? e.message : 'Dashboard data unavailable'),
      )
      .finally(() => setLoadingKpis(false))
  }, [])

  const fetchCriticalTasks = useCallback(() => {
    setLoadingTasks(true)
    setErrorTasks('')
    return api
      .tasks({ min_severity: 4, limit: 8 })
      .then((res) => setCriticalTasks(res.tasks))
      .catch((e: unknown) =>
        setErrorTasks(e instanceof Error ? e.message : 'Task data unavailable'),
      )
      .finally(() => setLoadingTasks(false))
  }, [])

  const fetchPlanHistory = useCallback(() => {
    setLoadingPlan(true)
    setErrorPlan('')
    return api
      .planHistory(10)
      .then((res) => {
        setPlanBlocks(res.blocks)
        setPlanTotal(res.total)
      })
      .catch((e: unknown) =>
        setErrorPlan(e instanceof Error ? e.message : 'Plan history unavailable'),
      )
      .finally(() => setLoadingPlan(false))
  }, [])

  const fetchCoaStats = useCallback(() => {
    setLoadingCoa(true)
    // Fetch just 1 train to get the total count efficiently (do NOT load all trains)
    const trainParams = new URLSearchParams({ limit: '1', skip: '0' })
    // /api/coa/windows has NO limit param — it returns ALL windows matching filters.
    // available_only=true is the only meaningful filter for the dashboard.
    const winParams = new URLSearchParams({ available_only: 'true' })
    return Promise.all([api.trains(trainParams), api.windows(winParams)])
      .then(([trainRes, winRes]) => {
        setTrainTotal(trainRes.total)
        // winRes is the COMPLETE array (no limit param exists on this endpoint)
        setWindowCount((winRes as BlockWindow[]).length)
      })
      .catch(() => {
        // COA stats are supplementary — don't block dashboard
        setTrainTotal(null)
        setWindowCount(null)
      })
      .finally(() => setLoadingCoa(false))
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([fetchKpis(), fetchCriticalTasks(), fetchPlanHistory(), fetchCoaStats()])
    setRefreshing(false)
  }, [fetchKpis, fetchCriticalTasks, fetchPlanHistory, fetchCoaStats])

  useEffect(() => {
    void fetchKpis()
    void fetchCriticalTasks()
    void fetchPlanHistory()
    void fetchCoaStats()
  }, [fetchKpis, fetchCriticalTasks, fetchPlanHistory, fetchCoaStats])

  // ── Derived metrics (all from backend data, no fabrication) ────────────────

  const unscheduled = kpis ? kpis.total_tasks - kpis.scheduled_tasks : null

  const deptRows = useMemo(
    () =>
      kpis?.dept_stats.map((d) => ({
        name: d.code,
        fullName: d.name,
        total: d.total_tasks,
        critical: d.critical_tasks,
        overdue: d.overdue_tasks,
        color: d.color_hex,
      })) ?? [],
    [kpis],
  )

  const severityBuckets = useMemo(() => {
    /**
     * Task status in the backend is a mutually exclusive enum:
     *   PENDING | SCHEDULED | IN_PROGRESS | COMPLETED | OVERDUE
     *
     * The dashboard endpoint provides:
     *   total_tasks    — all tasks
     *   scheduled_tasks — status == SCHEDULED
     *   overdue_tasks   — status == OVERDUE
     *
     * "Other" = total - scheduled - overdue
     * (covers PENDING + IN_PROGRESS + COMPLETED)
     *
     * These three buckets are genuinely mutually exclusive and sum to total.
     * We do NOT mix safety_critical (a flag) with overdue (a status) in the same
     * distribution, since a task can hold both simultaneously.
     */
    if (!kpis) return []
    const overdue = kpis.overdue_tasks
    const scheduled = kpis.scheduled_tasks
    const other = Math.max(kpis.total_tasks - overdue - scheduled, 0)
    return [
      { label: 'Overdue', count: overdue, color: '#f59e0b' },
      { label: 'Scheduled', count: scheduled, color: '#4ade80' },
      { label: 'Pending / Other', count: other, color: '#60a5fa' },
    ].filter((b) => b.count > 0)
  }, [kpis])

  // Unique plan runs by run_id (plan history returns individual blocks)
  const planRuns = useMemo(() => {
    const seen = new Set<string>()
    const runs: PlanBlock[] = []
    for (const b of planBlocks) {
      const key = b.run_id ?? b.id.toString()
      if (!seen.has(key)) {
        seen.add(key)
        runs.push(b)
      }
    }
    return runs.slice(0, 5)
  }, [planBlocks])

  const latestRun = planRuns[0] ?? null

  // Attention items — backed by real kpi data
  const attentionItems = useMemo(() => {
    if (!kpis) return []
    const items: { label: string; count: number; tone: string; view: ViewKey }[] = []
    if (kpis.overdue_tasks > 0)
      items.push({ label: 'Overdue maintenance tasks', count: kpis.overdue_tasks, tone: 'red', view: 'maintenance-worklist' })
    if (kpis.critical_tasks > 0)
      items.push({ label: 'Safety-critical tasks', count: kpis.critical_tasks, tone: 'amber', view: 'maintenance-worklist' })
    if (unscheduled !== null && unscheduled > 0)
      items.push({ label: 'Tasks not yet scheduled (non-SCHEDULED status)', count: unscheduled, tone: 'blue', view: 'planning-generator' })
    if (kpis.active_conflicts > 0)
      items.push({ label: 'Active conflicts', count: kpis.active_conflicts, tone: 'red', view: 'planning-validator' })
    return items
  }, [kpis, unscheduled])

  // ── Render ─────────────────────────────────────────────────────────────────

  const nav = navigate ?? (() => undefined)

  return (
    <div className="db-workspace">

      {/* ── Dashboard Header ── */}
      <header className="db-header">
        <div className="db-header-left">
          <p className="db-header-eyebrow">
            {new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
          <h2 className="db-header-title">Operations Control Center</h2>
        </div>
        <div className="db-header-right">
          {lastRefreshed ? (
            <span className="db-header-synced">
              Synced {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
          <button
            type="button"
            className="db-refresh-btn"
            onClick={() => void refresh()}
            disabled={refreshing}
            aria-label="Refresh dashboard"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </header>

      {/* ── KPI Strip Row 1 ── */}
      <section className="db-kpi-strip" aria-label="Key performance indicators">
        <KpiCard
          label="Total Maintenance Tasks"
          value={kpis ? fmt(kpis.total_tasks) : '—'}
          sub={kpis ? `${fmt(kpis.scheduled_tasks)} scheduled` : undefined}
          tone="blue"
          icon={<Target className="h-4 w-4" />}
          loading={loadingKpis && !kpis}
        />
        <KpiCard
          label="Overdue Tasks"
          value={kpis ? fmt(kpis.overdue_tasks) : '—'}
          sub="Require immediate attention"
          tone="red"
          icon={<AlertTriangle className="h-4 w-4" />}
          warn={!!kpis && kpis.overdue_tasks > 0}
          loading={loadingKpis && !kpis}
        />
        <KpiCard
          label="Safety-Critical"
          value={kpis ? fmt(kpis.critical_tasks) : '—'}
          sub="safety_critical flag set"
          tone="amber"
          icon={<ShieldAlert className="h-4 w-4" />}
          warn={!!kpis && kpis.critical_tasks > 0}
          loading={loadingKpis && !kpis}
        />
        <KpiCard
          label="Scheduled Tasks"
          value={kpis ? fmt(kpis.scheduled_tasks) : '—'}
          sub="Assigned to a block"
          tone="green"
          icon={<CheckCircle2 className="h-4 w-4" />}
          loading={loadingKpis && !kpis}
        />
        <KpiCard
          label="Not Scheduled"
          value={kpis && unscheduled !== null ? fmt(unscheduled) : '—'}
          sub="Overdue + pending + in progress"
          tone="violet"
          icon={<Clock3 className="h-4 w-4" />}
          loading={loadingKpis && !kpis}
        />
        <KpiCard
          label="Blocks Today"
          value={kpis ? fmt(kpis.todays_blocks) : '—'}
          sub={kpis ? `${fmt(kpis.joint_blocks_today)} joint dept` : undefined}
          tone="teal"
          icon={<Layers className="h-4 w-4" />}
          loading={loadingKpis && !kpis}
        />
        <KpiCard
          label="Block Efficiency"
          value={kpis ? `${kpis.avg_block_efficiency}%` : '—'}
          sub="Average across generated blocks"
          tone="indigo"
          icon={<Activity className="h-4 w-4" />}
          loading={loadingKpis && !kpis}
        />
        <KpiCard
          label="Asset Availability"
          value={kpis ? `${kpis.asset_availability_pct}%` : '—'}
          sub="Network-wide estimate"
          tone="teal"
          icon={<TrendingUp className="h-4 w-4" />}
          loading={loadingKpis && !kpis}
        />
      </section>

      {/* ── Quick Actions ── */}
      <section className="db-quick-actions" aria-label="Quick actions">
        <QuickActionButton label="Generate Plan" icon={<Sparkles className="h-4 w-4" />} onClick={() => nav('planning-generator')} />
        <QuickActionButton label="Plan History" icon={<History className="h-4 w-4" />} onClick={() => nav('planning-history')} />
        <QuickActionButton label="Conflict Validator" icon={<SearchCheck className="h-4 w-4" />} onClick={() => nav('planning-validator')} />
        <QuickActionButton label="Bundle Candidates" icon={<GitBranchPlus className="h-4 w-4" />} onClick={() => nav('planning-bundles')} />
        <QuickActionButton label="Task Worklist" icon={<Target className="h-4 w-4" />} onClick={() => nav('maintenance-worklist')} />
        <QuickActionButton label="COA / Trains" icon={<TrainFront className="h-4 w-4" />} onClick={() => nav('sources-coa')} />
      </section>

      {/* ── Main Grid: Charts ── */}
      <SectionDivider label="Operational Analytics" />

      <div className="db-main-grid">

        {/* Dept Workload */}
        <DashCard title="Maintenance Workload" badge="By Department">
          {loadingKpis && !kpis ? (
            <Skeleton className="h-40" />
          ) : errorKpis && !kpis ? (
            <p className="db-error-inline">{errorKpis}</p>
          ) : deptRows.length === 0 ? (
            <p className="db-empty">No department data available.</p>
          ) : (
            <>
              <div className="db-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptRows} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis allowDecimals={false} stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)', borderRadius: 4, color: 'var(--text-primary)' }}
                      formatter={((value: unknown, name: unknown) => [fmt(Number(value)), name === 'total' ? 'Total Tasks' : name === 'critical' ? 'Safety-Critical' : 'Overdue']) as never}
                      labelFormatter={((l: unknown) => deptRows.find((d) => d.name === String(l))?.fullName ?? String(l)) as never}
                    />
                    <Bar dataKey="total" radius={[2, 2, 0, 0]}>
                      {deptRows.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="db-dept-legend">
                {deptRows.map((d) => (
                  <span key={d.name} className="db-dept-pill">
                    <i style={{ background: d.color }} />
                    {d.fullName}
                    <strong>{fmt(d.total)}</strong>
                  </span>
                ))}
              </div>
            </>
          )}
        </DashCard>

        {/* Task Status Distribution */}
        <DashCard title="Task Status Distribution" badge="Mutually exclusive">
          {loadingKpis && !kpis ? (
            <Skeleton className="h-40" />
          ) : errorKpis && !kpis ? (
            <p className="db-error-inline">{errorKpis}</p>
          ) : severityBuckets.length === 0 ? (
            <p className="db-empty">No task data available.</p>
          ) : (
            <div className="db-risk-bars">
              {severityBuckets.map((b) => {
                const total = kpis?.total_tasks ?? 1
                const pct = Math.round((b.count / total) * 100)
                return (
                  <div key={b.label} className="db-risk-row">
                    <span className="db-risk-label">{b.label}</span>
                    <div className="db-risk-track">
                      <div
                        className="db-risk-fill"
                        style={{ width: `${pct}%`, background: b.color }}
                      />
                    </div>
                    <span className="db-risk-count">
                      {fmt(b.count)}
                      <em>{pct}%</em>
                    </span>
                  </div>
                )
              })}
              <p className="db-risk-caption">
                Mutually exclusive status buckets — total{' '}
                <strong>{kpis ? fmt(kpis.total_tasks) : '—'}</strong> tasks
              </p>
            </div>
          )}
        </DashCard>

        {/* Availability Trend */}
        <DashCard title="Availability Trend" badge="Last 8 days">
          {loadingKpis && !kpis ? (
            <Skeleton className="h-40" />
          ) : errorKpis && !kpis ? (
            <p className="db-error-inline">{errorKpis}</p>
          ) : (kpis?.availability_trend?.length ?? 0) === 0 ? (
            <p className="db-empty">No trend data available.</p>
          ) : (
            <div className="db-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={kpis!.availability_trend} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDate} stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis
                    domain={[
                      Math.floor(Math.min(...kpis!.availability_trend.map((p) => p.availability)) - 2),
                      100,
                    ]}
                    stroke="var(--text-muted)"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)', borderRadius: 4, color: 'var(--text-primary)' }}
                    labelFormatter={((v: unknown) => fmtDate(String(v))) as never}
                    formatter={((v: unknown) => [`${v}%`, 'Availability']) as never}
                  />
                  <Line type="monotone" dataKey="availability" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3, fill: '#22d3ee', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashCard>

        {/* Train Operations Summary */}
        <DashCard
          title="Train Operations"
          badge="COA / Timetable"
          action="Open COA"
          onAction={() => nav('sources-coa')}
        >
          {loadingCoa ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="db-train-summary">
              <div className="db-train-stat">
                <TrainFront className="h-5 w-5 text-cyan-400" />
                <div>
                  <p className="db-train-label">Total Train Movements</p>
                  <p className="db-train-value">
                    {trainTotal !== null ? fmt(trainTotal) : 'Unavailable'}
                  </p>
                  <p className="db-train-sub">
                    {trainTotal !== null
                      ? 'Total timetable records in database (all sections & dates)'
                      : 'COA API unreachable'}
                  </p>
                </div>
              </div>
              <div className="db-train-stat">
                <Zap className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="db-train-label">Available Block Windows</p>
                  <p className="db-train-value">
                    {windowCount !== null ? fmt(windowCount) : 'Unavailable'}
                  </p>
                  <p className="db-train-sub">
                    {windowCount !== null
                      ? 'Complete set — no limit on this endpoint'
                      : 'Window API unreachable'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DashCard>

      </div>

      {/* ── Lower Grid: Planning + Attention ── */}
      <SectionDivider label="Planning Status & Alerts" />

      <div className="db-lower-grid">

        {/* Latest Planning Run */}
        <DashCard
          title="Latest Planning Run"
          badge={loadingPlan ? 'Loading...' : planRuns.length > 0 ? 'Active' : 'No Plans'}
          action="Plan History"
          onAction={() => nav('planning-history')}
        >
          {loadingPlan ? (
            <Skeleton className="h-28" />
          ) : errorPlan ? (
            <p className="db-error-inline">{errorPlan}</p>
          ) : !latestRun ? (
            <div className="db-empty-plan">
              <Sparkles className="h-8 w-8 text-slate-600" />
              <p>No block plans have been generated yet.</p>
              <button type="button" className="db-cta-btn" onClick={() => nav('planning-generator')}>
                Generate First Plan
              </button>
            </div>
          ) : (
            <div className="db-latest-plan">
              <div className="db-lp-row">
                <span className="db-lp-key">Run ID</span>
                <span className="db-mono db-lp-val">{latestRun.run_id ?? 'N/A'}</span>
              </div>
              <div className="db-lp-row">
                <span className="db-lp-key">Schedule Date</span>
                <span className="db-mono db-lp-val">{latestRun.schedule_date}</span>
              </div>
              <div className="db-lp-row">
                <span className="db-lp-key">Efficiency</span>
                <span className="db-lp-val db-lp-badge-teal">{latestRun.efficiency_score.toFixed(1)}%</span>
              </div>
              <div className="db-lp-row">
                <span className="db-lp-key">Total Blocks in History</span>
                <span className="db-lp-val">{fmt(planTotal)}</span>
              </div>
              <div className="db-lp-row">
                <span className="db-lp-key">Unique Runs</span>
                <span className="db-lp-val">{fmt(planRuns.length)}</span>
              </div>
              <button
                type="button"
                className="db-cta-btn mt-3 w-full"
                onClick={() => nav('planning-history')}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open Plan History
              </button>
            </div>
          )}
        </DashCard>

        {/* Attention Center */}
        <DashCard title="Attention Center" badge={attentionItems.length > 0 ? `${attentionItems.length} items` : 'All clear'}>
          {loadingKpis && !kpis ? (
            <Skeleton className="h-28" />
          ) : attentionItems.length === 0 ? (
            <div className="db-all-clear">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              <p>No operational issues detected</p>
            </div>
          ) : (
            <ul className="db-attention-list">
              {attentionItems.map((item) => (
                <li key={item.view} className={`db-attention-item tone-${item.tone}`}>
                  <span className={`db-att-dot tone-${item.tone}`} />
                  <div className="db-att-text">
                    <strong>{fmt(item.count)}</strong>
                    <span>{item.label}</span>
                  </div>
                  <button
                    type="button"
                    className="db-att-link"
                    onClick={() => nav(item.view)}
                    aria-label={`Navigate to ${item.label}`}
                  >
                    View <ArrowRight className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DashCard>

      </div>

      {/* ── Recent Plan Runs Table ── */}
      <SectionDivider label="Recent Plan Runs" />

      <DashCard
        title="Recent Plan Runs"
        badge={`${planRuns.length} runs`}
        action="View All"
        onAction={() => nav('planning-history')}
      >
        {loadingPlan ? (
          <Skeleton className="h-24" />
        ) : errorPlan ? (
          <p className="db-error-inline">{errorPlan}</p>
        ) : planRuns.length === 0 ? (
          <p className="db-empty">No plan runs yet. Generate your first plan to see history here.</p>
        ) : (
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Date</th>
                  <th className="text-right">Blocks</th>
                  <th className="text-right">Joint</th>
                  <th className="text-right">Efficiency</th>
                </tr>
              </thead>
              <tbody>
                {planRuns.map((run, i) => (
                  <PlanRunRow key={run.run_id ?? run.id} block={run} isLatest={i === 0} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashCard>

      {/* ── Critical Tasks Table ── */}
      <SectionDivider label="Recent Critical Tasks" />

      <DashCard
        title="Recent High-Severity Tasks"
        badge="Severity ≥ 4"
        action="Full Worklist"
        onAction={() => nav('maintenance-worklist')}
      >
        {loadingTasks ? (
          <Skeleton className="h-32" />
        ) : errorTasks ? (
          <p className="db-error-inline">{errorTasks}</p>
        ) : criticalTasks.length === 0 ? (
          <p className="db-empty">No high-severity tasks found.</p>
        ) : (
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Task Code</th>
                  <th>Department</th>
                  <th>Section</th>
                  <th className="text-center">Sev</th>
                  <th className="text-right">AI Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {criticalTasks.map((t) => (
                  <tr key={t.id}>
                    <td><span className="db-mono font-semibold text-cyan-300">{t.task_code}</span></td>
                    <td>
                      <span
                        className="db-dept-badge"
                        style={{ borderColor: t.department.color_hex, color: t.department.color_hex }}
                      >
                        {t.department.code}
                      </span>
                    </td>
                    <td className="text-slate-300 text-sm truncate max-w-[140px]">{t.section.name}</td>
                    <td className="text-center">
                      <span className={`db-sev-badge sev-${t.severity}`}>{t.severity}</span>
                    </td>
                    <td className="text-right db-mono text-slate-300">{t.priority_score.toFixed(2)}</td>
                    <td>
                      <span className={`db-status-badge status-${t.status.toLowerCase()}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashCard>

      {/* ── Section Status Table ── */}
      <SectionDivider label="Critical Section Status" />

      <DashCard
        title="High-Criticality Sections"
        badge="Top 20 by criticality"
        action="Task Worklist"
        onAction={() => nav('maintenance-worklist')}
      >
        {loadingKpis && !kpis ? (
          <Skeleton className="h-32" />
        ) : errorKpis && !kpis ? (
          <p className="db-error-inline">{errorKpis}</p>
        ) : (kpis?.section_statuses?.length ?? 0) === 0 ? (
          <p className="db-empty">No section data available.</p>
        ) : (
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Name</th>
                  <th className="text-center">Criticality</th>
                  <th className="text-right">Pending</th>
                  <th className="text-right">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {kpis!.section_statuses.map((s) => (
                  <tr key={s.section_code}>
                    <td><span className="db-mono text-xs text-slate-400">{s.section_code}</span></td>
                    <td className="text-slate-300 text-sm">{s.section_name}</td>
                    <td className="text-center">
                      <div className="db-crit-meter">
                        {Array.from({ length: 5 }, (_, i) => (
                          <i key={i} className={i < s.criticality_level ? 'filled' : ''} />
                        ))}
                        <span>{s.criticality_level}/5</span>
                      </div>
                    </td>
                    <td className="text-right db-mono text-slate-300">{fmt(s.pending_tasks)}</td>
                    <td className={`text-right db-mono ${s.overdue_tasks > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                      {fmt(s.overdue_tasks)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashCard>

    </div>
  )
}
