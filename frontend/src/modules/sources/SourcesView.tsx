import { useCallback, useEffect, useState } from 'react'
import { api } from '../../core/api/client'
import type { BlockWindow, Task, TrainSchedule } from '../../types/api'
import { Badge, EmptyState, ErrorState, LoadingState, Panel } from '../../components/common'
import { deptAccent, severityColor, statusClass } from '../../utils/format'

const sourceTabs = ['TMS', 'SMMS', 'TDMS', 'COA'] as const

type SourceTab = typeof sourceTabs[number]

export function SourcesView({ activeTab }: { activeTab?: SourceTab }) {
  const [tab, setTab] = useState<SourceTab>(activeTab || 'TMS')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [severity, setSeverity] = useState(1)
  const [criticalOnly, setCriticalOnly] = useState(false)
  const [oheOnly, setOheOnly] = useState(false)
  const [faultMessage, setFaultMessage] = useState('')

  const [trains, setTrains] = useState<TrainSchedule[]>([])
  const [windows, setWindows] = useState<BlockWindow[]>([])
  const [sectionId, setSectionId] = useState('')
  const [date, setDate] = useState('')
  const [windowDate, setWindowDate] = useState('')

  useEffect(() => {
    if (activeTab) setTab(activeTab)
  }, [activeTab])

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ min_severity: String(severity), limit: '100' })
      let result
      if (tab === 'TMS') {
        if (criticalOnly) params.set('critical_only', 'true')
        result = await api.tms(params)
      } else if (tab === 'SMMS') {
        if (criticalOnly) params.set('critical_only', 'true')
        result = await api.smms(params)
      } else {
        if (oheOnly) params.set('ohe_disconnection_only', 'true')
        result = await api.tdms(params)
      }
      setTasks(result.tasks)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [criticalOnly, oheOnly, severity, tab])

  const loadCoa = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const trainParams = new URLSearchParams({ limit: '200' })
      if (sectionId) trainParams.set('section_id', sectionId)
      if (date) trainParams.set('schedule_date', date)
      const winParams = new URLSearchParams({ available_only: 'true' })
      if (sectionId) winParams.set('section_id', sectionId)
      if (windowDate) winParams.set('schedule_date', windowDate)
      const [trainData, windowData] = await Promise.all([api.trains(trainParams), api.windows(winParams)])
      setTrains(trainData)
      setWindows(windowData)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [date, sectionId, windowDate])

  useEffect(() => {
    if (tab === 'COA') {
      void loadCoa()
      return
    }
    void loadTasks()
  }, [loadCoa, loadTasks, tab])

  return (
    <div className="space-y-4">
      <Panel title="Source Systems → Maintenance Data → OpRail Planning">
        <div className="flex flex-wrap gap-2">
          {sourceTabs.map((s) => (
            <button key={s} className={`rounded border px-3 py-1 text-sm ${tab === s ? 'border-cyan-500 bg-cyan-500/10 text-cyan-100' : 'border-slate-700 text-slate-300'}`} onClick={() => setTab(s)}>{s}</button>
          ))}
        </div>
      </Panel>

      {tab !== 'COA' ? (
        <Panel
          title={`${tab} Feed`}
          actions={
            <div className="flex items-center gap-2 text-xs">
              <select className="input max-w-36" value={severity} onChange={(e) => setSeverity(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Severity ≥ {n}</option>)}</select>
              {(tab === 'TMS' || tab === 'SMMS') && <label><input type="checkbox" checked={criticalOnly} onChange={(e) => setCriticalOnly(e.target.checked)} /> Critical</label>}
              {tab === 'TDMS' && <label><input type="checkbox" checked={oheOnly} onChange={(e) => setOheOnly(e.target.checked)} /> OHE required</label>}
              <button className="rounded border border-slate-700 px-2 py-1" onClick={() => void loadTasks()}>Refresh</button>
            </div>
          }
        >
          {tab === 'TDMS' ? (
            <div className="mb-3 rounded border border-red-700/60 bg-red-950/30 p-3 text-sm text-red-100">
              <p className="mb-2 font-semibold">Emergency Fault Simulation (Testing)</p>
              <p className="mb-2 text-xs text-red-200">Creates a critical OHE fault task using backend simulation endpoint.</p>
              <button
                className="rounded border border-red-500/60 bg-red-500/20 px-3 py-1 text-xs font-semibold"
                onClick={async () => {
                  if (!window.confirm('Run TDMS emergency fault simulation?')) return
                  setFaultMessage('Simulating incident...')
                  try {
                    const res = await api.simulateFault()
                    setFaultMessage(`${res.message} · ${res.task_code} · score ${res.ai_priority_score.toFixed(2)}`)
                    loadTasks()
                  } catch (e) {
                    setFaultMessage((e as Error).message)
                  }
                }}
              >
                Simulate Live Fault
              </button>
              {faultMessage ? <p className="mt-2 text-xs">{faultMessage}</p> : null}
            </div>
          ) : null}

          {loading ? <LoadingState label="Loading source feed" /> : null}
          {error ? <ErrorState message={error} /> : null}
          {!loading && !error && tasks.length === 0 ? <EmptyState label="No tasks from selected source and filters." /> : null}
          {!loading && !error && tasks.length > 0 ? (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-400"><tr><th className="py-2">Task</th><th>Dept</th><th>Section</th><th>Severity</th><th>Priority</th><th>Status</th></tr></thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} className="border-t border-slate-800">
                      <td className="py-2 font-mono text-slate-200">{t.task_code}</td>
                      <td><Badge className={deptAccent[t.department.code] || 'border-slate-600'}>{t.department.code}</Badge></td>
                      <td>{t.section.name}</td>
                      <td><span className={`inline-block h-2 w-2 rounded-full ${severityColor(t.severity)}`} /> {t.severity}</td>
                      <td>{t.priority_score.toFixed(1)}</td>
                      <td><Badge className={statusClass(t.status)}>{t.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-5">
          <Panel title="COA Train Timetable" className="xl:col-span-3" actions={<button className="rounded border border-slate-700 px-2 py-1 text-xs" onClick={() => void loadCoa()}>Load</button>}>
            <div className="mb-3 grid gap-2 md:grid-cols-3">
              <input className="input" placeholder="Section ID" value={sectionId} onChange={(e) => setSectionId(e.target.value)} />
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <input className="input" type="date" value={windowDate} onChange={(e) => setWindowDate(e.target.value)} />
            </div>
            {loading ? <LoadingState label="Loading COA data" /> : null}
            {error ? <ErrorState message={error} /> : null}
            {!loading && !error && trains.length === 0 ? <EmptyState label="No train schedule rows for current filter." /> : null}
            {!loading && !error && trains.length > 0 ? (
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-400"><tr><th className="py-2">Train</th><th>Type</th><th>Priority</th><th>Entry</th><th>Exit</th><th>Date</th></tr></thead>
                  <tbody>
                    {trains.map((t) => (
                      <tr key={t.id} className="border-t border-slate-800"><td className="py-2 font-mono">{t.train_no}</td><td>{t.train_type}</td><td>{t.train_priority}</td><td>{t.entry_time}</td><td>{t.exit_time}</td><td>{t.schedule_date}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Panel>

          <Panel title="Available Maintenance Windows" className="xl:col-span-2">
            {windows.length === 0 ? <EmptyState label="No available windows for filter." /> : (
              <div className="max-h-72 space-y-2 overflow-auto">
                {windows.map((w) => (
                  <div key={w.id} className="rounded border border-slate-700 bg-slate-900 p-2 text-xs text-slate-300">
                    <div className="font-mono">Section {w.section_id} · {w.schedule_date}</div>
                    <div>{w.start_time} - {w.end_time} ({w.duration_minutes} min)</div>
                    <div className="text-slate-400">{w.window_type} · {w.corridor_id || 'No corridor'}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}
