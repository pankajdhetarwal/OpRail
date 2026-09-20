import { useMemo, useState } from 'react'
import { AppShell, type ViewKey } from './layouts/AppShell'
import { DashboardView } from './modules/dashboard/DashboardView'
import { TasksView } from './modules/tasks/TasksView'
import { PlanningView } from './modules/planning/PlanningView'
import { SourcesView } from './modules/sources/SourcesView'
import { VisualizationView } from './modules/visualization/VisualizationView'

function App() {
  const [view, setView] = useState<ViewKey>('overview-dashboard')

  const content = useMemo(() => {
    if (view.startsWith('overview')) return <DashboardView />
    if (view.startsWith('planning')) return <PlanningView />
    if (view.startsWith('maintenance')) return <TasksView />
    if (view === 'sources-tms') return <SourcesView activeTab="TMS" />
    if (view === 'sources-smms') return <SourcesView activeTab="SMMS" />
    if (view === 'sources-tdms') return <SourcesView activeTab="TDMS" />
    if (view === 'sources-coa') return <SourcesView activeTab="COA" />
    return <VisualizationView />
  }, [view])

  return <AppShell view={view} setView={setView}>{content}</AppShell>
}

export default App
