import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { api } from '../../core/api/client'
import type { PlanValidateResponse } from '../../types/api'
import { Panel } from '../../components/common'

const formatDate = (date: Date) => date.toISOString().slice(0, 10)

export function ConflictValidatorView() {
  const [sectionId, setSectionId] = useState('')
  const [date, setDate] = useState(formatDate(new Date()))
  const [startTime, setStartTime] = useState('02:00')
  const [endTime, setEndTime] = useState('04:00')

  const [result, setResult] = useState<PlanValidateResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validate = async () => {
    setLoading(true)
    setResult(null)
    setError('')

    try {
      const response = await api.validatePlan({
        section_id: Number(sectionId),
        date,
        start_time: startTime,
        end_time: endTime,
      })

      setResult(response)
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to validate this block window.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="planning-page">
      <header className="planning-page-header">
        <div>
          <p className="shell-eyebrow">Planning / Validation</p>
          <h2 className="planning-title">Conflict Validator</h2>
          <p className="planning-subtitle">
            Check a proposed maintenance block against train movements.
          </p>
        </div>
      </header>

      <Panel
        title="Manual block validator"
        actions={<span className="panel-meta">Train conflict check</span>}
      >
        <div className="validator-grid">
          <label>
            <span>Section ID</span>
            <input
              className="input"
              type="number"
              placeholder="Section ID"
              value={sectionId}
              onChange={(event) => setSectionId(event.target.value)}
            />
          </label>

          <label>
            <span>Date</span>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>

          <label>
            <span>Start</span>
            <input
              className="input"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </label>

          <label>
            <span>End</span>
            <input
              className="input"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </label>
        </div>

        <button
          className="planning-secondary-button"
          type="button"
          disabled={loading || !sectionId}
          onClick={() => void validate()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldAlert className="h-4 w-4" />
          )}
          Validate block window
        </button>

        {error ? (
          <div className="planning-inline-error">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        ) : null}

        {result ? (
          <div
            className={`validator-result ${
              result.valid ? 'is-clear' : 'is-conflict'
            }`}
          >
            <span>
              {result.valid ? <CheckCircle2 /> : <XCircle />}
            </span>

            <div>
              <strong>{result.valid ? 'CLEAR' : 'CONFLICT'}</strong>
              <p>{result.message}</p>

              {result.conflict_train ? (
                <small>
                  {result.conflict_train}
                  {result.conflict_time
                    ? ` · ${result.conflict_time}`
                    : ''}
                </small>
              ) : null}
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  )
}