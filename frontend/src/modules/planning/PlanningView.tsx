import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Layers3,
  Loader2,
  RefreshCw,
  Route,
  ShieldAlert,
  TrainFront,
  XCircle,
} from 'lucide-react'
import { api } from '../../core/api/client'
import type {
  BlockWindow,
  BundleCandidate,
  PlanBlock,
  PlanGenerateResponse,
  PlanHistoryResponse,
  Task,
  TrainSchedule,
} from '../../types/api'
import { EmptyState, OperationalStatus, Panel } from '../../components/common'
import { deptAccent, toMinutes } from '../../utils/format'

const horizons = [
  { label: 'Weekly', value: '7' },
  { label: 'Monthly', value: '30' },
]

const departments = [
  { code: 'ENG', label: 'Engineering' },
  { code: 'ST', label: 'Signal & Telecom' },
  { code: 'OHE', label: 'Traction / OHE' },
]

const formatDate = (date: Date) => date.toISOString().slice(0, 10)

const clockMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

const intervalEnd = (start: number, end: number) =>
  end < start ? end + 1440 : end

const displayDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(`${value}T00:00:00`))

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
    ...blocks.flatMap((block) => {
      const start = toMinutes(block.start_time)
      return [
        start,
        intervalEnd(start, toMinutes(block.end_time)),
      ]
    }),
    ...trains.flatMap((train) => {
      const start = clockMinutes(train.entry_time)
      return [
        start,
        intervalEnd(start, clockMinutes(train.exit_time)),
      ]
    }),
    ...windows.flatMap((window) => {
      const start = clockMinutes(window.start_time)
      return [
        start,
        intervalEnd(start, clockMinutes(window.end_time)),
      ]
    }),
  ]

  const firstMinute =
    allTimes.length > 0
      ? Math.max(
          0,
          Math.floor((Math.min(...allTimes) - 60) / 60) * 60,
        )
      : 0

  const lastMinute =
    allTimes.length > 0
      ? Math.min(
          24 * 60,
          Math.ceil((Math.max(...allTimes) + 60) / 60) * 60,
        )
      : 24 * 60

  const span = Math.max(240, lastMinute - firstMinute)

  const ticks = Array.from(
    { length: Math.floor(span / 60) + 1 },
    (_, index) => firstMinute + index * 60,
  )

  const laneNames = [
    ...new Set([
      ...trains.map((train) => `TRAIN ${train.train_no}`),
      ...blocks.map((block) => block.section_code),
    ]),
  ]

  const position = (minute: number) =>
    `${Math.max(
      0,
      Math.min(100, ((minute - firstMinute) / span) * 100),
    )}%`

  const width = (start: number, end: number) =>
    `${Math.max(
      2,
      ((intervalEnd(start, end) - start) / span) * 100,
    )}%`

  return (
    <div
      className="planning-timeline"
      aria-label="Generated maintenance blocks and timetable context"
    >
      <div className="planning-timeline-scroll">
        <div
          className="timeline-canvas"
          style={{
            minWidth: `${Math.max(860, ticks.length * 116)}px`,
          }}
        >
          <div className="timeline-axis">
            <div className="timeline-lane-label">TIME / LANE</div>

            <div className="timeline-axis-track">
              {ticks.map((tick) => (
                <span
                  key={tick}
                  style={{ left: position(tick) }}
                >
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
                      style={{ left: position(tick) }}
                    />
                  ))}

                  {trains
                    .filter(
                      (train) =>
                        `TRAIN ${train.train_no}` === lane,
                    )
                    .map((train) => (
                      <div
                        className="train-bar"
                        key={train.id}
                        style={{
                          left: position(
                            clockMinutes(train.entry_time),
                          ),
                          width: width(
                            clockMinutes(train.entry_time),
                            clockMinutes(train.exit_time),
                          ),
                        }}
                        title={`${train.train_no} ${
                          train.train_name || ''
                        } · ${train.entry_time}-${train.exit_time}`}
                      >
                        <TrainFront
                          className="h-3 w-3"
                          aria-hidden="true"
                        />
                        {train.train_no}
                      </div>
                    ))}

                  {windows
                    .filter((window) =>
                      blocks.some(
                        (block) =>
                          block.section_code === lane &&
                          block.section_id === window.section_id,
                      ),
                    )
                    .map((window) => (
                      <span
                        className="window-band"
                        key={window.id}
                        style={{
                          left: position(
                            clockMinutes(window.start_time),
                          ),
                          width: width(
                            clockMinutes(window.start_time),
                            clockMinutes(window.end_time),
                          ),
                        }}
                        title={`Available window · ${window.start_time}-${window.end_time} · ${window.duration_minutes} minutes`}
                      />
                    ))}

                  {blocks
                    .filter(
                      (block) => block.section_code === lane,
                    )
                    .map((block) => (
                      <button
                        className={`timeline-block ${
                          selectedId === block.id
                            ? 'is-selected'
                            : ''
                        }`}
                        key={block.id}
                        type="button"
                        style={{
                          left: position(
                            toMinutes(block.start_time),
                          ),
                          width: width(
                            toMinutes(block.start_time),
                            toMinutes(block.end_time),
                          ),
                        }}
                        onClick={() => onSelect(block.id)}
                        title={`${block.section_code}: ${block.start_time}-${block.end_time}`}
                      >
                        <span>
                          {block.departments_involved.join(' / ')}
                        </span>
                        <b>
                          {block.start_time}-{block.end_time}
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

function BlockDetails({
  block,
}: {
  block: PlanBlock | undefined
}) {
  if (!block) {
    return (
      <EmptyState label="Select a block to inspect its operational details." />
    )
  }

  return (
    <div className="block-details">
      <div className="block-detail-heading">
        <div>
          <p className="shell-eyebrow">
            Selected block / {block.id}
          </p>

          <h3>
            {block.section_code} · {block.section_name}
          </h3>
        </div>

        <OperationalStatus
          status={block.is_joint_block ? 'ACTIVE' : 'AVAILABLE'}
        />
      </div>

      <div className="block-detail-grid">
        <span>
          <small>Date</small>
          <b>{displayDate(block.schedule_date)}</b>
        </span>

        <span>
          <small>Window</small>
          <b>
            {block.start_time} – {block.end_time}
          </b>
        </span>

        <span>
          <small>Duration</small>
          <b>{block.duration_minutes} minutes</b>
        </span>

        <span>
          <small>Tasks</small>
          <b>{block.task_ids.length} scheduled</b>
        </span>

        <span>
          <small>Efficiency</small>
          <b>{block.efficiency_score}%</b>
        </span>

        <span>
          <small>Priority total</small>
          <b>{block.total_priority_score.toFixed(1)}</b>
        </span>
      </div>

      <div className="block-departments">
        {block.departments_involved.map((department) => (
          <span
            className={deptAccent[department] || ''}
            key={department}
          >
            {department}
          </span>
        ))}
      </div>

      <p className="block-explanation">
        {block.why_explanation ||
          'No operational explanation returned for this block.'}
      </p>
    </div>
  )
}

export function PlanningView() {
  const [startDate, setStartDate] = useState(() =>
    formatDate(new Date()),
  )

  const [endDate, setEndDate] = useState(() =>
    formatDate(new Date(Date.now() + 6 * 86400000)),
  )

  // Backend compatibility:
  // Weekly = 7, Monthly = 30.
  const [horizon, setHorizon] = useState('7')

  const [density, setDensity] = useState(1)

  const [depts, setDepts] = useState<string[]>([
    'ENG',
    'ST',
    'OHE',
  ])

  const [sectionIds, setSectionIds] = useState<number[]>([])

  const [sections, setSections] = useState<
    { id: number; name: string; code: string }[]
  >([])

  const [plan, setPlan] =
    useState<PlanGenerateResponse | null>(null)

  const [loading, setLoading] = useState(false)

  const [error, setError] = useState('')

  const [selectedBlockId, setSelectedBlockId] =
    useState<number | null>(null)

  const [history, setHistory] =
    useState<PlanHistoryResponse | null>(null)

  const [historyError, setHistoryError] = useState('')

  const [trains, setTrains] =
    useState<TrainSchedule[]>([])

  const [windows, setWindows] =
    useState<BlockWindow[]>([])

  const [coaLoading, setCoaLoading] = useState(false)

  const [coaError, setCoaError] = useState('')

  const [validator, setValidator] = useState({
    section_id: '',
    date: formatDate(new Date()),
    start_time: '02:00',
    end_time: '04:00',
  })

  const [validation, setValidation] = useState<{
    valid: boolean
    message: string
    conflict_train?: string
    conflict_time?: string
  } | null>(null)

  const [validationLoading, setValidationLoading] =
    useState(false)

  const [bundleMethod, setBundleMethod] =
    useState<'pairwise' | 'dbscan'>('pairwise')

  const [bundleRows, setBundleRows] = useState<
    {
      task_id: string
      section: string
      start_minute: string
      end_minute: string
    }[]
  >([])

  const [bundles, setBundles] = useState<BundleCandidate[]>([])

  const [bundleLoading, setBundleLoading] =
    useState(false)

  const [bundleError, setBundleError] = useState('')

  const [expandedHistory, setExpandedHistory] =
    useState<string | null>(null)

  const loadSections = useCallback(
    () =>
      api
        .tasks({
          min_severity: 1,
          limit: 500,
          skip: 0,
        })
        .then((response) => {
          const unique = new Map<
            number,
            {
              id: number
              name: string
              code: string
            }
          >()

          response.tasks.forEach((task: Task) => {
            unique.set(task.section.id, {
              id: task.section.id,
              name: task.section.name,
              code: task.section.code,
            })
          })

          setSections(
            [...unique.values()].sort((a, b) =>
              a.code.localeCompare(b.code),
            ),
          )
        })
        .catch(() => setSections([])),
    [],
  )

  const loadHistory = useCallback(() => {
    setHistoryError('')

    return api
      .planHistory(20)
      .then(setHistory)
      .catch((reason: unknown) =>
        setHistoryError(
          reason instanceof Error
            ? reason.message
            : 'Unable to load plan history.',
        ),
      )
  }, [])

  const loadCoa = useCallback(() => {
    setCoaLoading(true)
    setCoaError('')

    const query = new URLSearchParams({
      limit: '200',
    })

    const windowQuery = new URLSearchParams({
      available_only: 'true',
    })

    if (sectionIds.length === 1) {
      query.set('section_id', String(sectionIds[0]))

      windowQuery.set(
        'section_id',
        String(sectionIds[0]),
      )
    }

    if (startDate) {
      query.set('schedule_date', startDate)

      windowQuery.set('schedule_date', startDate)
    }

    return Promise.all([
      api.trains(query),
      api.windows(windowQuery),
    ])
      .then(([trainData, windowData]) => {
        setTrains(trainData)
        setWindows(windowData)
      })
      .catch((reason: unknown) =>
        setCoaError(
          reason instanceof Error
            ? reason.message
            : 'Unable to load COA timetable context.',
        ),
      )
      .finally(() => setCoaLoading(false))
  }, [sectionIds, startDate])

  useEffect(() => {
    void loadSections()
    void loadHistory()
  }, [loadHistory, loadSections])

  useEffect(() => {
    setValidator((value) => ({
      ...value,
      date: startDate,
    }))
  }, [startDate])

  useEffect(() => {
    void loadCoa()
  }, [loadCoa])

  const selectedBlock = plan?.blocks.find(
    (block) => block.id === selectedBlockId,
  )

  const groupedHistory = useMemo(
    () => history?.blocks ?? [],
    [history],
  )

  const generatePlan = async () => {
    setLoading(true)
    setError('')
    setPlan(null)
    setSelectedBlockId(null)

    try {
      const result = await api.generatePlan({
        start_date: startDate,
        end_date: endDate,

        // IMPORTANT:
        // The current backend accepts horizon as a string
        // in the request but expects an integer in the
        // response model. Therefore:
        // Weekly -> "7"
        // Monthly -> "30"
        horizon: String(horizon),

        train_density_multiplier: density,
        dept_codes: depts.length ? depts : null,
        section_ids: sectionIds.length ? sectionIds : null,
      })

      setPlan(result)

      if (result.blocks[0]) {
        setSelectedBlockId(result.blocks[0].id)
      }

      setBundleRows(
        result.blocks.flatMap((block) =>
          block.task_ids.map((taskId) => ({
            task_id: String(taskId),
            section: block.section_code,
            start_minute: String(
              toMinutes(block.start_time),
            ),
            end_minute: String(
              toMinutes(block.end_time),
            ),
          })),
        ),
      )

      void loadHistory()
      await loadCoa()
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to generate optimized plan.',
      )
    } finally {
      setLoading(false)
    }
  }

  const validateWindow = async () => {
    setValidationLoading(true)
    setValidation(null)

    try {
      const result = await api.validatePlan({
        ...validator,
        section_id: Number(validator.section_id),
      })

      setValidation(result)
    } catch (reason: unknown) {
      setValidation({
        valid: false,
        message:
          reason instanceof Error
            ? reason.message
            : 'Unable to validate this block window.',
      })
    } finally {
      setValidationLoading(false)
    }
  }

  const findBundles = async () => {
    setBundleLoading(true)
    setBundleError('')

    try {
      const response = await api.bundleCandidates(
        {
          tasks: bundleRows
            .filter(
              (row) =>
                row.task_id &&
                row.section &&
                row.start_minute &&
                row.end_minute,
            )
            .map((row) => ({
              task_id: Number(row.task_id),
              section: row.section,
              start_minute: Number(row.start_minute),
              end_minute: Number(row.end_minute),
            })),
        },
        bundleMethod,
      )

      setBundles(response.bundles)
    } catch (reason: unknown) {
      setBundles([])

      setBundleError(
        reason instanceof Error
          ? reason.message
          : 'Unable to find bundle candidates.',
      )
    } finally {
      setBundleLoading(false)
    }
  }

  return (
    <div className="planning-page">
      <header className="planning-page-header">
        <div>
          <p className="shell-eyebrow">
            Planning / Control workspace
          </p>

          <h2 className="planning-title">
            Block Planning Workspace
          </h2>

          <p className="planning-subtitle">
            Coordinate maintenance blocks across departments
            against the operating timetable.
          </p>
        </div>

        <div className="planning-status">
          <span
            className={`status-dot ${
              loading ? '' : 'is-healthy'
            }`}
          />

          {loading
            ? 'Optimizer running'
            : plan
              ? 'Plan generated'
              : 'Ready for planning'}
        </div>
      </header>

      <section className="planning-control-surface">
        <div className="planning-control-heading">
          <div>
            <p className="shell-eyebrow">
              Planning controls
            </p>

            <h3>Optimization parameters</h3>
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
              onChange={(event) =>
                setStartDate(event.target.value)
              }
            />
          </label>

          <label>
            <span>End date</span>

            <input
              className="input"
              type="date"
              value={endDate}
              onChange={(event) =>
                setEndDate(event.target.value)
              }
            />
          </label>

          <label>
            <span>Planning mode</span>

            <select
              className="input"
              value={horizon}
              onChange={(event) =>
                setHorizon(event.target.value)
              }
            >
              {horizons.map((item) => (
                <option
                  value={item.value}
                  key={item.value}
                >
                  {item.label}
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
              onChange={(event) =>
                setDensity(Number(event.target.value))
              }
            />
          </label>
        </div>

        <div className="planning-control-lower">
          <div className="planning-departments">
            <span>Departments</span>

            {departments.map((department) => (
              <label
                key={department.code}
                className={
                  depts.includes(department.code)
                    ? 'is-selected'
                    : ''
                }
              >
                <input
                  type="checkbox"
                  checked={depts.includes(
                    department.code,
                  )}
                  onChange={(event) =>
                    setDepts((current) =>
                      event.target.checked
                        ? [
                            ...current,
                            department.code,
                          ]
                        : current.filter(
                            (code) =>
                              code !== department.code,
                          ),
                    )
                  }
                />

                {department.code}

                <small>{department.label}</small>
              </label>
            ))}
          </div>

          <div className="planning-sections">
            <span>Railway sections</span>

            <div className="planning-section-picker">
              {sections.length ? (
                sections.map((section) => (
                  <label key={section.id}>
                    <input
                      type="checkbox"
                      checked={sectionIds.includes(
                        section.id,
                      )}
                      onChange={(event) =>
                        setSectionIds((current) =>
                          event.target.checked
                            ? [
                                ...current,
                                section.id,
                              ]
                            : current.filter(
                                (id) =>
                                  id !== section.id,
                              ),
                        )
                      }
                    />

                    {section.code}

                    <small>{section.name}</small>
                  </label>
                ))
              ) : (
                <span className="planning-muted">
                  Loading section inventory...
                </span>
              )}
            </div>
          </div>

          <button
            className="planning-generate-button"
            type="button"
            onClick={() => void generatePlan()}
            disabled={
              loading || !startDate || !endDate
            }
          >
            <Route className="h-4 w-4" />

            {loading
              ? 'Optimizing plan...'
              : 'Generate optimized plan'}
          </button>
        </div>

        {error ? (
          <div className="planning-error">
            <AlertTriangle className="h-4 w-4" />

            {error}

            <button
              type="button"
              onClick={() => void generatePlan()}
            >
              Retry
            </button>
          </div>
        ) : null}
      </section>

      <section
        className="planning-summary-grid"
        aria-label="Optimization status"
      >
        <SummaryMetric
          label="Blocks generated"
          value={plan ? plan.total_blocks : '—'}
          icon={Layers3}
        />

        <SummaryMetric
          label="Tasks scheduled"
          value={
            plan ? plan.total_tasks_scheduled : '—'
          }
          icon={CheckCircle2}
        />

        <SummaryMetric
          label="Joint blocks"
          value={plan ? plan.joint_blocks : '—'}
          icon={Database}
        />

        <SummaryMetric
          label="Tasks dropped"
          value={plan ? plan.tasks_dropped : '—'}
          icon={ShieldAlert}
        />

        <SummaryMetric
          label="Average efficiency"
          value={
            plan ? `${plan.avg_efficiency}%` : '—'
          }
          icon={Clock3}
        />

        <SummaryMetric
          label="Availability"
          value={
            plan
              ? `${plan.asset_availability_pct}%`
              : '—'
          }
          icon={TrainFront}
        />
      </section>

      <section className="planning-main-grid">
        <Panel
          title="Planning timeline"
          actions={
            <span className="panel-meta">
              {plan
                ? `${plan.blocks.length} generated block${
                    plan.blocks.length === 1
                      ? ''
                      : 's'
                  }`
                : 'No optimized plan generated yet'}
            </span>
          }
        >
          {plan ? (
            <Timeline
              blocks={plan.blocks}
              trains={trains}
              windows={windows}
              selectedId={selectedBlockId}
              onSelect={setSelectedBlockId}
            />
          ) : (
            <div className="planning-initial">
              <Route className="h-7 w-7" />

              <h3>
                No optimized plan generated yet
              </h3>

              <p>
                Set the planning parameters and generate a
                plan to inspect blocks against timetable
                constraints.
              </p>
            </div>
          )}

          {coaLoading ? (
            <div className="planning-loading">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading COA timetable context
            </div>
          ) : null}

          {coaError ? (
            <div className="planning-inline-error">
              <AlertTriangle className="h-4 w-4" />

              {coaError}

              <button
                type="button"
                onClick={() => void loadCoa()}
              >
                Retry
              </button>
            </div>
          ) : null}
        </Panel>

        <Panel
          title="Selected block"
          actions={
            <span className="panel-meta">
              Operational detail
            </span>
          }
        >
          <BlockDetails block={selectedBlock} />
        </Panel>
      </section>

      <section className="planning-context-grid">
        <Panel
          title="Train operations context"
          actions={
            <span className="panel-meta">
              COA · {startDate}
            </span>
          }
        >
          {trains.length ? (
            <div className="planning-train-list">
              {trains.slice(0, 10).map((train) => (
                <div
                  className="planning-train-row"
                  key={train.id}
                >
                  <span className="train-time">
                    {train.entry_time}
                  </span>

                  <span className="train-line">
                    <TrainFront className="h-3.5 w-3.5" />

                    {train.train_no}

                    <small>
                      {train.train_name ||
                        train.train_type}{' '}
                      · {train.direction}
                    </small>
                  </span>

                  <span
                    className={`train-priority is-${train.train_priority}`}
                  >
                    {train.train_priority}
                  </span>

                  <span>{train.exit_time}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No COA train movements returned for this date and section scope." />
          )}
        </Panel>

        <Panel
          title="Available COA windows"
          actions={
            <span className="panel-meta">
              {windows.length} available
            </span>
          }
        >
          {windows.length ? (
            <div className="planning-window-list">
              {windows.slice(0, 8).map((window) => (
                <div
                  className="planning-window-row"
                  key={window.id}
                >
                  <span className="window-time">
                    {window.start_time} – {window.end_time}
                  </span>

                  <span>
                    Section {window.section_id}
                  </span>

                  <span>
                    {window.duration_minutes} min
                  </span>

                  <OperationalStatus status="AVAILABLE" />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No available windows returned for the current date and scope." />
          )}
        </Panel>
      </section>

      <section className="planning-lower-grid">
        <Panel
          title="Plan history"
          actions={
            <button
              className="planning-icon-action"
              type="button"
              onClick={() => void loadHistory()}
              aria-label="Refresh plan history"
              title="Refresh plan history"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          }
        >
          {historyError ? (
            <div className="planning-inline-error">
              <AlertTriangle className="h-4 w-4" />

              {historyError}

              <button
                type="button"
                onClick={() => void loadHistory()}
              >
                Retry
              </button>
            </div>
          ) : !history ? (
            <div className="planning-loading">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading plan history
            </div>
          ) : groupedHistory.length ? (
            <div className="planning-history-list">
              {groupedHistory.map((block) => {
                const key = `${block.id}-${block.run_id}`

                return (
                  <button
                    className={`planning-history-item ${
                      expandedHistory === key
                        ? 'is-expanded'
                        : ''
                    }`}
                    type="button"
                    key={key}
                    onClick={() =>
                      setExpandedHistory((value) =>
                        value === key ? null : key,
                      )
                    }
                  >
                    <div>
                      <strong>
                        {block.run_id ||
                          `Block ${block.id}`}
                      </strong>

                      <span>
                        {block.section_code ||
                          `Section ${block.section_id}`}{' '}
                        · {block.schedule_date}
                      </span>
                    </div>

                    <ChevronRight className="history-chevron" />

                    <span className="history-time">
                      {block.start_time} –{' '}
                      {block.end_time}
                    </span>

                    {expandedHistory === key ? (
                      <div className="history-expanded">
                        {block.duration_minutes} minutes ·{' '}
                        {block.efficiency_score}% efficiency ·{' '}
                        {block.task_ids.length} task IDs
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : (
            <EmptyState label="No historical plans found." />
          )}
        </Panel>

        <Validator
          validator={validator}
          setValidator={setValidator}
          validation={validation}
          loading={validationLoading}
          onSubmit={() => void validateWindow()}
        />
      </section>

      <BundlePanel
        rows={bundleRows}
        setRows={setBundleRows}
        method={bundleMethod}
        setMethod={setBundleMethod}
        bundles={bundles}
        error={bundleError}
        loading={bundleLoading}
        onSubmit={() => void findBundles()}
      />
    </div>
  )
}

function SummaryMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: typeof Layers3
}) {
  return (
    <div className="planning-summary-metric">
      <Icon className="h-4 w-4" />

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

function Validator({
  validator,
  setValidator,
  validation,
  loading,
  onSubmit,
}: {
  validator: {
    section_id: string
    date: string
    start_time: string
    end_time: string
  }

  setValidator: React.Dispatch<
    React.SetStateAction<{
      section_id: string
      date: string
      start_time: string
      end_time: string
    }>
  >

  validation: {
    valid: boolean
    message: string
    conflict_train?: string
    conflict_time?: string
  } | null

  loading: boolean
  onSubmit: () => void
}) {
  return (
    <Panel
      title="Manual block validator"
      actions={
        <span className="panel-meta">
          Train conflict check
        </span>
      }
    >
      <div className="validator-grid">
        <label>
          <span>Section ID</span>

          <input
            className="input"
            type="number"
            placeholder="Section ID"
            value={validator.section_id}
            onChange={(event) =>
              setValidator((value) => ({
                ...value,
                section_id: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Date</span>

          <input
            className="input"
            type="date"
            value={validator.date}
            onChange={(event) =>
              setValidator((value) => ({
                ...value,
                date: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Start</span>

          <input
            className="input"
            type="time"
            value={validator.start_time}
            onChange={(event) =>
              setValidator((value) => ({
                ...value,
                start_time: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>End</span>

          <input
            className="input"
            type="time"
            value={validator.end_time}
            onChange={(event) =>
              setValidator((value) => ({
                ...value,
                end_time: event.target.value,
              }))
            }
          />
        </label>
      </div>

      <button
        className="planning-secondary-button"
        type="button"
        disabled={loading || !validator.section_id}
        onClick={onSubmit}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShieldAlert className="h-4 w-4" />
        )}

        Validate block window
      </button>

      {validation ? (
        <div
          className={`validator-result ${
            validation.valid
              ? 'is-clear'
              : 'is-conflict'
          }`}
        >
          <span>
            {validation.valid ? (
              <CheckCircle2 />
            ) : (
              <XCircle />
            )}
          </span>

          <div>
            <strong>
              {validation.valid
                ? 'CLEAR'
                : 'CONFLICT'}
            </strong>

            <p>{validation.message}</p>

            {validation.conflict_train ? (
              <small>
                {validation.conflict_train}

                {validation.conflict_time
                  ? ` · ${validation.conflict_time}`
                  : ''}
              </small>
            ) : null}
          </div>
        </div>
      ) : null}
    </Panel>
  )
}

function BundlePanel({
  rows,
  setRows,
  method,
  setMethod,
  bundles,
  error,
  loading,
  onSubmit,
}: {
  rows: {
    task_id: string
    section: string
    start_minute: string
    end_minute: string
  }[]

  setRows: React.Dispatch<
    React.SetStateAction<
      {
        task_id: string
        section: string
        start_minute: string
        end_minute: string
      }[]
    >
  >

  method: 'pairwise' | 'dbscan'

  setMethod: (
    method: 'pairwise' | 'dbscan',
  ) => void

  bundles: BundleCandidate[]

  error: string

  loading: boolean

  onSubmit: () => void
}) {
  const update = (
    index: number,
    key: keyof (typeof rows)[number],
    value: string,
  ) => {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? { ...row, [key]: value }
          : row,
      ),
    )
  }

  return (
    <Panel
      title="Coordination opportunities"
      actions={
        <span className="panel-meta">
          Bundle candidates
        </span>
      }
    >
      <div className="bundle-controls">
        <label>
          <span>Method</span>

          <select
            className="input"
            value={method}
            onChange={(event) =>
              setMethod(
                event.target.value as
                  | 'pairwise'
                  | 'dbscan',
              )
            }
          >
            <option value="pairwise">
              Pairwise
            </option>

            <option value="dbscan">
              DBSCAN
            </option>
          </select>
        </label>

        <button
          className="planning-secondary-button"
          type="button"
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                task_id: '',
                section: '',
                start_minute: '',
                end_minute: '',
              },
            ])
          }
        >
          Add task input
        </button>

        <button
          className="planning-secondary-button"
          type="button"
          onClick={onSubmit}
          disabled={loading || !rows.length}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Layers3 className="h-4 w-4" />
          )}

          Find candidates
        </button>
      </div>

      {rows.length ? (
        <div className="bundle-inputs">
          {rows.map((row, index) => (
            <div
              className="bundle-input-row"
              key={index}
            >
              <input
                className="input"
                placeholder="Task ID"
                value={row.task_id}
                onChange={(event) =>
                  update(
                    index,
                    'task_id',
                    event.target.value,
                  )
                }
              />

              <input
                className="input"
                placeholder="Section"
                value={row.section}
                onChange={(event) =>
                  update(
                    index,
                    'section',
                    event.target.value,
                  )
                }
              />

              <input
                className="input"
                placeholder="Start minute"
                value={row.start_minute}
                onChange={(event) =>
                  update(
                    index,
                    'start_minute',
                    event.target.value,
                  )
                }
              />

              <input
                className="input"
                placeholder="End minute"
                value={row.end_minute}
                onChange={(event) =>
                  update(
                    index,
                    'end_minute',
                    event.target.value,
                  )
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState label="Add generated or manual task coordinates to find bundle candidates." />
      )}

      {error ? (
        <div className="planning-inline-error">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <div className="bundle-results">
        {bundles.length ? (
          bundles.map((bundle, index) => (
            <div
              className="bundle-result"
              key={`${bundle.section}-${index}`}
            >
              <div className="bundle-result-heading">
                <strong>
                  Candidate{' '}
                  {String(index + 1).padStart(2, '0')}
                </strong>

                <span>
                  Section {bundle.section}
                </span>
              </div>

              <p>
                Tasks: {bundle.task_ids.join(', ')}
              </p>

              <small>
                {bundle.bundle_duration_minutes} min
                bundle · {bundle.downtime_saved_minutes}{' '}
                min downtime saved
              </small>
            </div>
          ))
        ) : (
          <EmptyState label="No bundle candidates returned yet." />
        )}
      </div>
    </Panel>
  )
}