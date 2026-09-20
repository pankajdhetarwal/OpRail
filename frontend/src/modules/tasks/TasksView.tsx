import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from '../../core/api/client'
import type { Task } from '../../types/api'
import { Badge, EmptyState, ErrorState, LoadingState, Panel } from '../../components/common'
import { deptAccent, severityColor, statusClass } from '../../utils/format'

const pageSize = 50

export function TasksView() {
  const [filters, setFilters] = useState({ dept_code: '', status: '', min_severity: 1, critical_only: false })
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Task | null>(null)
  const [explain, setExplain] = useState<Record<string, number>>({})
  const [rescoring, setRescoring] = useState(false)
  const [feedback, setFeedback] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    api
      .tasks({ ...filters, skip: page * pageSize, limit: pageSize })
      .then((res) => {
        setTasks(res.tasks)
        setTotal(res.total)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [page, filters])

  const explainTask = async (task: Task) => {
    setSelected(task)
    const [detail, explainData] = await Promise.all([api.taskDetail(task.id), api.taskExplain(task.id)])
    setSelected(detail)
    setExplain((explainData.shap_explanation || {}) as Record<string, number>)
  }

  const shapPairs = useMemo(() => Object.entries(explain).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])), [explain])

  return (
    <div className="space-y-4">
      <Panel
        title="Unified Task Worklist"
        actions={
          <button
            className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200 disabled:opacity-50"
            disabled={rescoring}
            onClick={async () => {
              const ok = window.confirm('Recompute all maintenance priority scores using XGBoost V2?')
              if (!ok) return
              setRescoring(true)
              setFeedback('Re-scoring in progress...')
              try {
                const res = await api.scoreAllTasks()
                setFeedback(`${res.updated} tasks re-scored successfully.`)
                load()
              } catch (e) {
                setFeedback((e as Error).message)
              } finally {
                setRescoring(false)
              }
            }}
          >
            {rescoring ? 'Re-scoring…' : 'Re-score All Tasks'}
          </button>
        }
      >
        <div className="mb-3 grid gap-2 md:grid-cols-4">
          <select className="input" value={filters.dept_code} onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, dept_code: e.target.value })) }}>
            <option value="">All Departments</option>
            <option value="ENG">Engineering</option>
            <option value="ST">Signal & Telecommunication</option>
            <option value="OHE">Traction/OHE</option>
          </select>
          <select className="input" value={filters.status} onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, status: e.target.value })) }}>
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="OVERDUE">Overdue</option>
            <option value="SCHEDULED">Scheduled</option>
          </select>
          <select className="input" value={filters.min_severity} onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, min_severity: Number(e.target.value) })) }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>Min Severity {n}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded border border-slate-700 px-3 text-sm text-slate-300">
            <input type="checkbox" checked={filters.critical_only} onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, critical_only: e.target.checked })) }} /> Critical only
          </label>
        </div>

        {feedback && <div className="mb-3 rounded border border-slate-700 bg-slate-900 p-2 text-xs text-slate-300">{feedback}</div>}
        {loading ? <LoadingState label="Loading tasks" /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error && tasks.length === 0 ? <EmptyState label="No maintenance tasks for current filters." /> : null}

        {!loading && !error && tasks.length > 0 ? (
          <>
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-400">
                  <tr>
                    <th className="py-2">Task</th><th>Department</th><th>Section</th><th>Severity</th><th>Priority</th><th>Status</th><th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} className="cursor-pointer border-t border-slate-800 hover:bg-slate-900/70" onClick={() => void explainTask(t)}>
                      <td className="py-2 font-mono text-slate-200">{t.task_code}</td>
                      <td><Badge className={deptAccent[t.department.code] || 'border-slate-600'}>{t.department.code}</Badge></td>
                      <td className="text-slate-300">{t.section.name}</td>
                      <td><span className={`inline-block h-2 w-2 rounded-full ${severityColor(t.severity)}`} /> {t.severity}/5</td>
                      <td><div className="h-2 w-24 rounded bg-slate-800"><div className="h-full rounded bg-cyan-400" style={{ width: `${Math.min(100, t.priority_score)}%` }} /></div><span className="ml-2 font-mono text-xs">{t.priority_score.toFixed(1)}</span></td>
                      <td><Badge className={statusClass(t.status)}>{t.status}</Badge></td>
                      <td className="font-mono text-xs text-slate-400">{t.due_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>{total} total · showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)}</span>
              <div className="space-x-2">
                <button className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <button className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          </>
        ) : null}
      </Panel>

      <AnimatePresence>
        {selected ? (
          <motion.aside initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }} className="fixed right-0 top-0 z-40 h-screen w-full max-w-xl border-l border-slate-700 bg-slate-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-mono text-lg text-slate-100">{selected.task_code}</h3>
                <p className="text-sm text-slate-400">{selected.department.name} · {selected.section.name}</p>
              </div>
              <button className="rounded border border-slate-700 px-2 py-1 text-xs" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
              <div>Severity: {selected.severity}/5</div>
              <div>Priority: {selected.priority_score.toFixed(2)}</div>
              <div>Status: {selected.status}</div>
              <div>Duration: {selected.duration_minutes} min</div>
              <div>Overdue: {selected.days_overdue} days</div>
              <div>Due: {selected.due_date}</div>
            </div>
            <p className="mt-4 text-sm text-slate-300">{selected.description || 'No description available.'}</p>
            <h4 className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Task Explainability (SHAP)</h4>
            <div className="mt-2 space-y-2">
              {shapPairs.length === 0 ? <EmptyState label="No SHAP data available." /> : shapPairs.map(([k, v]) => {
                const width = Math.min(100, Math.abs(v) * 100)
                return (
                  <div key={k}>
                    <div className="mb-1 flex justify-between text-xs text-slate-300"><span>{k}</span><span className="font-mono">{v.toFixed(3)}</span></div>
                    <div className="h-2 rounded bg-slate-800"><div className={`h-full rounded ${v >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`} style={{ width: `${width}%` }} /></div>
                  </div>
                )
              })}
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
