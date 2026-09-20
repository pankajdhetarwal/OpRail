import { motion } from 'framer-motion'
import { Activity, ClipboardList, Database, Gauge, GitBranchPlus, History, LayoutDashboard, Menu, Route, SearchCheck, Settings2, Sparkles, TrainFront } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useHealth } from '../core/health/useHealth'

export type ViewKey =
  | 'overview-dashboard'
  | 'planning-generator'
  | 'planning-history'
  | 'planning-validator'
  | 'planning-bundles'
  | 'maintenance-worklist'
  | 'maintenance-explainability'
  | 'sources-tms'
  | 'sources-smms'
  | 'sources-tdms'
  | 'sources-coa'
  | 'visualization-timespace'

const nav = [
  { label: 'Overview', items: [{ key: 'overview-dashboard', label: 'Operations Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Planning',
    items: [
      { key: 'planning-generator', label: 'Plan Generator', icon: Sparkles },
      { key: 'planning-history', label: 'Plan History', icon: History },
      { key: 'planning-validator', label: 'Manual Validator', icon: SearchCheck },
      { key: 'planning-bundles', label: 'Bundle Candidates', icon: GitBranchPlus },
    ],
  },
  {
    label: 'Maintenance',
    items: [
      { key: 'maintenance-worklist', label: 'Unified Task Worklist', icon: ClipboardList },
      { key: 'maintenance-explainability', label: 'Task Explainability', icon: Activity },
    ],
  },
  {
    label: 'Source Systems',
    items: [
      { key: 'sources-tms', label: 'TMS', icon: Database },
      { key: 'sources-smms', label: 'SMMS', icon: Database },
      { key: 'sources-tdms', label: 'TDMS', icon: Database },
      { key: 'sources-coa', label: 'COA', icon: TrainFront },
    ],
  },
  { label: 'Visualization', items: [{ key: 'visualization-timespace', label: 'Time-Space Diagram', icon: Route }] },
] as const

const labels: Record<ViewKey, string> = {
  'overview-dashboard': 'Operations Dashboard',
  'planning-generator': 'Plan Generator',
  'planning-history': 'Plan History',
  'planning-validator': 'Manual Validator',
  'planning-bundles': 'Bundle Candidates',
  'maintenance-worklist': 'Unified Task Worklist',
  'maintenance-explainability': 'Task Explainability',
  'sources-tms': 'TMS Feed',
  'sources-smms': 'SMMS Feed',
  'sources-tdms': 'TDMS Feed',
  'sources-coa': 'COA Traffic Module',
  'visualization-timespace': 'Time-Space Diagram',
}

export function AppShell({ view, setView, children }: { view: ViewKey; setView: (key: ViewKey) => void; children: ReactNode }) {
  const online = useHealth()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <motion.aside animate={{ width: collapsed ? 78 : 288 }} className="hidden border-r border-slate-800 bg-slate-900/70 md:block">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-3">
          {!collapsed ? (
            <div>
              <p className="font-mono text-sm">OpRail Control</p>
              <p className="text-[11px] text-slate-500">Railway operations planning</p>
            </div>
          ) : <Gauge className="h-4 w-4" />}
          <button className="rounded border border-slate-700 p-1 text-slate-300" onClick={() => setCollapsed((c) => !c)}><Menu className="h-3.5 w-3.5" /></button>
        </div>
        <nav className="max-h-[calc(100vh-56px)] overflow-auto p-2">
          {nav.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed ? <p className="mb-1 px-2 text-[11px] uppercase tracking-wider text-slate-500">{group.label}</p> : null}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = view === item.key
                  return (
                    <button key={item.key} onClick={() => setView(item.key as ViewKey)} className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm ${active ? 'bg-cyan-500/15 text-cyan-100' : 'text-slate-300 hover:bg-slate-800'}`}>
                      <Icon className="h-4 w-4" /> {!collapsed ? <span>{item.label}</span> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </motion.aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 backdrop-blur">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">OpRail › {view.split('-')[0]}</p>
            <h1 className="text-sm font-semibold text-slate-100">{labels[view]}</h1>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 rounded border border-slate-700 px-2 py-1">
              <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-red-400'}`} />
              Backend {online ? 'Online' : 'Offline'}
            </div>
            <a className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-800" href="/docs" target="_blank" rel="noreferrer">API Docs</a>
            <button className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-800" onClick={() => window.location.reload()}><Settings2 className="h-3.5 w-3.5" /></button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  )
}
