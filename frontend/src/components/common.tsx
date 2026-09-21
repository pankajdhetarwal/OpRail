import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleDot, Clock3, Loader2, OctagonAlert, ShieldCheck, XCircle } from 'lucide-react'
import clsx from 'clsx'

export function Panel({ title, actions, children, className }: { title: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('surface-panel', className)}>
      <header className="surface-panel-header">
        <h3 className="text-sm font-semibold tracking-wide text-[var(--text-primary)]">{title}</h3>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  )
}

export function PageHeader({ title, description, breadcrumbs, actions }: { title: string; description?: string; breadcrumbs?: string[]; actions?: ReactNode }) {
  return <header className="page-header"><div>{breadcrumbs?.length ? <p className="shell-eyebrow">{breadcrumbs.join(' / ')}</p> : null}<h2 className="page-header-title">{title}</h2>{description ? <p className="page-header-description">{description}</p> : null}</div>{actions ? <div className="page-header-actions">{actions}</div> : null}</header>
}

const statusConfig = {
  HEALTHY: { icon: ShieldCheck, className: 'status-healthy' },
  AVAILABLE: { icon: CheckCircle2, className: 'status-available' },
  WARNING: { icon: OctagonAlert, className: 'status-warning' },
  CRITICAL: { icon: XCircle, className: 'status-critical' },
  BLOCKED: { icon: XCircle, className: 'status-blocked' },
  ACTIVE: { icon: CircleDot, className: 'status-active' },
  COMPLETED: { icon: CheckCircle2, className: 'status-completed' },
  PENDING: { icon: Clock3, className: 'status-pending' },
} as const

export function OperationalStatus({ status }: { status: keyof typeof statusConfig }) {
  const config = statusConfig[status]
  const Icon = config.icon
  return <span className={clsx('operational-status', config.className)}><Icon className="h-3.5 w-3.5" aria-hidden="true" />{status}</span>
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
      <AlertTriangle className="h-4 w-4" /> {message}
    </div>
  )
}

export function EmptyState({ label }: { label: string }) {
  return <div className="rounded border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">{label}</div>
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={clsx('inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium', className)}>{children}</span>
}
