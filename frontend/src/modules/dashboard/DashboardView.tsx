import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert, Target } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../core/api/client'
import type { DashboardKPIs } from '../../types/api'
import { EmptyState, OperationalStatus, Panel } from '../../components/common'

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`))
const formatNumber = (value: number) => new Intl.NumberFormat().format(value)
type DashboardStatus = 'HEALTHY' | 'AVAILABLE' | 'WARNING' | 'CRITICAL' | 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'BLOCKED'

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-label="Loading operations dashboard" role="status">
      <div className="dashboard-skeleton-kpis">{Array.from({ length: 6 }, (_, index) => <div className="skeleton-block" key={index} />)}</div>
      <div className="dashboard-skeleton-main"><div className="skeleton-block skeleton-chart" /><div className="skeleton-block skeleton-chart" /></div>
      <div className="dashboard-skeleton-bottom"><div className="skeleton-block skeleton-table" /><div className="skeleton-block skeleton-table" /></div>
      <span className="sr-only">Loading dashboard metrics</span>
    </div>
  )
}

function KpiModule({ label, value, description, icon: Icon, tone, status }: { label: string; value: string; description: string; icon: typeof Activity; tone: string; status: DashboardStatus }) {
  return (
    <article className="dashboard-kpi">
      <div className={`dashboard-kpi-icon ${tone}`}><Icon className="h-4 w-4" aria-hidden="true" /></div>
      <div className="dashboard-kpi-copy"><p className="dashboard-kpi-label">{label}</p><p className="dashboard-kpi-value">{value}</p><p className="dashboard-kpi-description">{description}</p></div>
      <OperationalStatus status={status} />
    </article>
  )
}

export function DashboardView() {
  const [data, setData] = useState<DashboardKPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadDashboard = useCallback(() => {
    setLoading(true)
    setError('')
    return api.dashboard()
      .then((result) => {
        setData(result)
        setLastUpdated(new Date())
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load dashboard metrics.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const departmentRows = useMemo(() => data?.dept_stats.map((department) => ({
    ...department,
    workload: department.total_tasks,
    shortName: department.code === 'OHE' ? 'OHE' : department.code,
  })) ?? [], [data])

  const highAttentionCount = data ? data.critical_tasks + data.overdue_tasks : 0
  const availabilityStatus = data && data.asset_availability_pct >= 95 ? 'HEALTHY' : data && data.asset_availability_pct >= 85 ? 'WARNING' : 'CRITICAL'
  const efficiencyStatus = data && data.avg_block_efficiency >= 80 ? 'AVAILABLE' : 'WARNING'

  if (loading && !data) return <DashboardSkeleton />

  if (error && !data) {
    return (
      <section className="dashboard-error" role="alert">
        <div className="dashboard-error-icon"><ShieldAlert className="h-6 w-6" aria-hidden="true" /></div>
        <div><h2>Dashboard data unavailable</h2><p>The operations dashboard could not retrieve its metrics from the dashboard service.</p><p className="dashboard-error-detail">{error}</p></div>
        <button className="dashboard-action-button" type="button" onClick={() => void loadDashboard()}><RefreshCw className="h-4 w-4" /> Retry</button>
      </section>
    )
  }

  if (!data) return <EmptyState label="No dashboard data available from the operations service." />

  return (
    <div className="dashboard-page">
      <header className="dashboard-page-header">
        <div><p className="shell-eyebrow">Network status / Today</p><h2 className="dashboard-title">Operations Dashboard</h2><p className="dashboard-subtitle">Network-wide maintenance and block planning overview</p></div>
        <div className="dashboard-header-actions">
          {lastUpdated ? <span className="dashboard-updated">Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : null}
          <button className="dashboard-action-button" type="button" onClick={() => void loadDashboard()} disabled={loading} aria-label="Refresh dashboard" title="Refresh dashboard"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> <span>Refresh</span></button>
        </div>
      </header>

      {error ? <div className="dashboard-inline-error"><AlertTriangle className="h-4 w-4" /> <span>{error}</span><button type="button" onClick={() => void loadDashboard()}>Retry</button></div> : null}

      <section className="dashboard-kpi-grid" aria-label="Operational key performance indicators">
        <KpiModule label="Asset availability" value={`${data.asset_availability_pct}%`} description="Current network availability" icon={Activity} tone="is-teal" status={availabilityStatus} />
        <KpiModule label="Maintenance tasks" value={formatNumber(data.total_tasks)} description={`${formatNumber(data.scheduled_tasks)} currently scheduled`} icon={Target} tone="is-blue" status={data.total_tasks > 0 ? 'ACTIVE' : 'AVAILABLE'} />
        <KpiModule label="Attention required" value={formatNumber(highAttentionCount)} description={`${formatNumber(data.critical_tasks)} critical / ${formatNumber(data.overdue_tasks)} overdue`} icon={ShieldAlert} tone="is-red" status={highAttentionCount > 0 ? 'CRITICAL' : 'HEALTHY'} />
        <KpiModule label="Blocks today" value={formatNumber(data.todays_blocks)} description={`${formatNumber(data.joint_blocks_today)} joint department blocks`} icon={Clock3} tone="is-amber" status={data.todays_blocks > 0 ? 'ACTIVE' : 'PENDING'} />
        <KpiModule label="Block efficiency" value={`${data.avg_block_efficiency}%`} description="Average generated block efficiency" icon={CheckCircle2} tone="is-green" status={efficiencyStatus} />
        <KpiModule label="Active conflicts" value={formatNumber(data.active_conflicts)} description="Reported by operations service" icon={AlertTriangle} tone="is-violet" status={data.active_conflicts > 0 ? 'CRITICAL' : 'HEALTHY'} />
      </section>

      <section className="dashboard-chart-grid">
        <Panel title="Asset availability trend" actions={<span className="panel-meta">Last {data.availability_trend.length} reported points</span>}>
          {data.availability_trend.length ? <div className="dashboard-chart dashboard-line-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.availability_trend} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={formatDate} stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={11} /><YAxis domain={[Math.min(75, ...data.availability_trend.map((point) => point.availability)), 100]} stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={11} tickFormatter={(value) => `${value}%`} /><Tooltip contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)', borderRadius: 4, color: 'var(--text-primary)' }} labelFormatter={(value) => formatDate(String(value))} formatter={(value) => [`${value}%`, 'Availability']} /><Line type="monotone" dataKey="availability" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div> : <EmptyState label="No availability trend reported." />}
          <p className="chart-caption">Reported asset availability across the dashboard service trend window.</p>
        </Panel>
        <Panel title="Department workload" actions={<span className="panel-meta">Tasks by source domain</span>}>
          {departmentRows.length ? <div className="dashboard-chart dashboard-bar-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={departmentRows} margin={{ top: 20, right: 12, bottom: 0, left: -18 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="shortName" stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={11} /><YAxis allowDecimals={false} stroke="var(--text-muted)" tickLine={false} axisLine={false} fontSize={11} /><Tooltip contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)', borderRadius: 4, color: 'var(--text-primary)' }} formatter={(value, name) => [value, name === 'workload' ? 'Total tasks' : name]} /><Bar dataKey="workload" radius={[2, 2, 0, 0]}><LabelList dataKey="workload" position="top" fill="var(--text-secondary)" fontSize={11} />{departmentRows.map((department) => <Cell key={department.code} fill={department.color_hex || 'var(--accent)'} />)}</Bar></BarChart></ResponsiveContainer></div> : <EmptyState label="No department workload reported." />}
+          <div className="department-legend">{departmentRows.map((department) => <span key={department.code}><i style={{ background: department.color_hex || 'var(--accent)' }} />{department.name}</span>)}</div>
        </Panel>
      </section>

      <section className="dashboard-bottom-grid">
        <Panel title="Critical sections" actions={<span className="panel-meta">Highest criticality first</span>}>
          {data.section_statuses.length ? <div className="dashboard-table-wrap"><table className="dashboard-table"><caption className="sr-only">Critical railway sections and outstanding tasks</caption><thead><tr><th>Section</th><th>Criticality</th><th>Pending</th><th>Overdue</th><th>Status</th></tr></thead><tbody>{data.section_statuses.map((section) => { const attention = section.pending_tasks + section.overdue_tasks; const status = section.overdue_tasks > 0 ? 'CRITICAL' : section.pending_tasks > 0 ? 'PENDING' : 'AVAILABLE'; return <tr key={section.section_code}><td><strong>{section.section_code}</strong><span>{section.section_name}</span></td><td><span className="criticality-meter" aria-label={`Criticality ${section.criticality_level} of 5`}>{Array.from({ length: 5 }, (_, index) => <i className={index < section.criticality_level ? 'is-filled' : ''} key={index} />)}</span><b>{section.criticality_level}/5</b></td><td>{formatNumber(section.pending_tasks)}</td><td className={section.overdue_tasks > 0 ? 'is-critical-text' : ''}>{formatNumber(section.overdue_tasks)}</td><td><OperationalStatus status={status} /></td><td className="sr-only">{formatNumber(attention)} tasks requiring attention</td></tr> })}</tbody></table></div> : <EmptyState label="No critical maintenance sections reported." />}
        </Panel>
        <Panel title="Operations brief" actions={<span className="panel-meta">Current API snapshot</span>}>
          <div className="operations-brief">
            <div className="brief-row"><span className="brief-marker is-red" /><div><strong>Critical workload</strong><p>{data.critical_tasks ? `${formatNumber(data.critical_tasks)} safety-critical tasks require attention.` : 'No safety-critical tasks reported.'}</p></div></div>
            <div className="brief-row"><span className="brief-marker is-amber" /><div><strong>Overdue backlog</strong><p>{data.overdue_tasks ? `${formatNumber(data.overdue_tasks)} tasks are overdue.` : 'No overdue tasks reported.'}</p></div></div>
            <div className="brief-row"><span className="brief-marker is-teal" /><div><strong>Cross-department coordination</strong><p>{data.joint_blocks_today ? `${formatNumber(data.joint_blocks_today)} joint blocks are scheduled today.` : 'No joint blocks reported today.'}</p></div></div>
            <div className="brief-system"><OperationalStatus status="HEALTHY" /><span>Dashboard service responded successfully</span></div>
          </div>
        </Panel>
      </section>
    </div>
  )
}
