import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../core/api/client'
import type { DashboardKPIs } from '../../types/api'
import { Badge, EmptyState, ErrorState, LoadingState, Panel } from '../../components/common'

export function DashboardView() {
  const [data, setData] = useState<DashboardKPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    api.dashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const alerts = useMemo(() => {
    if (!data) return []
    return [
      data.critical_tasks > 0 ? `${data.critical_tasks} safety-critical tasks need immediate planning.` : 'No safety-critical tasks currently open.',
      data.overdue_tasks > 0 ? `${data.overdue_tasks} tasks are overdue and should be prioritized.` : 'No overdue backlog at this moment.',
      `${data.joint_blocks_today} joint blocks generated today for cross-department coordination.`,
    ]
  }, [data])

  if (loading) return <LoadingState label="Loading dashboard metrics" />
  if (error) return <ErrorState message={error} />
  if (!data) return <EmptyState label="No dashboard data available." />

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-md border border-slate-800 bg-slate-950/70 p-3 md:grid-cols-4 xl:grid-cols-8">
        {[
          ['Availability', `${data.asset_availability_pct}%`],
          ['Total Tasks', data.total_tasks],
          ['Critical', data.critical_tasks],
          ['Overdue', data.overdue_tasks],
          ['Scheduled', data.scheduled_tasks],
          ['Today Blocks', data.todays_blocks],
          ['Joint Blocks', data.joint_blocks_today],
          ['Avg Efficiency', `${data.avg_block_efficiency}%`],
        ].map(([k, v]) => (
          <div key={String(k)} className="border-r border-slate-800 px-3 py-1 last:border-r-0">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">{k}</p>
            <p className="font-mono text-lg text-slate-100">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel title="Maintenance Activity Trend" className="xl:col-span-3">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data.availability_trend}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#64748b" />
                <YAxis stroke="#64748b" domain={[75, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="availability" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Department Activity" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.dept_stats}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="code" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Bar dataKey="total_tasks" fill="#94a3b8" />
                <Bar dataKey="critical_tasks" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel title="Critical Sections" className="xl:col-span-3">
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400">
                <tr>
                  <th className="py-2">Section</th>
                  <th>Criticality</th>
                  <th>Pending</th>
                  <th>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {data.section_statuses.map((s) => (
                  <tr key={s.section_code} className="border-t border-slate-800">
                    <td className="py-2 text-slate-200">{s.section_code} · {s.section_name}</td>
                    <td>{s.criticality_level}/5</td>
                    <td>{s.pending_tasks}</td>
                    <td>{s.overdue_tasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Operational Insights" className="xl:col-span-2">
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert} className="rounded border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300">
                {alert}
              </div>
            ))}
            <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-200">Active conflicts: {data.active_conflicts}</Badge>
          </div>
        </Panel>
      </div>
    </div>
  )
}
