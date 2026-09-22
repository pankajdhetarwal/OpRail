import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../core/api/client'
import type { BlockWindow, Task, TrainSchedule } from '../../types/api'
import { Badge, EmptyState, ErrorState, LoadingState, Panel } from '../../components/common'
import { deptAccent, severityColor, statusClass } from '../../utils/format'

const sourceTabs = ['TMS', 'SMMS', 'TDMS', 'COA'] as const

type SourceTab = typeof sourceTabs[number]

const sourceMeta: Record<SourceTab, {
  label: string
  subtitle: string
  description: string
}> = {
  TMS: {
    label: 'TMS',
    subtitle: 'Engineering',
    description: 'Track maintenance and engineering task feed',
  },
  SMMS: {
    label: 'SMMS',
    subtitle: 'Signal & Telecom',
    description: 'Signal and telecom maintenance task feed',
  },
  TDMS: {
    label: 'TDMS',
    subtitle: 'OHE',
    description: 'Traction distribution and OHE maintenance feed',
  },
  COA: {
    label: 'COA',
    subtitle: 'Train Operations',
    description: 'Train timetable and maintenance window data',
  },
}

export function SourcesView({ activeTab }: { activeTab?: SourceTab }) {
  const [tab, setTab] = useState<SourceTab>(activeTab || 'TMS')

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [severity, setSeverity] = useState(1)
  const [criticalOnly, setCriticalOnly] = useState(false)
  const [oheOnly, setOheOnly] = useState(false)

  const [faultMessage, setFaultMessage] = useState('')
  const [faultLoading, setFaultLoading] = useState(false)

  const [trains, setTrains] = useState<TrainSchedule[]>([])
  const [windows, setWindows] = useState<BlockWindow[]>([])
  const [sectionId, setSectionId] = useState('')
  const [date, setDate] = useState('')
  const [windowDate, setWindowDate] = useState('')

  useEffect(() => {
    if (activeTab) {
      setTab(activeTab)
    }
  }, [activeTab])

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        min_severity: String(severity),
        limit: '100',
      })

      let result

      if (tab === 'TMS') {
        if (criticalOnly) {
          params.set('critical_only', 'true')
        }

        result = await api.tms(params)
      } else if (tab === 'SMMS') {
        if (criticalOnly) {
          params.set('critical_only', 'true')
        }

        result = await api.smms(params)
      } else {
        if (oheOnly) {
          params.set('ohe_disconnection_only', 'true')
        }

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
      const trainParams = new URLSearchParams({
        limit: '200',
      })

      if (sectionId) {
        trainParams.set('section_id', sectionId)
      }

      if (date) {
        trainParams.set('schedule_date', date)
      }

      const winParams = new URLSearchParams({
        available_only: 'true',
      })

      if (sectionId) {
        winParams.set('section_id', sectionId)
      }

      if (windowDate) {
        winParams.set('schedule_date', windowDate)
      }

      const [trainData, windowData] = await Promise.all([
        api.trains(trainParams),
        api.windows(winParams),
      ])

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

  const taskStats = useMemo(() => {
    const critical = tasks.filter((task) => task.severity >= 4).length

    const highSeverity = tasks.filter(
      (task) => task.severity >= 3,
    ).length

    const open = tasks.filter((task) => {
      const status = task.status.toLowerCase()

      return (
        status === 'open' ||
        status === 'pending' ||
        status === 'planned'
      )
    }).length

    return {
      total: tasks.length,
      critical,
      highSeverity,
      open,
    }
  }, [tasks])

  const runFaultSimulation = async () => {
    if (!window.confirm('Run TDMS emergency fault simulation?')) {
      return
    }

    setFaultLoading(true)
    setFaultMessage('Running test simulation...')

    try {
      const res = await api.simulateFault()

      setFaultMessage(
        `${res.message} · ${res.task_code} · score ${res.ai_priority_score.toFixed(2)}`,
      )

      void loadTasks()
    } catch (e) {
      setFaultMessage((e as Error).message)
    } finally {
      setFaultLoading(false)
    }
  }

  const currentSource = sourceMeta[tab]

  return (
    <div className="space-y-4">
      {/* Header */}
      <Panel title="Source Systems Control Center">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />

              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Source Integration Layer
              </span>
            </div>

            <p className="text-sm text-slate-400">
              Integrated maintenance and train-operation data feeds for OpRail planning.
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Active source
            </p>

            <p className="mt-1 font-mono text-sm font-semibold text-cyan-300">
              {tab}
            </p>
          </div>
        </div>
      </Panel>

      {/* Source system selector */}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {sourceTabs.map((source) => {
          const meta = sourceMeta[source]
          const active = tab === source

          return (
            <button
              key={source}
              type="button"
              onClick={() => setTab(source)}
              className={[
                'group rounded-xl border p-4 text-left transition',
                active
                  ? 'border-cyan-500/60 bg-cyan-500/10 shadow-[0_0_25px_rgba(34,211,238,0.07)]'
                  : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60',
              ].join(' ')}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p
                    className={`font-mono text-sm font-semibold ${
                      active ? 'text-cyan-300' : 'text-slate-200'
                    }`}
                  >
                    {meta.label}
                  </p>

                  <p className="mt-1 text-xs font-medium text-slate-400">
                    {meta.subtitle}
                  </p>
                </div>

                <span
                  className={`mt-1 h-2 w-2 rounded-full ${
                    active ? 'bg-cyan-400' : 'bg-slate-700'
                  }`}
                />
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                {meta.description}
              </p>
            </button>
          )
        })}
      </div>

      {tab !== 'COA' ? (
        <>
          {/* Source overview */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Total tasks
              </p>

              <p className="mt-2 text-2xl font-semibold text-slate-100">
                {taskStats.total}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Current source feed
              </p>
            </div>

            <div className="rounded-xl border border-red-900/40 bg-red-950/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Critical
              </p>

              <p className="mt-2 text-2xl font-semibold text-red-300">
                {taskStats.critical}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Severity 4–5
              </p>
            </div>

            <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Elevated severity
              </p>

              <p className="mt-2 text-2xl font-semibold text-amber-300">
                {taskStats.highSeverity}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Severity 3+
              </p>
            </div>

            <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Active workflow
              </p>

              <p className="mt-2 text-2xl font-semibold text-emerald-300">
                {taskStats.open}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Open / pending / planned
              </p>
            </div>
          </div>

          {/* Source feed */}
          <Panel
            title={`${currentSource.label} · ${currentSource.subtitle}`}
            actions={
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  className="input max-w-36"
                  value={severity}
                  onChange={(e) => setSeverity(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      Severity ≥ {n}
                    </option>
                  ))}
                </select>

                {(tab === 'TMS' || tab === 'SMMS') ? (
                  <label className="flex items-center gap-1.5 text-slate-300">
                    <input
                      type="checkbox"
                      checked={criticalOnly}
                      onChange={(e) => setCriticalOnly(e.target.checked)}
                    />
                    Critical only
                  </label>
                ) : null}

                {tab === 'TDMS' ? (
                  <label className="flex items-center gap-1.5 text-slate-300">
                    <input
                      type="checkbox"
                      checked={oheOnly}
                      onChange={(e) => setOheOnly(e.target.checked)}
                    />
                    OHE required
                  </label>
                ) : null}

                <button
                  type="button"
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-500/50 hover:text-cyan-200"
                  onClick={() => void loadTasks()}
                >
                  Refresh
                </button>
              </div>
            }
          >
            {/* TDMS testing zone */}
            {tab === 'TDMS' ? (
              <div className="mb-4 rounded-xl border border-amber-700/40 bg-amber-950/10 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-amber-600/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
                        Testing
                      </span>

                      <span className="text-sm font-semibold text-slate-200">
                        Emergency Fault Simulation
                      </span>
                    </div>

                    <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">
                      Generate a simulated critical OHE fault to test the
                      TDMS → OpRail maintenance workflow. This does not
                      represent a live railway incident.
                    </p>

                    {faultMessage ? (
                      <p className="mt-2 rounded border border-slate-800 bg-slate-950/70 px-3 py-2 font-mono text-xs text-slate-300">
                        {faultMessage}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    disabled={faultLoading}
                    className="shrink-0 rounded border border-amber-600/50 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void runFaultSimulation()}
                  >
                    {faultLoading
                      ? 'Running test...'
                      : 'Run Test Simulation'}
                  </button>
                </div>
              </div>
            ) : null}

            {loading ? (
              <LoadingState label="Loading source feed" />
            ) : null}

            {error ? (
              <ErrorState message={error} />
            ) : null}

            {!loading && !error && tasks.length === 0 ? (
              <EmptyState label="No tasks from selected source and filters." />
            ) : null}

            {!loading && !error && tasks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-slate-800 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="py-3 pr-4">Task</th>
                      <th className="pr-4">Department</th>
                      <th className="pr-4">Section</th>
                      <th className="pr-4">Severity</th>
                      <th className="pr-4">Priority</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {tasks.map((task) => (
                      <tr
                        key={task.id}
                        className="border-b border-slate-900 transition hover:bg-slate-900/50"
                      >
                        <td className="py-3 pr-4 font-mono text-xs font-semibold text-cyan-200">
                          {task.task_code}
                        </td>

                        <td className="pr-4">
                          <Badge
                            className={
                              deptAccent[task.department.code] ||
                              'border-slate-600'
                            }
                          >
                            {task.department.code}
                          </Badge>
                        </td>

                        <td className="pr-4 text-slate-300">
                          {task.section.name}
                        </td>

                        <td className="pr-4">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${severityColor(
                                task.severity,
                              )}`}
                            />

                            <span className="font-medium text-slate-200">
                              {task.severity}
                            </span>
                          </span>
                        </td>

                        <td className="pr-4 font-mono text-xs text-slate-300">
                          {task.priority_score.toFixed(1)}
                        </td>

                        <td>
                          <Badge className={statusClass(task.status)}>
                            {task.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Panel>
        </>
      ) : (
        <>
          {/* COA overview */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Train schedule rows
              </p>

              <p className="mt-2 text-2xl font-semibold text-cyan-300">
                {trains.length}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Current COA filter
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Available windows
              </p>

              <p className="mt-2 text-2xl font-semibold text-emerald-300">
                {windows.length}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Maintenance opportunities
              </p>
            </div>
          </div>

          {/* COA */}
          <Panel
            title="COA · Train Operations"
            actions={
              <button
                type="button"
                className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-500/50 hover:text-cyan-200"
                onClick={() => void loadCoa()}
              >
                Refresh
              </button>
            }
          >
            {/* Filters */}
            <div className="mb-5 grid gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Section ID
                </span>

                <input
                  className="input w-full"
                  placeholder="e.g. 12"
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                />
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Train schedule date
                </span>

                <input
                  className="input w-full"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>

              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Window date
                </span>

                <input
                  className="input w-full"
                  type="date"
                  value={windowDate}
                  onChange={(e) => setWindowDate(e.target.value)}
                />
              </label>
            </div>

            {loading ? (
              <LoadingState label="Loading COA data" />
            ) : null}

            {error ? (
              <ErrorState message={error} />
            ) : null}

            {!loading && !error ? (
              <div className="grid gap-4 xl:grid-cols-5">
                {/* Train timetable */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 xl:col-span-3">
                  <div className="border-b border-slate-800 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-200">
                          Train Timetable
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          COA train schedule data
                        </p>
                      </div>

                      <span className="font-mono text-xs text-cyan-300">
                        {trains.length} rows
                      </span>
                    </div>
                  </div>

                  {trains.length === 0 ? (
                    <div className="p-4">
                      <EmptyState label="No train schedule rows for current filter." />
                    </div>
                  ) : (
                    <div className="max-h-[420px] overflow-auto">
                      <table className="w-full min-w-[620px] text-left text-sm">
                        <thead className="sticky top-0 border-b border-slate-800 bg-slate-950 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Train</th>
                            <th>Type</th>
                            <th>Priority</th>
                            <th>Entry</th>
                            <th>Exit</th>
                            <th>Date</th>
                          </tr>
                        </thead>

                        <tbody>
                          {trains.map((train) => (
                            <tr
                              key={train.id}
                              className="border-b border-slate-900 transition hover:bg-slate-900/50"
                            >
                              <td className="px-4 py-3 font-mono text-xs font-semibold text-cyan-200">
                                {train.train_no}
                              </td>

                              <td className="text-slate-300">
                                {train.train_type}
                              </td>

                              <td className="text-slate-300">
                                {train.train_priority}
                              </td>

                              <td className="font-mono text-xs text-slate-400">
                                {train.entry_time}
                              </td>

                              <td className="font-mono text-xs text-slate-400">
                                {train.exit_time}
                              </td>

                              <td className="font-mono text-xs text-slate-500">
                                {train.schedule_date}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Maintenance windows */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 xl:col-span-2">
                  <div className="border-b border-slate-800 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-200">
                          Available Maintenance Windows
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Windows returned by COA
                        </p>
                      </div>

                      <span className="font-mono text-xs text-emerald-300">
                        {windows.length} available
                      </span>
                    </div>
                  </div>

                  {windows.length === 0 ? (
                    <div className="p-4">
                      <EmptyState label="No available windows for filter." />
                    </div>
                  ) : (
                    <div className="max-h-[420px] space-y-2 overflow-auto p-3">
                      {windows.map((window) => (
                        <div
                          key={window.id}
                          className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 transition hover:border-slate-700"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-semibold text-cyan-200">
                              Section {window.section_id}
                            </span>

                            <span className="font-mono text-[10px] text-slate-500">
                              {window.schedule_date}
                            </span>
                          </div>

                          <div className="mt-2 text-sm font-medium text-slate-200">
                            {window.start_time} – {window.end_time}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            {window.duration_minutes} min · {window.window_type}
                          </div>

                          <div className="mt-1 text-[11px] text-slate-500">
                            Corridor: {window.corridor_id || 'No corridor'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </Panel>
        </>
      )}
    </div>
  )
}