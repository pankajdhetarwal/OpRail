import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../core/api/client'
import type { TimeSpaceResponse } from '../../types/api'
import { EmptyState, ErrorState, LoadingState, Panel } from '../../components/common'

export function VisualizationView() {
  const [section, setSection] = useState('BBS')
  const [date, setDate] = useState('')
  const [data, setData] = useState<TimeSpaceResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const chartRows = useMemo(() => {
    if (!data) return []
    return data.trains.flatMap((t) => t.points.map((p, idx) => ({ train: t.train_number, x: p.minute, y: idx + 1, station: p.station })))
  }, [data])

  return (
    <Panel title="Time-Space Diagram">
      <div className="mb-3 grid gap-2 md:grid-cols-4">
        <input className="input" value={section} onChange={(e) => setSection(e.target.value)} placeholder="Section e.g. BBS or Gaya-Patna" />
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button
          className="rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100"
          onClick={async () => {
            setLoading(true)
            setError('')
            try {
              const params = new URLSearchParams({ section })
              if (date) params.set('date', date)
              setData(await api.timeSpace(params))
            } catch (e) {
              setError((e as Error).message)
            } finally {
              setLoading(false)
            }
          }}
        >
          Generate Diagram
        </button>
      </div>

      {loading ? <LoadingState label="Generating time-space data" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && !data ? <EmptyState label="Select section/date and generate diagram." /> : null}
      {!loading && !error && data ? (
        <div className="space-y-4">
          <div className="h-[420px] rounded border border-slate-800 bg-slate-950/60 p-2">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="x" name="Minute" stroke="#64748b" />
                <YAxis dataKey="y" name="Station order" stroke="#64748b" />
                <Tooltip cursor={{ strokeDasharray: '4 4' }} formatter={(_, __, p) => [`${p.payload.station}`, `Train ${p.payload.train}`]} />
                <Legend />
                <Scatter name="Train movement" data={chartRows} fill="#38bdf8" line lineType="joint" />
                {data.blocks.map((b, i) => (
                  <Scatter key={i} name={`Maintenance block ${i + 1}`} data={[{ x: b.start_minute, y: 0 }, { x: b.end_minute, y: 0 }]} fill="#ef4444" line />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded border border-slate-700 bg-slate-900 p-3 text-xs text-slate-300">Trains plotted: {data.trains.length}</div>
            <div className="rounded border border-slate-700 bg-slate-900 p-3 text-xs text-slate-300">Maintenance windows plotted: {data.blocks.length}</div>
          </div>
        </div>
      ) : null}
    </Panel>
  )
}
