import type { ReactNode } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import clsx from 'clsx'

export function Panel({ title, actions, children, className }: { title: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('rounded-md border border-slate-800 bg-slate-950/70', className)}>
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h3 className="text-sm font-semibold tracking-wide text-slate-100">{title}</h3>
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
