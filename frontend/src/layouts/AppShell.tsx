import {
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useHealth } from '../core/health/useHealth'

export type ViewKey =
  | 'overview-dashboard'
  | 'planning-generator'
  | 'planning-history'
  | 'planning-validator'
  | 'planning-bundles'
  | 'maintenance-worklist'
  | 'sources-tms'
  | 'sources-smms'
  | 'sources-tdms'
  | 'sources-coa'
  | 'visualization-timespace'

type NavigationItem = {
  key: ViewKey
  label: string
}

const navigation: {
  label: string
  items: NavigationItem[]
}[] = [
  {
    label: 'Overview',
    items: [
      {
        key: 'overview-dashboard',
        label: 'Operations Dashboard',
      },
    ],
  },
  {
    label: 'Planning',
    items: [
      {
        key: 'planning-generator',
        label: 'Plan Generator',
      },
      {
        key: 'planning-history',
        label: 'Plan History',
      },
      {
        key: 'planning-validator',
        label: 'Conflict Validator',
      },
      {
        key: 'planning-bundles',
        label: 'Bundle Candidates',
      },
    ],
  },
  {
    label: 'Maintenance',
    items: [
      {
        key: 'maintenance-worklist',
        label: 'Task Worklist',
      },
    ],
  },
  {
    label: 'Source Systems',
    items: [
      {
        key: 'sources-tms',
        label: 'TMS / Engineering',
      },
      {
        key: 'sources-smms',
        label: 'SMMS / Signal & Telecom',
      },
      {
        key: 'sources-tdms',
        label: 'TDMS / OHE',
      },
      {
        key: 'sources-coa',
        label: 'COA / Train Operations',
      },
    ],
  },
  {
    label: 'Visualization',
    items: [
      {
        key: 'visualization-timespace',
        label: 'Time-Space Diagram',
      },
    ],
  },
]

function Sidebar({
  view,
  setView,
}: {
  view: ViewKey
  setView: (key: ViewKey) => void
}) {
  return (
    <div style={{
      width: '240px',
      backgroundColor: '#3ab3ba',
      color: 'white',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '2px solid #2e8f95'
    }}>
      <div style={{ padding: '20px', fontSize: '24px', fontWeight: 'bold', borderBottom: '1px solid #2e8f95' }}>
        OPRAIL
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
        {navigation.map((group) => (
          <div key={group.label} style={{ marginBottom: '20px' }}>
            <div style={{ padding: '5px 20px', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', color: '#e0f7fa' }}>
              {group.label}
            </div>
            {group.items.map((item) => {
              const active = view === item.key
              return (
                <div
                  key={item.key}
                  onClick={() => setView(item.key)}
                  style={{
                    padding: '8px 20px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    backgroundColor: active ? '#2e8f95' : 'transparent',
                    borderLeft: active ? '4px solid #ffffff' : '4px solid transparent',
                    fontWeight: active ? 'bold' : 'normal'
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)' }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  {item.label}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export function AppShell({
  view,
  setView,
  children,
}: {
  view: ViewKey
  setView: (key: ViewKey) => void
  children: ReactNode
}) {
  const online = useHealth()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <Sidebar view={view} setView={setView} />
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{
          backgroundColor: '#3ab3ba',
          color: 'white',
          padding: '10px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '4px solid #f0f0f0'
        }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
            OPRAIL - Railway Operations Platform
          </div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{ color: '#d50000', fontWeight: 'bold', backgroundColor: '#ffffff', padding: '2px 10px', borderRadius: '4px', fontSize: '14px' }}>
              Operations Control Center
            </div>
            <div style={{ fontSize: '12px' }}>
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: online ? '#00e676' : '#d50000', display: 'inline-block' }}></span>
              Backend {online ? 'Online' : 'Offline'}
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#ffffff' }}>
          {children}
        </main>
      </div>
    </div>
  )
}