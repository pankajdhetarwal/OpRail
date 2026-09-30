/**
 * BundleCandidatesView.tsx — Mission 11: Bundle Candidates Redesign
 *
 * Professional workspace to analyze which maintenance tasks can be coordinated
 * into the same railway maintenance block to save downtime.
 *
 * Backend contract:
 *   POST /api/plan/bundle-candidates
 *   Takes TaskScheduleInput[] and returns BundleCandidate[]
 *
 * All data is real.
 */

import {
  useEffect,
  useState,
} from 'react'
import {
  AlertTriangle,
  CheckSquare,
  Clock3,
  Combine,
  Info,
  Layers3,
  Loader2,
  Route,
  Search,
  Square,
  Timer,
  Zap,
} from 'lucide-react'

import { api } from '../../core/api/client'
import type { BundleCandidate, Task } from '../../types/api'

type BundleMethod = 'pairwise' | 'dbscan'

interface SectionOption {
  id: number
  code: string
  name: string
}

export function BundleCandidatesView() {
  // ── Sections & Tasks state ────────────────────────────────────────────────
  const [sections, setSections] = useState<SectionOption[]>([])
  const [sectionsLoading, setSectionsLoading] = useState(true)
  const [sectionId, setSectionId] = useState<string>('')

  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [tasksError, setTasksError] = useState('')

  // ── Selection & Bundling state ────────────────────────────────────────────
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set())
  const [method, setMethod] = useState<BundleMethod>('dbscan')
  const [bundles, setBundles] = useState<BundleCandidate[]>([])
  const [bundleLoading, setBundleLoading] = useState(false)
  const [bundleError, setBundleError] = useState('')

  // 1. Initial load: fetch all tasks to extract unique sections
  useEffect(() => {
    setSectionsLoading(true)
    api
      .tasks({ limit: 500 })
      .then((res) => {
        const map = new Map<number, SectionOption>()
        for (const task of res.tasks) {
          if (!map.has(task.section.id)) {
            map.set(task.section.id, {
              id: task.section.id,
              code: task.section.code,
              name: task.section.name,
            })
          }
        }
        const list = [...map.values()].sort((a, b) =>
          a.code.localeCompare(b.code),
        )
        setSections(list)
        if (list.length > 0 && !sectionId) {
          setSectionId(String(list[0].id))
        }
      })
      .catch(() => {
        // Silent fail on sections
      })
      .finally(() => {
        setSectionsLoading(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Load tasks when section changes
  useEffect(() => {
    if (!sectionId) {
      setTasks([])
      return
    }

    setTasksLoading(true)
    setTasksError('')
    setSelectedTaskIds(new Set())
    setBundles([])

    api
      .tasks({ section_id: Number(sectionId), limit: 100 })
      .then((res) => setTasks(res.tasks))
      .catch((e: unknown) => {
        setTasksError(e instanceof Error ? e.message : 'Unable to load tasks')
        setTasks([])
      })
      .finally(() => setTasksLoading(false))
  }, [sectionId])

  // ── Interactions ──────────────────────────────────────────────────────────

  const toggleTask = (taskId: number) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
    // Clear old bundles when selection changes
    setBundles([])
    setBundleError('')
  }

  const toggleAll = () => {
    if (selectedTaskIds.size === tasks.length) {
      setSelectedTaskIds(new Set())
    } else {
      setSelectedTaskIds(new Set(tasks.map((t) => t.id)))
    }
    setBundles([])
    setBundleError('')
  }

  const findBundles = async () => {
    if (selectedTaskIds.size === 0) return

    setBundleLoading(true)
    setBundleError('')

    try {
      // Find the selected tasks
      const selectedTasks = tasks.filter((t) => selectedTaskIds.has(t.id))

      // Simulate aligned execution: all tasks start at minute 0, end at their duration
      const payloadTasks = selectedTasks.map((t) => ({
        task_id: t.id,
        section: t.section.code,
        start_minute: 0, // Aligned start
        end_minute: t.duration_minutes,
      }))

      const response = await api.bundleCandidates(
        { tasks: payloadTasks },
        method,
      )
      setBundles(response.bundles ?? [])
    } catch (e: unknown) {
      setBundles([])
      setBundleError(
        e instanceof Error ? e.message : 'Unable to find bundle candidates.',
      )
    } finally {
      setBundleLoading(false)
    }
  }

  // Derived state
  const selectedCount = selectedTaskIds.size

  return (
    <div className="planning-page">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="planning-page-header">
        <div>
          <p className="shell-eyebrow">Planning / Coordination</p>
          <h2 className="planning-title">Bundle Candidates</h2>
          <p className="planning-subtitle">
            Identify maintenance tasks that can be efficiently coordinated into a
            single block to minimize track downtime and maximize asset utilization.
          </p>
        </div>

        {bundles.length > 0 && (
          <div className="bcv-metrics-ribbon">
            <div className="bcv-metric">
              <span>Candidates</span>
              <strong>{bundles.length}</strong>
            </div>
            <div className="bcv-metric">
              <span>Total downtime saved</span>
              <strong>
                {bundles.reduce((acc, b) => acc + b.downtime_saved_minutes, 0)}{' '}
                min
              </strong>
            </div>
          </div>
        )}
      </header>

      <div className="bcv-workspace">
        {/* ── Left Pane: Task Selection ─────────────────────────────────── */}
        <div className="bcv-pane bcv-tasks-pane">
          <div className="bcv-pane-header">
            <div className="bcv-pane-title">
              <Route className="h-4 w-4 text-slate-400" />
              <h3>1. Select Maintenance Tasks</h3>
            </div>
            
            <div className="bcv-section-picker">
              {sectionsLoading ? (
                <span className="bcv-loading-text">Loading sections...</span>
              ) : (
                <select
                  className="input bcv-select-small"
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  disabled={tasksLoading || bundleLoading}
                  aria-label="Select railway section"
                >
                  <option value="">— select section —</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="bcv-tasks-container">
            {tasksLoading ? (
              <div className="bcv-state-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                <p>Loading pending tasks...</p>
              </div>
            ) : tasksError ? (
              <div className="bcv-state-center is-error">
                <AlertTriangle className="h-6 w-6" />
                <p>{tasksError}</p>
                <button type="button" onClick={() => setSectionId(sectionId)}>Retry</button>
              </div>
            ) : !sectionId ? (
              <div className="bcv-state-center">
                <Info className="h-6 w-6 text-slate-500" />
                <p>Select a section to view eligible maintenance tasks.</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="bcv-state-center">
                <CheckSquare className="h-6 w-6 text-emerald-500" />
                <p>No pending tasks found for this section.</p>
              </div>
            ) : (
              <table className="bcv-task-table">
                <thead>
                  <tr>
                    <th className="bcv-col-chk">
                      <button type="button" onClick={toggleAll} aria-label="Toggle all tasks">
                        {selectedCount === tasks.length ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th>Task ID</th>
                    <th>Dept</th>
                    <th>Duration</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => {
                    const isSelected = selectedTaskIds.has(task.id)
                    return (
                      <tr 
                        key={task.id} 
                        className={isSelected ? 'is-selected' : ''}
                        onClick={() => toggleTask(task.id)}
                      >
                        <td className="bcv-col-chk">
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-600" />
                          )}
                        </td>
                        <td>
                          <span className="bcv-mono">{task.task_code}</span>
                        </td>
                        <td>
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
                        </td>
                        <td>{task.duration_minutes}m</td>
                        <td>
                          <span className={`bcv-pri-dot pri-${task.severity}`} />
                          {Math.round(task.priority_score)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Analysis footer */}
          <div className="bcv-tasks-footer">
            <div className="bcv-selection-status">
              {selectedCount > 0 ? (
                <span><strong>{selectedCount}</strong> task{selectedCount !== 1 ? 's' : ''} selected</span>
              ) : (
                <span className="text-slate-500">Select tasks to analyze</span>
              )}
            </div>

            <div className="bcv-analyze-controls">
              <select
                className="input bcv-select-small"
                value={method}
                onChange={(e) => setMethod(e.target.value as BundleMethod)}
                disabled={bundleLoading}
                aria-label="Bundling algorithm"
              >
                <option value="dbscan">DBSCAN (Optimal)</option>
                <option value="pairwise">Pairwise (Baseline)</option>
              </select>

              <button
                className="pgv-generate-btn"
                type="button"
                onClick={() => void findBundles()}
                disabled={selectedCount < 2 || bundleLoading}
              >
                {bundleLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" /> Analyze Candidates
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Pane: Bundle Candidates ─────────────────────────────── */}
        <div className="bcv-pane bcv-results-pane">
          <div className="bcv-pane-header">
            <div className="bcv-pane-title">
              <Combine className="h-4 w-4 text-emerald-400" />
              <h3>2. Recommended Bundles</h3>
            </div>
          </div>

          <div className="bcv-results-container">
            {bundleLoading ? (
              <div className="bcv-state-center">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                <p>Generating bundle candidates...</p>
              </div>
            ) : bundleError ? (
              <div className="bcv-state-center is-error">
                <AlertTriangle className="h-6 w-6" />
                <p>{bundleError}</p>
              </div>
            ) : bundles.length === 0 && selectedCount > 0 && selectedTaskIds.size >= 2 ? (
              <div className="bcv-state-center">
                <Layers3 className="h-8 w-8 text-slate-600 mb-2" />
                <p>No candidates generated yet.</p>
                <span className="text-xs text-slate-500 mt-2">Click "Analyze Candidates" when ready.</span>
              </div>
            ) : bundles.length === 0 ? (
              <div className="bcv-state-center">
                <Combine className="h-8 w-8 text-slate-600 mb-2" />
                <p>Select at least 2 tasks to identify bundles.</p>
              </div>
            ) : (
              <div className="bcv-bundle-list">
                {bundles.map((bundle, idx) => {
                  // Resolve the actual tasks from the bundle's task_ids
                  const bundledTasks = bundle.task_ids
                    .map((id) => tasks.find((t) => t.id === id))
                    .filter(Boolean) as Task[]
                  
                  return (
                    <div key={idx} className="bcv-bundle-card">
                      <div className="bcv-bundle-card-header">
                        <div className="bcv-bundle-title">
                          <Layers3 className="h-4 w-4 text-emerald-400" />
                          <strong>Candidate #{idx + 1}</strong>
                        </div>
                        <span className="bcv-bundle-badge">
                          {bundledTasks.length} tasks
                        </span>
                      </div>
                      
                      <div className="bcv-bundle-metrics">
                        <div>
                          <span>Required Block Time</span>
                          <strong>
                            <Clock3 className="h-3.5 w-3.5" />
                            {bundle.bundle_duration_minutes} min
                          </strong>
                        </div>
                        <div className="is-highlight">
                          <span>Track Downtime Saved</span>
                          <strong>
                            <Timer className="h-3.5 w-3.5" />
                            {bundle.downtime_saved_minutes} min
                          </strong>
                        </div>
                      </div>

                      <div className="bcv-bundle-tasks">
                        <div className="bcv-bundle-tasks-title">Included Tasks</div>
                        {bundledTasks.map((t) => (
                          <div key={t.id} className="bcv-bundled-task-row">
                            <span className="bcv-mono">{t.task_code}</span>
                            <span
                              className="task-dept"
                              style={{ color: t.department.color_hex }}
                            >
                              <i
                                style={{
                                  height: 6,
                                  width: 6,
                                  borderRadius: '50%',
                                  background: t.department.color_hex,
                                  display: 'inline-block',
                                }}
                              />
                              {t.department.code}
                            </span>
                            <span className="bcv-task-dur">{t.duration_minutes}m</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="bcv-bundle-rationale">
                        <Zap className="h-3.5 w-3.5 text-amber-400" />
                        <p>
                          Executing these tasks simultaneously on section <strong>{bundle.section}</strong>{' '}
                          will save <strong>{bundle.downtime_saved_minutes} minutes</strong> compared to consecutive execution.
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}