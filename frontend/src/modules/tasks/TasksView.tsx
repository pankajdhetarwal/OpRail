import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowDown, ArrowUp, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Database, Info, Loader2, RefreshCw, ShieldAlert, Sparkles, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '../../core/api/client'
import type { Task } from '../../types/api'
import { EmptyState, OperationalStatus, Panel } from '../../components/common'
import { deptAccent, statusClass } from '../../utils/format'

const pageSize = 50
const initialFilters = { dept_code: '', status: '', min_severity: 1, critical_only: false }
type StatusName = 'HEALTHY' | 'AVAILABLE' | 'WARNING' | 'CRITICAL' | 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'BLOCKED'

const severityLabel = (severity: number) => severity >= 5 ? 'Critical' : severity >= 4 ? 'High' : severity >= 3 ? 'Medium' : 'Low'
const severityStatus = (severity: number): StatusName => severity >= 5 ? 'CRITICAL' : severity >= 4 ? 'WARNING' : severity >= 3 ? 'PENDING' : 'AVAILABLE'
const statusLabel = (status: string): StatusName => status.toUpperCase().includes('OVERDUE') ? 'CRITICAL' : status.toUpperCase().includes('SCHEDULED') ? 'COMPLETED' : status.toUpperCase().includes('PENDING') ? 'PENDING' : 'ACTIVE'
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
const formatDateTime = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

function TaskListSkeleton() {
  return <div className="task-skeleton" role="status" aria-label="Loading maintenance tasks">{Array.from({ length: 7 }, (_, index) => <div className="task-skeleton-row" key={index}><span /><span /><span /><span /><span /></div>)}<span className="sr-only">Loading maintenance tasks</span></div>
}

function PriorityBar({ score }: { score: number }) {
  const width = Math.max(2, Math.min(100, score))
  return <div className="task-priority"><div className="task-priority-track"><span style={{ width: `${width}%` }} /></div><b>{score.toFixed(1)}</b></div>
}

