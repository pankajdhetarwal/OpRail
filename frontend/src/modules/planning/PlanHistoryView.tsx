import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import { api } from '../../core/api/client'
import type { PlanBlock, PlanHistoryResponse } from '../../types/api'
import { EmptyState, Panel } from '../../components/common'

export function PlanHistoryView() {
  const [history, setHistory] = useState<PlanHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const result = await api.planHistory(50)
      setHistory(result)
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to load plan history.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const blocks: PlanBlock[] = history?.blocks ?? []

  return (
    <div className="planning-page">
      <header className="planning-page-header">
        <div>
          <p className="shell-eyebrow">Planning / History</p>
          <h2 className="planning-title">Plan History</h2>
          <p className="planning-subtitle">
            Review previously generated maintenance block plans.
          </p>
        </div>

        <button
          className="planning-secondary-button"
          type="button"
          onClick={() => void loadHistory()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </header>

      <Panel
        title="Generated plans"
        actions={
          <span className="panel-meta">
            {history ? `${history.total} records` : 'Loading'}
          </span>
        }
      >
        {error ? (
          <div className="planning-inline-error">
            <AlertTriangle className="h-4 w-4" />
            {error}
            <button type="button" onClick={() => void loadHistory()}>
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="planning-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading plan history
          </div>
        ) : blocks.length === 0 ? (
          <EmptyState label="No historical plans found." />
        ) : (
          <div className="planning-history-list">
            {blocks.map((block) => {
              const key = `${block.id}-${block.run_id ?? 'unknown'}`
              const isExpanded = expanded === key

              return (
                <button
                  className={`planning-history-item ${
                    isExpanded ? 'is-expanded' : ''
                  }`}
                  type="button"
                  key={key}
                  onClick={() =>
                    setExpanded((value) => (value === key ? null : key))
                  }
                >
                  <div>
                    <strong>{block.run_id || `Block ${block.id}`}</strong>
                    <span>
                      {block.section_code || `Section ${block.section_id}`} ·{' '}
                      {block.schedule_date}
                    </span>
                  </div>

                  <ChevronRight className="history-chevron" />

                  <span className="history-time">
                    {block.start_time} – {block.end_time}
                  </span>

                  {isExpanded ? (
                    <div className="history-expanded">
                      {block.duration_minutes} minutes ·{' '}
                      {block.efficiency_score}% efficiency ·{' '}
                      {block.task_ids.length} task IDs ·{' '}
                      {block.departments_involved.join(' / ')}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}