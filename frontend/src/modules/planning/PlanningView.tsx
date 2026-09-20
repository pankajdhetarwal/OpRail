import { useEffect, useMemo, useState } from 'react'
import { api } from '../../core/api/client'
import type { BundleCandidate, PlanBlock, PlanGenerateResponse, PlanHistoryResponse, Task } from '../../types/api'
import { Badge, EmptyState, ErrorState, LoadingState, Panel } from '../../components/common'
import { deptAccent, toMinutes } from '../../utils/format'

const horizons = [
  { label: 'Daily', value: 'day' },
  { label: 'Weekly', value: 'week' },
  { label: 'Fortnight', value: 'fortnight' },
]

export function PlanningView() {
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10))
  const [horizon, setHorizon] = useState('week')
  const [density, setDensity] = useState(1)
  const [depts, setDepts] = useState<string[]>(['ENG', 'ST', 'OHE'])
  const [sectionIds, setSectionIds] = useState<number[]>([])
  const [sections, setSections] = useState<{ id: number; name: string; code: string }[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<PlanGenerateResponse | null>(null)

  const [history, setHistory] = useState<PlanHistoryResponse | null>(null)
  const [historyError, setHistoryError] = useState('')

  const [validator, setValidator] = useState({ section_id: '', date: startDate, start_time: '02:00', end_time: '04:00' })
  const [validationResult, setValidationResult] = useState<string>('')

  const [bundleMethod, setBundleMethod] = useState<'pairwise' | 'dbscan'>('pairwise')
  const [bundleRows, setBundleRows] = useState<{ task_id: string; section: string; start_minute: string; end_minute: string }[]>([])
  const [bundles, setBundles] = useState<BundleCandidate[]>([])

  useEffect(() => {
    api.tasks({ min_severity: 1, limit: 500, skip: 0 })
      .then((res) => {
        const unique = new Map<number, { id: number; name: string; code: string }>()
        res.tasks.forEach((t: Task) => unique.set(t.section.id, { id: t.section.id, name: t.section.name, code: t.section.code }))
        setSections([...unique.values()].sort((a, b) => a.code.localeCompare(b.code)))
      })
      .catch(() => setSections([]))
  }, [])

  const loadHistory = () => {
    api.planHistory(20)
      .then(setHistory)
      .catch((e) => setHistoryError(e.message))
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const groupedBySection = useMemo(() => {
    if (!plan?.blocks) return []
    const map = new Map<string, PlanBlock[]>()
    plan.blocks.forEach((b) => {
      map.set(b.section_code, [...(map.get(b.section_code) || []), b])
    })
    return [...map.entries()]
  }, [plan])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-5">
        <Panel title="Plan Generator" className="xl:col-span-2">
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <select className="input" value={horizon} onChange={(e) => setHorizon(e.target.value)}>
              {horizons.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Train density multiplier {density.toFixed(1)}×</label>
              <input type="range" min={0.5} max={2} step={0.1} value={density} onChange={(e) => setDensity(Number(e.target.value))} className="w-full" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['ENG', 'ST', 'OHE'].map((d) => (
                <label key={d} className="rounded border border-slate-700 px-2 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={depts.includes(d)}
                    onChange={(e) => setDepts((prev) => e.target.checked ? [...prev, d] : prev.filter((x) => x !== d))}
                  /> {d}
                </label>
              ))}
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Railway Sections (section_ids)</label>
              <div className="max-h-28 space-y-1 overflow-auto rounded border border-slate-700 p-2 text-xs">
                {sections.map((s) => (
                  <label key={s.id} className="block">
                    <input
                      type="checkbox"
                      checked={sectionIds.includes(s.id)}
                      onChange={(e) => setSectionIds((prev) => e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id))}
                    /> {s.code} · {s.name}
                  </label>
                ))}
              </div>
            </div>
            <button
              className="w-full rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 font-semibold text-cyan-100 disabled:opacity-60"
              disabled={loading}
              onClick={async () => {
                setLoading(true)
                setError('')
                try {
                  const result = await api.generatePlan({
                    start_date: startDate,
                    end_date: endDate,
                    horizon,
                    train_density_multiplier: density,
                    dept_codes: depts.length ? depts : null,
                    section_ids: sectionIds.length ? sectionIds : null,
                  })
                  setPlan(result)
                  if (result.blocks.length) {
                    setBundleRows(
                      result.blocks.flatMap((b) => b.task_ids.map((task_id) => ({
                        task_id: String(task_id),
                        section: b.section_code,
                        start_minute: String(toMinutes(b.start_time)),
                        end_minute: String(toMinutes(b.end_time)),
                      }))),
                    )
                  }
                  loadHistory()
                } catch (e) {
                  setError((e as Error).message)
                } finally {
                  setLoading(false)
                }
              }}
            >
              {loading ? 'Optimizing...' : 'Run Optimization'}
            </button>
            {error ? <ErrorState message={error} /> : null}
          </div>
        </Panel>

        <Panel title="Generated Block Plan" className="xl:col-span-3">
          {!plan ? <EmptyState label="Generate a plan to view timeline and scheduling results." /> : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-300 xl:grid-cols-6">
                <Badge className="border-slate-700">Run {plan.run_id}</Badge>
                <Badge className="border-slate-700">Blocks {plan.total_blocks}</Badge>
                <Badge className="border-slate-700">Joint {plan.joint_blocks}</Badge>
                <Badge className="border-slate-700">Scheduled {plan.total_tasks_scheduled}</Badge>
                <Badge className="border-slate-700">Dropped {plan.tasks_dropped}</Badge>
                <Badge className="border-slate-700">Efficiency {plan.avg_efficiency}%</Badge>
              </div>

              <div className="space-y-3">
                {groupedBySection.map(([section, blocks]) => (
                  <div key={section}>
                    <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">{section}</div>
                    <div className="space-y-2">
                      {blocks.map((b) => (
                        <div key={b.id} className="rounded border border-slate-700 bg-slate-900 p-3">
                          <div className="mb-2 flex items-center justify-between text-xs">
                            <span className="font-mono text-slate-200">{b.start_time} - {b.end_time}</span>
                            <span className="text-slate-400">{b.duration_minutes} min</span>
                          </div>
                          <div className="mb-2 h-2 rounded bg-slate-800">
                            <div className="h-full rounded bg-cyan-400" style={{ width: `${Math.max(10, b.efficiency_score)}%` }} />
                          </div>
                          <div className="mb-2 flex flex-wrap gap-1">
                            {b.departments_involved.map((d) => <Badge key={d} className={deptAccent[d] || 'border-slate-600'}>{d}</Badge>)}
                          </div>
                          <p className="text-xs text-slate-300">{b.why_explanation || 'No explanation provided.'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel title="Plan History" className="xl:col-span-2">
          {historyError ? <ErrorState message={historyError} /> : null}
          {!history ? <LoadingState label="Loading planning history" /> : history.blocks.length === 0 ? <EmptyState label="No historical plans found." /> : (
            <div className="max-h-72 space-y-2 overflow-auto">
              {history.blocks.map((b) => (
                <div key={`${b.id}-${b.run_id}`} className="rounded border border-slate-700 bg-slate-900 p-2 text-xs text-slate-300">
                  <div className="flex items-center justify-between"><span className="font-mono">{b.run_id || 'N/A'}</span><span>{b.schedule_date}</span></div>
                  <div>{b.section_code || `Section ${b.section_id}`} · {b.start_time}-{b.end_time}</div>
                  <div className="text-slate-400">{b.duration_minutes} min · efficiency {b.efficiency_score}%</div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Manual Block Validator" className="xl:col-span-3">
          <div className="grid gap-2 md:grid-cols-4">
            <input className="input" type="number" placeholder="Section ID" value={validator.section_id} onChange={(e) => setValidator((v) => ({ ...v, section_id: e.target.value }))} />
            <input className="input" type="date" value={validator.date} onChange={(e) => setValidator((v) => ({ ...v, date: e.target.value }))} />
            <input className="input" type="time" value={validator.start_time} onChange={(e) => setValidator((v) => ({ ...v, start_time: e.target.value }))} />
            <input className="input" type="time" value={validator.end_time} onChange={(e) => setValidator((v) => ({ ...v, end_time: e.target.value }))} />
          </div>
          <button
            className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-100"
            onClick={async () => {
              try {
                const result = await api.validatePlan({ ...validator, section_id: Number(validator.section_id) })
                setValidationResult(result.valid ? `CLEAR: ${result.message}` : `CONFLICT: ${result.message} (${result.conflict_train || 'unknown train'})`)
              } catch (e) {
                setValidationResult((e as Error).message)
              }
            }}
          >
            Validate Block Window
          </button>
          {validationResult ? <div className="mt-3 rounded border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200">{validationResult}</div> : null}
        </Panel>
      </div>

      <Panel title="Bundle Candidates (Coordination Opportunities)">
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
          <span>Method:</span>
          <select className="input max-w-40" value={bundleMethod} onChange={(e) => setBundleMethod(e.target.value as 'pairwise' | 'dbscan')}>
            <option value="pairwise">Pairwise</option>
            <option value="dbscan">DBSCAN</option>
          </select>
          <button className="rounded border border-slate-700 px-2 py-1" onClick={() => setBundleRows((r) => [...r, { task_id: '', section: '', start_minute: '', end_minute: '' }])}>Add Task Row</button>
        </div>

        <div className="max-h-60 space-y-2 overflow-auto">
          {bundleRows.map((row, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-4">
              <input className="input" placeholder="task_id" value={row.task_id} onChange={(e) => setBundleRows((r) => r.map((x, idx) => idx === i ? { ...x, task_id: e.target.value } : x))} />
              <input className="input" placeholder="section" value={row.section} onChange={(e) => setBundleRows((r) => r.map((x, idx) => idx === i ? { ...x, section: e.target.value } : x))} />
              <input className="input" placeholder="start_minute" value={row.start_minute} onChange={(e) => setBundleRows((r) => r.map((x, idx) => idx === i ? { ...x, start_minute: e.target.value } : x))} />
              <input className="input" placeholder="end_minute" value={row.end_minute} onChange={(e) => setBundleRows((r) => r.map((x, idx) => idx === i ? { ...x, end_minute: e.target.value } : x))} />
            </div>
          ))}
        </div>

        <button
          className="mt-3 rounded border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-100"
          onClick={async () => {
            try {
              const payload = { tasks: bundleRows.filter((r) => r.task_id && r.section && r.start_minute && r.end_minute).map((r) => ({ task_id: Number(r.task_id), section: r.section, start_minute: Number(r.start_minute), end_minute: Number(r.end_minute) })) }
              const res = await api.bundleCandidates(payload, bundleMethod)
              setBundles(res.bundles)
            } catch {
              setBundles([])
            }
          }}
        >
          Find Bundle Candidates
        </button>

        <div className="mt-3 space-y-2">
          {bundles.length === 0 ? <EmptyState label="No bundle candidates returned yet." /> : bundles.map((b, idx) => (
            <div key={idx} className="rounded border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200">
              <div className="font-mono">Section {b.section}</div>
              <div>Task IDs: {b.task_ids.join(', ')}</div>
              <div>Bundle duration: {b.bundle_duration_minutes} min · Downtime saved: {b.downtime_saved_minutes} min</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