function FilterBar({ filters, onChange, onClear, onRefresh, loading }: { filters: typeof initialFilters; onChange: (next: typeof initialFilters) => void; onClear: () => void; onRefresh: () => void; loading: boolean }) {
  const hasFilters = filters.dept_code !== '' || filters.status !== '' || filters.min_severity !== 1 || filters.critical_only
  return <div className="task-filter-bar">
    <div className="task-filter-heading"><span className="shell-eyebrow">Worklist filters</span><span className="task-filter-note">Applied server-side</span></div>
    <div className="task-filter-controls">
      <label className="task-filter-field"><span>Department</span><select value={filters.dept_code} onChange={(event) => onChange({ ...filters, dept_code: event.target.value })}><option value="">All departments</option><option value="ENG">Engineering</option><option value="ST">Signal &amp; Telecom</option><option value="OHE">Traction / OHE</option></select></label>
      <label className="task-filter-field"><span>Status</span><select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="OVERDUE">Overdue</option><option value="SCHEDULED">Scheduled</option></select></label>
      <label className="task-filter-field"><span>Minimum severity</span><select value={filters.min_severity} onChange={(event) => onChange({ ...filters, min_severity: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>{level} / 5 and above</option>)}</select></label>
      <label className="task-critical-toggle"><input type="checkbox" checked={filters.critical_only} onChange={(event) => onChange({ ...filters, critical_only: event.target.checked })} /><span>Safety-critical only</span></label>
      {hasFilters ? <button className="task-text-button" type="button" onClick={onClear}>Clear filters</button> : null}
      <button className="dashboard-action-button task-refresh-button" type="button" onClick={onRefresh} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
    </div>
  </div>
}

function TaskDetail({ task, detailLoading, detailError, explain, explainLoading, explainError, onRetryDetail, onRetryExplain, onClose }: { task: Task; detailLoading: boolean; detailError: string; explain: Record<string, number>; explainLoading: boolean; explainError: string; onRetryDetail: () => void; onRetryExplain: () => void; onClose: () => void }) {
  const shapPairs = Object.entries(explain).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const positive = shapPairs.filter(([, value]) => value >= 0)
  const negative = shapPairs.filter(([, value]) => value < 0)
  return <motion.aside className="task-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: .2 }} role="dialog" aria-modal="true" aria-labelledby="task-detail-title">
    <header className="task-drawer-header"><div><p className="shell-eyebrow">Maintenance task / {task.id}</p><h2 id="task-detail-title">{task.task_code}</h2><p>{task.department.name} · {task.section.name}</p></div><button className="shell-icon-button" type="button" onClick={onClose} aria-label="Close task detail"><X className="h-4 w-4" /></button></header>
    <div className="task-drawer-body">
      {detailLoading ? <div className="task-detail-loading"><Loader2 className="h-5 w-5 animate-spin" /> Loading task detail</div> : null}
      {detailError ? <div className="task-detail-error"><AlertTriangle className="h-4 w-4" /><span>{detailError}</span><button type="button" onClick={onRetryDetail}>Retry</button></div> : null}
      {!detailLoading && !detailError ? <>
        <section className="task-detail-hero"><div><span className="task-type-label">{task.task_type.replaceAll('_', ' ')}</span><p className="task-detail-description">{task.description || 'No task description provided.'}</p></div><OperationalStatus status={statusLabel(task.status)} /></section>
        <section className="task-detail-score"><div><span className="shell-eyebrow">Priority score</span><strong>{task.priority_score.toFixed(2)}</strong><p>Backend-calculated task priority</p></div><PriorityBar score={task.priority_score} /></section>
        <section className="task-detail-section"><h3>Task identity</h3><div className="task-detail-grid"><DetailItem icon={Database} label="Task ID" value={String(task.id)} /><DetailItem icon={Info} label="Department" value={`${task.department.code} · ${task.department.name}`} /><DetailItem icon={Info} label="Section" value={`${task.section.code} · ${task.section.name}`} /><DetailItem icon={ShieldAlert} label="Severity" value={`${severityLabel(task.severity)} (${task.severity}/5)`} /></div></section>
        <section className="task-detail-section"><h3>Timing and requirements</h3><div className="task-detail-grid"><DetailItem icon={CalendarDays} label="Due date" value={formatDate(task.due_date)} /><DetailItem icon={Clock3} label="Duration" value={`${task.duration_minutes} minutes`} /><DetailItem icon={AlertTriangle} label="Overdue" value={`${task.days_overdue} day${task.days_overdue === 1 ? '' : 's'}`} /><DetailItem icon={Sparkles} label="Created" value={formatDateTime(task.created_at)} /></div><div className="task-requirements"><span className={task.safety_critical ? 'is-on' : ''}>{task.safety_critical ? <Check /> : <X />} Safety-critical</span><span className={task.requires_line_block ? 'is-on' : ''}>{task.requires_line_block ? <Check /> : <X />} Line block required</span><span className={task.requires_ohe_disconnection ? 'is-on' : ''}>{task.requires_ohe_disconnection ? <Check /> : <X />} OHE disconnection</span></div></section>
        <section className="task-detail-section task-intelligence"><div className="task-section-heading"><div><p className="shell-eyebrow">Priority intelligence</p><h3>Why this task has this priority</h3></div><Sparkles className="h-5 w-5" aria-hidden="true" /></div>
          {explainLoading ? <div className="explanation-loading"><Loader2 className="h-4 w-4 animate-spin" /> Loading contribution factors</div> : null}
          {explainError ? <div className="task-detail-error"><AlertTriangle className="h-4 w-4" /><span>{explainError}</span><button type="button" onClick={onRetryExplain}>Retry</button></div> : null}
          {!explainLoading && !explainError && shapPairs.length === 0 ? <EmptyState label="No explanation factors were returned for this task." /> : null}
          {!explainLoading && !explainError && shapPairs.length > 0 ? <div className="shap-groups"><ShapGroup title="Factors increasing priority" pairs={positive} positive /><ShapGroup title="Factors reducing priority" pairs={negative} positive={false} /></div> : null}
        </section>
      </> : null}
    </div>
  </motion.aside>
}

function DetailItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) { return <div className="task-detail-item"><Icon className="h-3.5 w-3.5" aria-hidden="true" /><div><span>{label}</span><strong>{value}</strong></div></div> }
function ShapGroup({ title, pairs, positive }: { title: string; pairs: [string, number][]; positive: boolean }) { return pairs.length ? <div className="shap-group"><h4><span className={`shap-direction ${positive ? 'is-positive' : 'is-negative'}`}>{positive ? <ArrowUp /> : <ArrowDown />}</span>{title}</h4>{pairs.map(([factor, value]) => <div className="shap-row" key={factor}><div className="shap-row-label"><span>{factor.replaceAll('_', ' ')}</span><b>{value >= 0 ? '+' : ''}{value.toFixed(3)}</b></div><div className="shap-track"><span className={positive ? 'is-positive' : 'is-negative'} style={{ width: `${Math.max(3, Math.min(100, Math.abs(value) * 100))}%` }} /></div></div>)}</div> : null }

