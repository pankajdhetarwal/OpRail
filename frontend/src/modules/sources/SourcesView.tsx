/**
 * SourcesView.tsx — Mission 12: Source Systems Control Center Redesign
 *
 * Professional workspace for inspecting railway data source integrations.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Calendar,
  Clock3,
  Database,
  Search,
  Terminal,
  TrainFront,
  Zap,
} from 'lucide-react'

import { api } from '../../core/api/client'
import type { BlockWindow, Task, TrainSchedule } from '../../types/api'
import { Badge, EmptyState, ErrorState, LoadingState } from '../../components/common'
import { deptAccent, severityColor, statusClass } from '../../utils/format'

const sourceTabs = ['TMS', 'SMMS', 'TDMS', 'COA'] as const
type SourceTab = typeof sourceTabs[number]

const sourceMeta: Record<SourceTab, {
  label: string
  subtitle: string
  description: string
  icon: React.ReactNode
}> = {
  TMS: {
    label: 'TMS',
    subtitle: 'Engineering',
    description: 'Track maintenance and engineering task feed.',
    icon: <Database className="h-5 w-5" />,
  },
  SMMS: {
    label: 'SMMS',
    subtitle: 'Signal & Telecom',
    description: 'Signal and telecom maintenance task feed.',
    icon: <Terminal className="h-5 w-5" />,
  },
  TDMS: {
    label: 'TDMS',
    subtitle: 'OHE',
    description: 'Traction distribution and OHE maintenance feed.',
    icon: <Zap className="h-5 w-5" />,
  },
  COA: {
    label: 'COA',
    subtitle: 'Train Operations',
    description: 'Train timetable and maintenance window data.',
    icon: <TrainFront className="h-5 w-5" />,
  },
}

export function SourcesView({ activeTab }: { activeTab?: SourceTab }) {
  const [tab, setTab] = useState<SourceTab>(activeTab || 'TMS')

  // Data states
  const [tasks, setTasks] = useState<Task[]>([])
  const [trains, setTrains] = useState<TrainSchedule[]>([])
  const [totalTrains, setTotalTrains] = useState(0)
  const [windows, setWindows] = useState<BlockWindow[]>([])
  
  // Status states
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  // Maintenance Filters
  const [severity, setSeverity] = useState(1)
  const [criticalOnly, setCriticalOnly] = useState(false)
  const [oheOnly, setOheOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // COA Filters
  const [sectionId, setSectionId] = useState('')
  const [date, setDate] = useState('')
  const [windowDate, setWindowDate] = useState('')
  const [trainSearchQuery, setTrainSearchQuery] = useState('')

  // TDMS Fault Sim
  const [faultMessage, setFaultMessage] = useState('')
  const [faultLoading, setFaultLoading] = useState(false)

  useEffect(() => {
    if (activeTab) {
      setTab(activeTab)
    }
  }, [activeTab])

  // Clear states when tab changes
  useEffect(() => {
    setSearchQuery('')
    setTrainSearchQuery('')
  }, [tab])

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        min_severity: String(severity),
        limit: '500', // Pulling a healthy amount for client-side text filtering
      })

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
      setLastRefreshed(new Date())
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
      const trainParams = new URLSearchParams({ limit: '200', skip: '0' })
      if (sectionId) trainParams.set('section_id', sectionId)
      if (date) trainParams.set('schedule_date', date)

      const winParams = new URLSearchParams({ available_only: 'true' })
      if (sectionId) winParams.set('section_id', sectionId)
      if (windowDate) winParams.set('schedule_date', windowDate)

      const [trainData, windowData] = await Promise.all([
        api.trains(trainParams),
        api.windows(winParams),
      ])

      setTrains(trainData.trains)
      setTotalTrains(trainData.total)
      setWindows(windowData)
      setLastRefreshed(new Date())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [date, sectionId, windowDate])

  useEffect(() => {
    if (tab === 'COA') {
      void loadCoa()
    } else {
      void loadTasks()
    }
  }, [loadCoa, loadTasks, tab])

  const loadMoreTrains = async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const trainParams = new URLSearchParams({ limit: '200', skip: trains.length.toString() })
      if (sectionId) trainParams.set('section_id', sectionId)
      if (date) trainParams.set('schedule_date', date)

      const trainData = await api.trains(trainParams)
      setTrains(prev => [...prev, ...trainData.trains])
      setTotalTrains(trainData.total)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingMore(false)
    }
  }

  const runFaultSimulation = async () => {
    if (!window.confirm('Run TDMS emergency fault simulation?')) return
    setFaultLoading(true)
    setFaultMessage('Running test simulation...')
    try {
      const res = await api.simulateFault()
      setFaultMessage(`${res.message} · ${res.task_code} · score ${res.ai_priority_score.toFixed(2)}`)
      void loadTasks()
    } catch (e) {
      setFaultMessage((e as Error).message)
    } finally {
      setFaultLoading(false)
    }
  }

  // ── Derived State ─────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks
    const q = searchQuery.toLowerCase()
    return tasks.filter(
      (t) =>
        t.task_code.toLowerCase().includes(q) ||
        t.section.name.toLowerCase().includes(q) ||
        t.department.code.toLowerCase().includes(q),
    )
  }, [tasks, searchQuery])

  const taskStats = useMemo(() => {
    return {
      total: tasks.length,
      critical: tasks.filter((t) => t.severity >= 4).length,
      highSeverity: tasks.filter((t) => t.severity >= 3).length,
      open: tasks.filter((t) => ['open', 'pending', 'planned'].includes(t.status.toLowerCase())).length,
    }
  }, [tasks])

  const filteredTrains = useMemo(() => {
    if (!trainSearchQuery) return trains
    const q = trainSearchQuery.toLowerCase()
    return trains.filter(
      (t) =>
        t.train_no.toLowerCase().includes(q) ||
        (t.train_name && t.train_name.toLowerCase().includes(q)),
    )
  }, [trains, trainSearchQuery])

  const currentSource = sourceMeta[tab]
  const isOnline = !loading && !error && lastRefreshed !== null

  return (
    <div className="src-workspace">
      
      {/* ── Source Navigation ── */}
      <div className="src-nav-container">
        {sourceTabs.map((source) => {
          const meta = sourceMeta[source]
          const active = tab === source
          return (
            <button
              key={source}
              type="button"
              className={`src-nav-item ${active ? 'is-active' : ''}`}
              onClick={() => setTab(source)}
              aria-selected={active}
            >
              {meta.icon}
              <div className="src-nav-text">
                <strong>{meta.label}</strong>
                <span>{meta.subtitle}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Active Source Main Content ── */}
      <div className="src-main-content">
        
        {/* Source Header */}
        <header className="src-header">
          <div className="src-header-title">
            <h2>{currentSource.label} <span>/ {currentSource.subtitle}</span></h2>
            <p>{currentSource.description}</p>
          </div>
          
          <div className="src-header-status">
            {loading ? (
              <span className="src-status-badge is-loading">
                <span className="src-dot animate-pulse" /> Connecting...
              </span>
            ) : error ? (
              <span className="src-status-badge is-error">
                <AlertTriangle className="h-3.5 w-3.5" /> ERROR
              </span>
            ) : isOnline ? (
              <span className="src-status-badge is-online">
                <span className="src-dot" /> ONLINE
              </span>
            ) : null}
            
            {lastRefreshed && (
              <span className="src-timestamp">
                Last synced: {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
          </div>
        </header>

        {/* Operational Summary */}
        {tab !== 'COA' ? (
          <div className="src-summary-grid">
            <div className="src-summary-card">
              <span className="src-summary-label">Total Records</span>
              <strong className="src-summary-value text-slate-100">{taskStats.total}</strong>
              <span className="src-summary-sub">Current backend feed</span>
            </div>
            <div className="src-summary-card is-critical">
              <span className="src-summary-label">Critical Alerts</span>
              <strong className="src-summary-value">{taskStats.critical}</strong>
              <span className="src-summary-sub">Severity 4–5</span>
            </div>
            <div className="src-summary-card is-elevated">
              <span className="src-summary-label">Elevated Severity</span>
              <strong className="src-summary-value">{taskStats.highSeverity}</strong>
              <span className="src-summary-sub">Severity 3+</span>
            </div>
            <div className="src-summary-card is-healthy">
              <span className="src-summary-label">Active Workflow</span>
              <strong className="src-summary-value">{taskStats.open}</strong>
              <span className="src-summary-sub">Open / pending records</span>
            </div>
          </div>
        ) : (
          <div className="src-summary-grid coa-grid">
            <div className="src-summary-card is-coa">
              <span className="src-summary-label">Train Schedules</span>
              <strong className="src-summary-value text-cyan-300">{totalTrains.toLocaleString()}</strong>
              <span className="src-summary-sub">Showing {trains.length} of {totalTrains.toLocaleString()}</span>
            </div>
            <div className="src-summary-card is-coa">
              <span className="src-summary-label">Available Windows</span>
              <strong className="src-summary-value text-emerald-300">{windows.length}</strong>
              <span className="src-summary-sub">Maintenance opportunities</span>
            </div>
          </div>
        )}

        {/* Live Data Toolbar */}
        <div className="src-toolbar">
          <div className="src-toolbar-filters">
            {tab !== 'COA' ? (
              <>
                <div className="src-search-box">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Search task code or section..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <select
                  className="input src-select-sm"
                  value={severity}
                  onChange={(e) => setSeverity(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>Severity ≥ {n}</option>
                  ))}
                </select>
                {tab === 'TMS' || tab === 'SMMS' ? (
                  <label className="src-checkbox-label">
                    <input type="checkbox" checked={criticalOnly} onChange={e => setCriticalOnly(e.target.checked)} />
                    Critical only
                  </label>
                ) : null}
                {tab === 'TDMS' ? (
                  <label className="src-checkbox-label">
                    <input type="checkbox" checked={oheOnly} onChange={e => setOheOnly(e.target.checked)} />
                    OHE required
                  </label>
                ) : null}
              </>
            ) : (
              <>
                <div className="src-search-box">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Search loaded trains..." 
                    value={trainSearchQuery}
                    onChange={e => setTrainSearchQuery(e.target.value)}
                  />
                </div>
                <label className="src-input-label">
                  Section ID
                  <input className="input src-select-sm w-20" placeholder="e.g. 12" value={sectionId} onChange={e => setSectionId(e.target.value)} />
                </label>
                <label className="src-input-label">
                  Train Date
                  <input className="input src-select-sm w-36" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </label>
                <label className="src-input-label">
                  Window Date
                  <input className="input src-select-sm w-36" type="date" value={windowDate} onChange={e => setWindowDate(e.target.value)} />
                </label>
              </>
            )}
          </div>
          
          <button type="button" className="src-refresh-btn" onClick={() => tab === 'COA' ? void loadCoa() : void loadTasks()} disabled={loading}>
            Refresh Sync
          </button>
        </div>

        {/* TDMS specific simulation banner */}
        {tab === 'TDMS' && (
          <div className="src-tdms-sim">
            <div className="src-tdms-sim-text">
              <span className="src-sim-badge">TESTING</span>
              <strong>Emergency Fault Simulation</strong>
              <p>Simulate an IoT sensor detecting an urgent OHE failure. Generates a live priority-scored critical task.</p>
              {faultMessage && <div className="src-sim-output">{faultMessage}</div>}
            </div>
            <button type="button" className="src-sim-btn" onClick={() => void runFaultSimulation()} disabled={faultLoading}>
              {faultLoading ? 'Running...' : 'Run Simulation'}
            </button>
          </div>
        )}

        {/* Data Container */}
        <div className="src-data-container">
          {loading ? (
            <LoadingState label={`Syncing ${tab} records...`} />
          ) : error ? (
            <ErrorState message={error} />
          ) : tab !== 'COA' ? (
            filteredTasks.length === 0 ? (
              <EmptyState label={tasks.length === 0 ? `No ${tab} records available.` : `No ${tab} records match filters.`} />
            ) : (
              <div className="src-table-wrapper">
                <table className="src-table">
                  <thead>
                    <tr>
                      <th>Record ID</th>
                      <th>Department</th>
                      <th>Section</th>
                      <th>Severity</th>
                      <th>AI Priority</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map(task => (
                      <tr key={task.id}>
                        <td><span className="src-mono font-semibold text-cyan-200">{task.task_code}</span></td>
                        <td>
                          <Badge className={deptAccent[task.department.code] || 'border-slate-600'}>
                            {task.department.code}
                          </Badge>
                        </td>
                        <td className="text-slate-300">{task.section.name}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${severityColor(task.severity)}`} />
                            <span className="font-medium text-slate-200">{task.severity}</span>
                          </div>
                        </td>
                        <td><span className="src-mono text-slate-300">{task.priority_score.toFixed(1)}</span></td>
                        <td><Badge className={statusClass(task.status)}>{task.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="src-coa-split">
              {/* Trains */}
              <div className="src-table-wrapper">
                <div className="src-table-header">
                  <strong>Train Timetable</strong>
                  <span>{trains.length} of {totalTrains.toLocaleString()} loaded</span>
                </div>
                {filteredTrains.length === 0 ? (
                  <EmptyState label="No train schedules match context." />
                ) : (
                  <table className="src-table">
                    <thead>
                      <tr>
                        <th>Train</th>
                        <th>Type</th>
                        <th>Priority</th>
                        <th>Entry</th>
                        <th>Exit</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTrains.map(train => (
                        <tr key={train.id}>
                          <td><span className="src-mono font-semibold text-cyan-200">{train.train_no}</span></td>
                          <td className="text-slate-300">{train.train_type}</td>
                          <td className="text-slate-300">{train.train_priority}</td>
                          <td className="src-mono text-slate-400">{train.entry_time}</td>
                          <td className="src-mono text-slate-400">{train.exit_time}</td>
                          <td className="src-mono text-slate-500">{train.schedule_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {!trainSearchQuery && trains.length < totalTrains && (
                  <div className="p-4 border-t border-slate-700/50 flex justify-center">
                    <button 
                      type="button" 
                      className="src-sim-btn" 
                      onClick={() => void loadMoreTrains()}
                      disabled={loadingMore}
                    >
                      {loadingMore ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
                {!trainSearchQuery && trains.length >= totalTrains && trains.length > 0 && (
                  <div className="p-4 border-t border-slate-700/50 text-center text-sm text-slate-500">
                    All records loaded
                  </div>
                )}
              </div>

              {/* Windows */}
              <div className="src-table-wrapper">
                <div className="src-table-header">
                  <strong>Maintenance Windows</strong>
                  <span>{windows.length} available</span>
                </div>
                {windows.length === 0 ? (
                  <EmptyState label="No block windows available." />
                ) : (
                  <div className="src-windows-list">
                    {windows.map(window => (
                      <div key={window.id} className="src-window-card">
                        <div className="flex items-center justify-between mb-2">
                          <span className="src-mono text-xs font-semibold text-emerald-300">Sec {window.section_id}</span>
                          <span className="src-mono text-[10px] text-slate-500"><Calendar className="inline h-3 w-3 mr-1"/>{window.schedule_date}</span>
                        </div>
                        <div className="text-sm font-medium text-slate-200 mb-1">
                          <Clock3 className="inline h-3.5 w-3.5 mr-1.5 text-slate-400"/>
                          {window.start_time} – {window.end_time}
                        </div>
                        <div className="text-xs text-slate-400">
                          {window.duration_minutes} min duration · {window.window_type}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}