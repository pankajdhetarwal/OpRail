import { useState } from 'react'
import {
  AlertTriangle,
  Layers3,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react'

import { api } from '../../core/api/client'
import type { BundleCandidate } from '../../types/api'

type BundleMethod = 'pairwise' | 'dbscan'

type BundleTaskRow = {
  task_id: string
  section: string
  start_minute: string
  end_minute: string
}

export function BundleCandidatesView() {
  const [method, setMethod] = useState<BundleMethod>('pairwise')

  const [rows, setRows] = useState<BundleTaskRow[]>([
    {
      task_id: '',
      section: '',
      start_minute: '',
      end_minute: '',
    },
  ])

  const [bundles, setBundles] = useState<BundleCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const updateRow = (
    index: number,
    field: keyof BundleTaskRow,
    value: string,
  ) => {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    )
  }

  const addRow = () => {
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

  const removeRow = (index: number) => {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
  }

  const findBundles = async () => {
    setLoading(true)
    setError('')

    try {
      const tasks = rows
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
        }))
        .filter(
          (task) =>
            Number.isFinite(task.task_id) &&
            Number.isFinite(task.start_minute) &&
            Number.isFinite(task.end_minute),
        )

      if (!tasks.length) {
        setBundles([])
        setError('Enter at least one complete maintenance task.')
        return
      }

      const response = await api.bundleCandidates(
        {
          tasks,
        },
        method,
      )

      setBundles(response.bundles ?? [])
    } catch (reason: unknown) {
      setBundles([])
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to find bundle candidates.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="planning-page">
      {/* Header */}
      <header className="planning-page-header">
        <div>
          <p className="shell-eyebrow">Planning / Coordination</p>

          <h2 className="planning-title">Bundle Candidates</h2>

          <p className="planning-subtitle">
            Identify maintenance tasks that can potentially be coordinated
            within the same railway maintenance block.
          </p>
        </div>

        <div className="planning-status">
          <span
            className={`status-dot ${loading ? '' : 'is-healthy'}`}
          />

          {loading
            ? 'Bundle analysis running'
            : bundles.length
              ? `${bundles.length} candidate${bundles.length === 1 ? '' : 's'} found`
              : 'Ready for analysis'}
        </div>
      </header>

      {/* Controls */}
      <section className="planning-control-surface">
        <div className="planning-control-heading">
          <div>
            <p className="shell-eyebrow">Bundle analysis</p>

            <h3>Coordination parameters</h3>
          </div>

          <span className="planning-control-note">
            Candidate generation uses the existing bundle API
          </span>
        </div>

        {/* Method */}
        <div className="bundle-controls">
          <label>
            <span>Method</span>

            <select
              className="input"
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as BundleMethod)
              }
            >
              <option value="pairwise">Pairwise</option>
              <option value="dbscan">DBSCAN</option>
            </select>
          </label>

          <button
            className="planning-secondary-button"
            type="button"
            onClick={addRow}
          >
            Add task input
          </button>

          <button
            className="planning-secondary-button"
            type="button"
            onClick={() => void findBundles()}
            disabled={loading || rows.length === 0}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}

            {loading ? 'Analyzing...' : 'Find candidates'}
          </button>
        </div>

        {/* Task inputs */}
        <div className="mt-5 space-y-3">
          {rows.map((row, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-4 md:grid-cols-[1fr_1.2fr_1fr_1fr_auto]"
            >
              <label>
                <span>Task ID</span>

                <input
                  className="input"
                  type="number"
                  min="1"
                  placeholder="101"
                  value={row.task_id}
                  onChange={(event) =>
                    updateRow(index, 'task_id', event.target.value)
                  }
                />
              </label>

              <label>
                <span>Section</span>

                <input
                  className="input"
                  type="text"
                  placeholder="SEC-01"
                  value={row.section}
                  onChange={(event) =>
                    updateRow(index, 'section', event.target.value)
                  }
                />
              </label>

              <label>
                <span>Start minute</span>

                <input
                  className="input"
                  type="number"
                  min="0"
                  max="1439"
                  placeholder="120"
                  value={row.start_minute}
                  onChange={(event) =>
                    updateRow(index, 'start_minute', event.target.value)
                  }
                />
              </label>

              <label>
                <span>End minute</span>

                <input
                  className="input"
                  type="number"
                  min="0"
                  max="1439"
                  placeholder="240"
                  value={row.end_minute}
                  onChange={(event) =>
                    updateRow(index, 'end_minute', event.target.value)
                  }
                />
              </label>

              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={rows.length === 1}
                className="self-end rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Start and end values use minutes from midnight. Example: 120 = 02:00.
        </p>
      </section>

      {/* Error */}
      {error ? (
        <div className="planning-error">
          <AlertTriangle className="h-4 w-4" />

          <span>{error}</span>

          <button
            type="button"
            onClick={() => void findBundles()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Results */}
      <section className="planning-context-grid">
        <div className="planning-panel">
          <div className="planning-panel-header">
            <div>
              <p className="shell-eyebrow">Optimization output</p>

              <h3>Candidate bundles</h3>
            </div>

            <button
              type="button"
              onClick={() => void findBundles()}
              disabled={loading}
              className="planning-secondary-button"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  loading ? 'animate-spin' : ''
                }`}
              />

              Refresh
            </button>
          </div>

          {!bundles.length ? (
            <div className="planning-initial">
              <Layers3 className="h-7 w-7" />

              <h3>No bundle candidates yet</h3>

              <p>
                Enter maintenance tasks above and run the analysis to inspect
                potential coordination opportunities.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bundles.map((bundle, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-white/10 bg-slate-950/50 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Bundle candidate #{index + 1}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Generated using {method.toUpperCase()} analysis
                      </p>
                    </div>

                    <Layers3 className="h-5 w-5 text-cyan-300" />
                  </div>

                  <pre className="mt-4 overflow-x-auto rounded-lg border border-white/5 bg-black/20 p-3 text-xs leading-5 text-slate-300">
                    {JSON.stringify(bundle, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}