export function TasksView() {
  const [filters, setFilters] = useState(initialFilters)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Task | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [explain, setExplain] = useState<Record<string, number>>({})
  const [explainLoading, setExplainLoading] = useState(false)
  const [explainError, setExplainError] = useState('')
  const [rescoring, setRescoring] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [confirmRescore, setConfirmRescore] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    return api.tasks({ ...filters, skip: page * pageSize, limit: pageSize })
      .then((result) => { setTasks(result.tasks); setTotal(result.total) })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load maintenance tasks.'))
      .finally(() => setLoading(false))
  }, [filters, page])

  useEffect(() => { void load() }, [load])

  const selectTask = useCallback((task: Task) => {
    setSelected(task)
    setDetailLoading(true)
    setDetailError('')
    setExplain({})
    setExplainLoading(true)
    setExplainError('')
    Promise.allSettled([api.taskDetail(task.id), api.taskExplain(task.id)]).then(([detailResult, explainResult]) => {
      if (detailResult.status === 'fulfilled') setSelected(detailResult.value)
      else setDetailError(detailResult.reason instanceof Error ? detailResult.reason.message : 'Unable to load task detail.')
      if (explainResult.status === 'fulfilled') setExplain(explainResult.value.shap_explanation || {})
      else setExplainError(explainResult.reason instanceof Error ? explainResult.reason.message : 'Unable to load priority explanation.')
    }).finally(() => { setDetailLoading(false); setExplainLoading(false) })
  }, [])

  const retryDetail = () => { if (selected) { setDetailLoading(true); setDetailError(''); api.taskDetail(selected.id).then(setSelected).catch((reason: unknown) => setDetailError(reason instanceof Error ? reason.message : 'Unable to load task detail.')).finally(() => setDetailLoading(false)) } }
  const retryExplain = () => { if (selected) { setExplainLoading(true); setExplainError(''); api.taskExplain(selected.id).then((result) => setExplain(result.shap_explanation || {})).catch((reason: unknown) => setExplainError(reason instanceof Error ? reason.message : 'Unable to load priority explanation.')).finally(() => setExplainLoading(false)) } }
  const changeFilters = (next: typeof initialFilters) => { setPage(0); setFilters(next) }
  const clearFilters = () => changeFilters(initialFilters)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : page * pageSize + 1
  const rangeEnd = Math.min((page + 1) * pageSize, total)
  const severityCounts = useMemo(() => tasks.reduce((counts, task) => { counts[severityLabel(task.severity)] = (counts[severityLabel(task.severity)] || 0) + 1; return counts }, {} as Record<string, number>), [tasks])

  const rescore = async () => { setConfirmRescore(false); setRescoring(true); setFeedback(null); try { const result = await api.scoreAllTasks(); setFeedback({ type: 'success', message: `${result.updated} tasks re-scored successfully.` }); await load() } catch (reason: unknown) { setFeedback({ type: 'error', message: reason instanceof Error ? reason.message : 'Unable to re-score tasks.' }) } finally { setRescoring(false) } }

  return <div className="maintenance-page">
    <header className="maintenance-header"><div><p className="shell-eyebrow">Maintenance / Priority intelligence</p><h2 className="maintenance-title">Maintenance Intelligence</h2><p className="maintenance-subtitle">Unified maintenance worklist and priority intelligence</p></div><div className="maintenance-header-actions"><div className="maintenance-summary"><span>{formatNumber(total)} tasks</span><span>{severityCounts.Critical || 0} critical on page</span></div><button className="dashboard-action-button rescore-button" type="button" onClick={() => setConfirmRescore(true)} disabled={rescoring}><Sparkles className="h-3.5 w-3.5" />{rescoring ? 'Re-scoring...' : 'Re-score all tasks'}</button></div></header>
    <FilterBar filters={filters} onChange={changeFilters} onClear={clearFilters} onRefresh={() => void load()} loading={loading} />
    {feedback ? <div className={`task-feedback ${feedback.type === 'success' ? 'is-success' : 'is-error'}`} role="status">{feedback.type === 'success' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}<span>{feedback.message}</span><button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss feedback"><X className="h-3.5 w-3.5" /></button></div> : null}
    <Panel title="Unified task worklist" actions={<span className="panel-meta">Select a row to inspect task intelligence</span>}>
      {loading ? <TaskListSkeleton /> : error ? <div className="task-list-error"><AlertTriangle className="h-5 w-5" /><div><strong>Task worklist unavailable</strong><p>{error}</p></div><button className="dashboard-action-button" type="button" onClick={() => void load()}>Retry</button></div> : tasks.length === 0 ? <div className="task-empty"><EmptyState label="No maintenance tasks match the current filters." /><button className="task-text-button" type="button" onClick={clearFilters}>Clear filters</button></div> : <>
        <div className="task-table-wrap"><table className="task-table"><caption className="sr-only">Maintenance task worklist</caption><thead><tr><th>Task</th><th>Department</th><th>Section</th><th>Priority</th><th>Severity</th><th>Status</th><th>Due / overdue</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} tabIndex={0} onClick={() => selectTask(task)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectTask(task) } }}><td><strong className="task-code">{task.task_code}</strong><span className="task-type">{task.task_type.replaceAll('_', ' ')}</span></td><td><span className={`task-dept ${deptAccent[task.department.code] || ''}`}><i style={{ background: task.department.color_hex }} />{task.department.code}</span></td><td><strong>{task.section.code}</strong><span>{task.section.name}</span></td><td><PriorityBar score={task.priority_score} /></td><td><OperationalStatus status={severityStatus(task.severity)} /><span className="severity-caption">{severityLabel(task.severity)} · {task.severity}/5</span></td><td><span className={`task-status ${statusClass(task.status)}`}>{task.status}</span></td><td><span className="task-due">{formatDate(task.due_date)}</span>{task.days_overdue > 0 ? <span className="overdue-label">{task.days_overdue}d overdue</span> : null}</td></tr>)}</tbody></table></div>
        <footer className="task-pagination"><span>Showing {rangeStart}-{rangeEnd} of {total}</span><span>Page {page + 1} of {pageCount}</span><div><button className="task-page-button" type="button" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button><button className="task-page-button" type="button" disabled={page + 1 >= pageCount || loading} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button></div></footer>
      </>}
    </Panel>
    <AnimatePresence>{selected ? <><motion.button className="task-drawer-backdrop" type="button" aria-label="Close task detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} /><TaskDetail task={selected} detailLoading={detailLoading} detailError={detailError} explain={explain} explainLoading={explainLoading} explainError={explainError} onRetryDetail={retryDetail} onRetryExplain={retryExplain} onClose={() => setSelected(null)} /></> : null}</AnimatePresence>
    <AnimatePresence>{confirmRescore ? <motion.div className="confirm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-rescore-title" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}><div className="confirm-icon"><Sparkles className="h-5 w-5" /></div><h2 id="confirm-rescore-title">Re-score all maintenance tasks?</h2><p>This will recompute task priorities using the configured priority model.</p><div className="confirm-actions"><button className="task-text-button" type="button" onClick={() => setConfirmRescore(false)}>Cancel</button><button className="dashboard-action-button rescore-button" type="button" onClick={() => void rescore()}>Re-score tasks</button></div></motion.section></motion.div> : null}</AnimatePresence>
  </div>
}

function formatNumber(value: number) { return new Intl.NumberFormat().format(value) }
