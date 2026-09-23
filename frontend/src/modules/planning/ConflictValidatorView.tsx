/**
 * ConflictValidatorView.tsx — Mission 10: Conflict Validator Redesign
 *
 * Backend contract:
 *   POST /api/plan/validate
 *   Request:  { section_id: number, date: string, start_time: string, end_time: string }
 *   Response: { valid: boolean, conflict_train?: string, conflict_time?: string, message: string }
 *
 * The backend validates ONE block window at a time against real train movements.
 * It returns the FIRST conflicting train it finds (or a CLEAR result).
 *
 * COA trains are loaded via GET /api/coa/trains?section_id=&schedule_date= to show
 * operational context alongside the validation result.
 *
 * All data is real. No mock conflicts. No invented severity levels.
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
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrainFront,
  X,
} from 'lucide-react'
import { api } from '../../core/api/client'
import type { PlanValidateResponse, TrainSchedule } from '../../types/api'
import { EmptyState, Panel } from '../../components/common'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SectionOption {
  id: number
  code: string
  name: string
}

/** A completed validation run kept in the history list. */
interface ValidationEntry {
  id: string               // unique: `${sectionId}-${date}-${start}-${end}-${ts}`
  ts: number               // epoch ms when run
  sectionId: number
  sectionCode: string
  sectionName: string
  date: string
  startTime: string
  endTime: string
  durationMinutes: number
  result: PlanValidateResponse
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayIso = () => new Date().toISOString().slice(0, 10)

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function durationMins(start: string, end: string): number {
  let d = timeToMinutes(end) - timeToMinutes(start)
  if (d <= 0) d += 1440            // overnight
  return d
}

function fmtTime(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(ts))
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

function trainPriorityBadge(priority: string) {
  const p = priority.toLowerCase()
  if (p === 'high') return 'cvv-train-high'
  if (p === 'medium') return 'cvv-train-mid'
  return 'cvv-train-low'
}

/** Returns true if the proposed block overlaps with a train window. */
function blockOverlapsTrain(
  blockStart: string,
  blockEnd: string,
  trainEntry: string,
  trainExit: string,
): boolean {
  const bs = timeToMinutes(blockStart)
  let be = timeToMinutes(blockEnd)
  if (be <= bs) be += 1440

  const ts = timeToMinutes(trainEntry)
  let te = timeToMinutes(trainExit)
  if (te <= ts) te += 1440

  return !(be <= ts || bs >= te)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Compact skeleton for loading the section list */
function SectionSkeleton() {
  return (
    <div className="cvv-section-skeleton">
      {[60, 80, 70].map((w, i) => (
        <span key={i} style={{ width: w }} />
      ))}
    </div>
  )
}

/** Train movement row in the operational context table */
function TrainRow({
  train,
  blockStart,
  blockEnd,
}: {
  train: TrainSchedule
  blockStart: string
  blockEnd: string
}) {
  const conflicts = blockOverlapsTrain(
    blockStart,
    blockEnd,
    train.entry_time,
    train.exit_time,
  )

  return (
    <div className={`cvv-train-row ${conflicts ? 'is-conflict' : ''}`}>
      <span className="cvv-train-no">{train.train_no}</span>
      <span className="cvv-train-name">{train.train_name ?? '—'}</span>
      <span className={`cvv-train-priority ${trainPriorityBadge(train.train_priority)}`}>
        {train.train_priority.toUpperCase()}
      </span>
      <span className="cvv-train-type">{train.train_type}</span>
      <span className="cvv-train-dir">{train.direction}</span>
      <span className="cvv-train-window">
        {train.entry_time}–{train.exit_time}
      </span>
      {conflicts ? (
        <span className="cvv-train-flag">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          OVERLAP
        </span>
      ) : (
        <span className="cvv-train-clear">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          CLEAR
        </span>
      )}
    </div>
  )
}

/** Single validation history row in the results list */
function ValidationRow({
  entry,
  isSelected,
  onSelect,
}: {
  entry: ValidationEntry
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      className={`cvv-history-row ${entry.result.valid ? 'is-clear' : 'is-conflict'} ${isSelected ? 'is-selected' : ''}`}
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`View validation: ${entry.sectionCode} ${entry.date} ${entry.startTime}–${entry.endTime}`}
    >
      {/* Status indicator */}
      <span className="cvv-history-status">
        {entry.result.valid ? (
          <ShieldCheck className="h-4 w-4" aria-label="Clear" />
        ) : (
          <ShieldAlert className="h-4 w-4" aria-label="Conflict" />
        )}
      </span>

      <span className="cvv-history-verdict">
        {entry.result.valid ? 'CLEAR' : 'CONFLICT'}
      </span>

      <span className="cvv-history-section">
        <Route className="h-3 w-3" aria-hidden="true" />
        {entry.sectionCode}
      </span>

      <span className="cvv-history-date">
        <Calendar className="h-3 w-3" aria-hidden="true" />
        {fmtDate(entry.date)}
      </span>

      <span className="cvv-history-window">
        <Clock3 className="h-3 w-3" aria-hidden="true" />
        {entry.startTime}–{entry.endTime}
      </span>

      <span className="cvv-history-dur">
        {entry.durationMinutes} min
      </span>

      <span className="cvv-history-ts">{fmtTime(entry.ts)}</span>
    </button>
  )
}

/** Detail panel shown alongside the history list when a row is selected */
function ValidationDetail({
  entry,
  trains,
  trainsLoading,
}: {
  entry: ValidationEntry
  trains: TrainSchedule[]
  trainsLoading: boolean
}) {
  const conflictingTrains = trains.filter((t) =>
    blockOverlapsTrain(entry.startTime, entry.endTime, t.entry_time, t.exit_time),
  )

  return (
    <div className="cvv-detail">
      {/* Result banner */}
      <div className={`cvv-detail-banner ${entry.result.valid ? 'is-clear' : 'is-conflict'}`}>
        <span className="cvv-detail-icon">
          {entry.result.valid ? (
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          )}
        </span>
        <div>
          <strong>{entry.result.valid ? 'CLEAR — No Conflict' : 'CONFLICT DETECTED'}</strong>
          <p>{entry.result.message}</p>
        </div>
      </div>

      {/* Block parameters */}
      <section className="cvv-detail-section">
        <h4>Block Window Parameters</h4>
        <div className="cvv-detail-grid">
          <div>
            <span>Section</span>
            <strong>{entry.sectionCode} · {entry.sectionName}</strong>
          </div>
          <div>
            <span>Schedule date</span>
            <strong>{fmtDate(entry.date)}</strong>
          </div>
          <div>
            <span>Block window</span>
            <strong>{entry.startTime}–{entry.endTime}</strong>
          </div>
          <div>
            <span>Duration</span>
            <strong>{entry.durationMinutes} min</strong>
          </div>
          <div>
            <span>Validated at</span>
            <strong>{fmtTime(entry.ts)}</strong>
          </div>
        </div>
      </section>

      {/* Conflicting train — if backend returned one */}
      {!entry.result.valid && entry.result.conflict_train && (
        <section className="cvv-detail-section cvv-conflict-detail">
          <h4>
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Conflicting Train
          </h4>
          <div className="cvv-conflict-train-card">
            <div className="cvv-conflict-train-icon">
              <TrainFront className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <strong>{entry.result.conflict_train}</strong>
              {entry.result.conflict_time && (
                <p>
                  Active window:{' '}
                  <span className="cvv-mono">{entry.result.conflict_time}</span>
                </p>
              )}
            </div>
          </div>
          <p className="cvv-conflict-explanation">
            This train is scheduled on section{' '}
            <strong>{entry.sectionCode}</strong> during the proposed block
            window and would be disrupted if the maintenance block proceeds.
          </p>
        </section>
      )}

      {/* All trains in section/date — operational context */}
      <section className="cvv-detail-section">
        <h4>
          Train Movements on {entry.sectionCode} · {fmtDate(entry.date)}
          <span className="cvv-detail-count">
            {trainsLoading ? '…' : `${trains.length} trains`}
          </span>
          {conflictingTrains.length > 0 && (
            <span className="cvv-conflict-count-badge">
              {conflictingTrains.length} overlap
            </span>
          )}
        </h4>

        {trainsLoading ? (
          <div className="cvv-loading-small">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading trains…
          </div>
        ) : trains.length === 0 ? (
          <EmptyState label="No train schedules found for this section and date." />
        ) : (
          <div className="cvv-trains-table">
            <div className="cvv-trains-header">
              <span>Train no.</span>
              <span>Name</span>
              <span>Priority</span>
              <span>Type</span>
              <span>Dir</span>
              <span>Window</span>
              <span>Status</span>
            </div>
            {trains.map((t) => (
              <TrainRow
                key={t.id}
                train={t}
                blockStart={entry.startTime}
                blockEnd={entry.endTime}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConflictValidatorView() {
  // ── Section list (derived from tasks API) ──────────────────────────────────
  const [sections, setSections] = useState<SectionOption[]>([])
  const [sectionsLoading, setSectionsLoading] = useState(true)

  // ── Form inputs ────────────────────────────────────────────────────────────
  const [sectionId, setSectionId] = useState<string>('')
  const [date, setDate] = useState(todayIso())
  const [startTime, setStartTime] = useState('02:00')
  const [endTime, setEndTime] = useState('04:00')

  // ── Validation state ───────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Validation history (session-only, not persisted) ───────────────────────
  const [history, setHistory] = useState<ValidationEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // ── COA trains for selected validation context ─────────────────────────────
  const [contextTrains, setContextTrains] = useState<TrainSchedule[]>([])
  const [contextTrainsLoading, setContextTrainsLoading] = useState(false)

  // ── Filter on history list ─────────────────────────────────────────────────
  const [filterVerdict, setFilterVerdict] = useState<'all' | 'clear' | 'conflict'>('all')
  const [searchSection, setSearchSection] = useState('')

  // ── Load section list from tasks API ──────────────────────────────────────
  const loadSections = useCallback(async () => {
    setSectionsLoading(true)
    try {
      const res = await api.tasks({ limit: 500 })
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
      const list = [...map.values()].sort((a, b) => a.code.localeCompare(b.code))
      setSections(list)
      if (list.length > 0 && !sectionId) {
        setSectionId(String(list[0].id))
      }
    } catch {
      // Sections are optional context — fail silently, user can type manually
    } finally {
      setSectionsLoading(false)
    }
  }, [sectionId])

  useEffect(() => {
    void loadSections()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load COA trains when selected entry changes ────────────────────────────
  const selectedEntry = history.find((e) => e.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedEntry) {
      setContextTrains([])
      return
    }

    const params = new URLSearchParams()
    params.set('section_id', String(selectedEntry.sectionId))
    params.set('schedule_date', selectedEntry.date)

    setContextTrainsLoading(true)
    api
      .trains(params)
      .then((trains) => setContextTrains(trains))
      .catch(() => setContextTrains([]))
      .finally(() => setContextTrainsLoading(false))
  }, [selectedId, selectedEntry?.sectionId, selectedEntry?.date]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Run validation ─────────────────────────────────────────────────────────
  const validate = useCallback(async () => {
    const numericSectionId = Number(sectionId)
    if (!numericSectionId) return

    setLoading(true)
    setError('')

    const sec = sections.find((s) => s.id === numericSectionId)

    try {
      const result = await api.validatePlan({
        section_id: numericSectionId,
        date,
        start_time: startTime,
        end_time: endTime,
      })

      const entry: ValidationEntry = {
        id: `${numericSectionId}-${date}-${startTime}-${endTime}-${Date.now()}`,
        ts: Date.now(),
        sectionId: numericSectionId,
        sectionCode: sec?.code ?? `SEC-${numericSectionId}`,
        sectionName: sec?.name ?? '',
        date,
        startTime,
        endTime,
        durationMinutes: durationMins(startTime, endTime),
        result,
      }

      setHistory((prev) => [entry, ...prev])
      setSelectedId(entry.id)
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to validate this block window. Check connection.',
      )
    } finally {
      setLoading(false)
    }
  }, [sectionId, date, startTime, endTime, sections])

  // ── Filtered history ───────────────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    const sq = searchSection.toLowerCase().trim()
    return history.filter((e) => {
      if (filterVerdict === 'clear' && !e.result.valid) return false
      if (filterVerdict === 'conflict' && e.result.valid) return false
      if (sq && !e.sectionCode.toLowerCase().includes(sq) && !e.sectionName.toLowerCase().includes(sq)) return false
      return true
    })
  }, [history, filterVerdict, searchSection])

  // ── Summary counts (from current session) ─────────────────────────────────
  const totalRuns = history.length
  const conflictCount = history.filter((e) => !e.result.valid).length
  const clearCount = history.filter((e) => e.result.valid).length

  const isFormValid = !!sectionId && !!date && !!startTime && !!endTime

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="planning-page">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <header className="planning-page-header">
        <div>
          <p className="shell-eyebrow">Planning / Validation</p>
          <h2 className="planning-title">Conflict Validator</h2>
          <p className="planning-subtitle">
            Check a proposed maintenance block window against real train
            movements on the COA schedule. Detect train-block overlaps before
            issuing a block notice.
          </p>
        </div>

        {totalRuns > 0 && (
          <div className="cvv-session-summary" aria-label="Session validation summary">
            <div className={`cvv-session-chip ${conflictCount > 0 ? 'is-conflict' : ''}`}>
              <ShieldAlert className="h-3.5 w-3.5" />
              <strong>{conflictCount}</strong>
              <span>conflict{conflictCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="cvv-session-chip is-clear">
              <ShieldCheck className="h-3.5 w-3.5" />
              <strong>{clearCount}</strong>
              <span>clear</span>
            </div>
            <span className="cvv-session-of">{totalRuns} total</span>
          </div>
        )}
      </header>

      {/* ── Validation input panel ───────────────────────────────────── */}
      <Panel
        title="Block window parameters"
        actions={
          <span className="panel-meta">
            Train conflict check · COA schedule
          </span>
        }
      >
        <div className="cvv-form">
          {/* Section picker */}
          <div className="cvv-field">
            <label htmlFor="cvv-section-select">
              <Route className="h-3.5 w-3.5" aria-hidden="true" />
              Railway section
            </label>
            {sectionsLoading ? (
              <SectionSkeleton />
            ) : sections.length > 0 ? (
              <select
                id="cvv-section-select"
                className="input"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                aria-label="Select railway section"
              >
                <option value="">— select section —</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            ) : (
              /* Fallback to numeric input if sections couldn't be loaded */
              <input
                id="cvv-section-select"
                className="input"
                type="number"
                min="1"
                placeholder="Section ID"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                aria-label="Section ID"
              />
            )}
          </div>

          {/* Date */}
          <div className="cvv-field">
            <label htmlFor="cvv-date">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              Schedule date
            </label>
            <input
              id="cvv-date"
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Schedule date"
            />
          </div>

          {/* Block start */}
          <div className="cvv-field">
            <label htmlFor="cvv-start">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              Block start
            </label>
            <input
              id="cvv-start"
              className="input"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              aria-label="Block start time"
            />
          </div>

          {/* Block end */}
          <div className="cvv-field">
            <label htmlFor="cvv-end">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              Block end
            </label>
            <input
              id="cvv-end"
              className="input"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              aria-label="Block end time"
            />
          </div>

          {/* Duration preview */}
          {startTime && endTime && (
            <div className="cvv-duration-preview">
              <Info className="h-3 w-3" aria-hidden="true" />
              <span>
                Duration:{' '}
                <strong>{durationMins(startTime, endTime)} min</strong>
              </span>
            </div>
          )}
        </div>

        {/* Validate button */}
        <div className="cvv-form-footer">
          <button
            className="pgv-generate-btn"
            type="button"
            disabled={loading || !isFormValid}
            onClick={() => void validate()}
            aria-busy={loading}
            aria-label="Validate block window against train schedule"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Checking train schedule…
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                Validate Block Window
              </>
            )}
          </button>

          {!isFormValid && !loading && (
            <span className="cvv-form-hint">
              Select a section, date and time window to validate.
            </span>
          )}
        </div>

        {/* API error */}
        {error && (
          <div className="planning-inline-error" role="alert">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {error}
            <button
              type="button"
              onClick={() => void validate()}
              aria-label="Retry validation"
            >
              Retry
            </button>
          </div>
        )}
      </Panel>

      {/* ── Validation history + detail ──────────────────────────────── */}
      {history.length === 0 ? (
        /* Initial empty state — no validations run yet */
        <Panel title="Validation results" actions={<span className="panel-meta">Session history</span>}>
          <div className="cvv-initial-empty">
            <div className="cvv-initial-icon">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3>No validations run yet</h3>
            <p>
              Configure a block window above and click{' '}
              <strong>Validate Block Window</strong>. Results will appear here
              along with the full train movement schedule for the section.
            </p>
            <div className="cvv-initial-steps">
              <div>
                <span>1</span>
                Select section
              </div>
              <div>
                <span>2</span>
                Set date &amp; time window
              </div>
              <div>
                <span>3</span>
                Validate
              </div>
              <div>
                <span>4</span>
                Review conflicts
              </div>
            </div>
          </div>
        </Panel>
      ) : (
        <div className="cvv-results-layout">
          {/* ── Left: history list ────────────────────────────────── */}
          <div className="cvv-history-pane">
            <div className="cvv-history-toolbar">
              <span className="cvv-history-title">
                Validation history
                <span className="cvv-history-count">{history.length}</span>
              </span>

              {/* Filter: verdict */}
              <div className="cvv-filter-group">
                {(['all', 'conflict', 'clear'] as const).map((v) => (
                  <button
                    key={v}
                    className={`cvv-filter-chip ${filterVerdict === v ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => setFilterVerdict(v)}
                    aria-pressed={filterVerdict === v}
                  >
                    {v === 'all' ? 'All' : v === 'conflict' ? 'Conflicts' : 'Clear'}
                  </button>
                ))}
              </div>

              {/* Search by section */}
              <div className="cvv-search-wrap cvv-search-small">
                <Search className="h-3 w-3" aria-hidden="true" />
                <input
                  className="cvv-search-input"
                  type="search"
                  placeholder="Section…"
                  value={searchSection}
                  onChange={(e) => setSearchSection(e.target.value)}
                  aria-label="Search by section"
                />
                {searchSection && (
                  <button
                    type="button"
                    onClick={() => setSearchSection('')}
                    aria-label="Clear section search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Column header */}
            <div className="cvv-history-head">
              <span>{/* icon */}</span>
              <span>Result</span>
              <span>Section</span>
              <span>Date</span>
              <span>Window</span>
              <span>Dur.</span>
              <span>Time</span>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="cvv-filtered-empty">
                <EmptyState label="No validations match the current filter." />
                <button
                  className="pgv-toggle-btn"
                  type="button"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setFilterVerdict('all')
                    setSearchSection('')
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  Clear filter
                </button>
              </div>
            ) : (
              filteredHistory.map((entry) => (
                <ValidationRow
                  key={entry.id}
                  entry={entry}
                  isSelected={entry.id === selectedId}
                  onSelect={() => setSelectedId(entry.id === selectedId ? null : entry.id)}
                />
              ))
            )}
          </div>

          {/* ── Right: detail panel ───────────────────────────────── */}
          <div className="cvv-detail-pane">
            {selectedEntry ? (
              <ValidationDetail
                entry={selectedEntry}
                trains={contextTrains}
                trainsLoading={contextTrainsLoading}
              />
            ) : (
              <div className="cvv-detail-placeholder">
                <Info className="h-5 w-5" aria-hidden="true" />
                <p>Select a validation result to inspect details and train movements.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}