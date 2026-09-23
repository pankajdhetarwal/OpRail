import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen,
  ClipboardList,
  Database,
  Gauge,
  GitBranchPlus,
  History,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Route,
  SearchCheck,
  Sparkles,
  TrainFront,
  X,
} from 'lucide-react'
import {
  useEffect,
  useState,
  type ComponentType,
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
  icon: ComponentType<{ className?: string }>
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
        icon: LayoutDashboard,
      },
    ],
  },

  {
    label: 'Planning',
    items: [
      {
        key: 'planning-generator',
        label: 'Plan Generator',
        icon: Sparkles,
      },
      {
        key: 'planning-history',
        label: 'Plan History',
        icon: History,
      },
      {
        key: 'planning-validator',
        label: 'Conflict Validator',
        icon: SearchCheck,
      },
      {
        key: 'planning-bundles',
        label: 'Bundle Candidates',
        icon: GitBranchPlus,
      },
    ],
  },

  {
    label: 'Maintenance',
    items: [
      {
        key: 'maintenance-worklist',
        label: 'Task Worklist',
        icon: ClipboardList,
      },
    ],
  },

  {
    label: 'Source Systems',
    items: [
      {
        key: 'sources-tms',
        label: 'TMS / Engineering',
        icon: Database,
      },
      {
        key: 'sources-smms',
        label: 'SMMS / Signal & Telecom',
        icon: Database,
      },
      {
        key: 'sources-tdms',
        label: 'TDMS / OHE',
        icon: Database,
      },
      {
        key: 'sources-coa',
        label: 'COA / Train Operations',
        icon: TrainFront,
      },
    ],
  },

  {
    label: 'Visualization',
    items: [
      {
        key: 'visualization-timespace',
        label: 'Time-Space Diagram',
        icon: Route,
      },
    ],
  },
]

const labels: Record<
  ViewKey,
  {
    title: string
    section: string
    description: string
  }
> = {
  'overview-dashboard': {
    title: 'Operations Dashboard',
    section: 'Overview',
    description:
      'Network-wide maintenance and block planning overview',
  },

  'planning-generator': {
    title: 'Plan Generator',
    section: 'Planning',
    description:
      'Generate coordinated maintenance windows against the live timetable',
  },

  'planning-history': {
    title: 'Plan History',
    section: 'Planning',
    description:
      'Review previously generated block plans',
  },

  'planning-validator': {
    title: 'Conflict Validator',
    section: 'Planning',
    description:
      'Check proposed blocks against train movements',
  },

  'planning-bundles': {
    title: 'Bundle Candidates',
    section: 'Planning',
    description:
      'Identify maintenance tasks that can share a block',
  },

  'maintenance-worklist': {
    title: 'Task Worklist',
    section: 'Maintenance',
    description:
      'Unified maintenance tasks across operating departments',
  },

  'sources-tms': {
    title: 'TMS / Engineering',
    section: 'Source Systems',
    description:
      'Engineering maintenance feed',
  },

  'sources-smms': {
    title: 'SMMS / Signal & Telecom',
    section: 'Source Systems',
    description:
      'Signal and telecom maintenance feed',
  },

  'sources-tdms': {
    title: 'TDMS / OHE',
    section: 'Source Systems',
    description:
      'Traction distribution maintenance feed',
  },

  'sources-coa': {
    title: 'COA / Train Operations',
    section: 'Source Systems',
    description:
      'Train timetable and approved block windows',
  },

  'visualization-timespace': {
    title: 'Time-Space Diagram',
    section: 'Visualization',
    description:
      'Inspect train paths and maintenance windows',
  },
}

function Sidebar({
  collapsed,
  view,
  setView,
  closeMobile,
}: {
  collapsed: boolean
  view: ViewKey
  setView: (key: ViewKey) => void
  closeMobile?: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="shell-brand">
        <div
          className="shell-brand-mark"
          aria-hidden="true"
        >
          <Gauge className="h-5 w-5" />
        </div>

        {!collapsed ? (
          <div>
            <p className="shell-brand-title">
              OPRAIL
            </p>
            <p className="shell-brand-subtitle">
              Railway Operations Platform
            </p>
          </div>
        ) : null}
      </div>

      <nav
        className="shell-nav"
        aria-label="Main navigation"
      >
        {navigation.map((group) => (
          <div
            key={group.label}
            className="shell-nav-group"
          >
            {!collapsed ? (
              <p className="shell-nav-label">
                {group.label}
              </p>
            ) : null}

            {group.items.map((item) => {
              const Icon = item.icon
              const active = view === item.key

              return (
                <button
                  key={item.key}
                  type="button"
                  title={
                    collapsed
                      ? item.label
                      : undefined
                  }
                  aria-label={
                    collapsed
                      ? item.label
                      : undefined
                  }
                  aria-current={
                    active ? 'page' : undefined
                  }
                  onClick={() => {
                    setView(item.key)
                    closeMobile?.()
                  }}
                  className={`shell-nav-item ${
                    active ? 'is-active' : ''
                  }`}
                >
                  <Icon
                    className="h-[17px] w-[17px] shrink-0"
                    aria-hidden="true"
                  />

                  {!collapsed ? (
                    <span>{item.label}</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ))}

        <div className="shell-nav-group">
          {!collapsed ? (
            <p className="shell-nav-label">
              Developer
            </p>
          ) : null}

          <a
            className="shell-nav-item"
            href="/docs"
            target="_blank"
            rel="noreferrer"
            title={
              collapsed
                ? 'API Documentation'
                : undefined
            }
            aria-label={
              collapsed
                ? 'API Documentation'
                : undefined
            }
          >
            <BookOpen
              className="h-[17px] w-[17px] shrink-0"
              aria-hidden="true"
            />

            {!collapsed ? (
              <span>API Documentation</span>
            ) : null}
          </a>
        </div>
      </nav>

      {!collapsed ? (
        <div className="shell-sidebar-footer">
          <span className="status-dot is-healthy" />
          Live operations workspace
        </div>
      ) : null}
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

  const [collapsed, setCollapsed] =
    useState(
      () =>
        localStorage.getItem(
          'oprail.sidebar.collapsed',
        ) === 'true',
    )

  const [mobileOpen, setMobileOpen] =
    useState(false)

  const [now, setNow] = useState(
    () => new Date(),
  )

  const page = labels[view]

  useEffect(() => {
    localStorage.setItem(
      'oprail.sidebar.collapsed',
      String(collapsed),
    )
  }, [collapsed])

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(new Date()),
      1000,
    )

    return () =>
      window.clearInterval(timer)
  }, [])

  return (
    <div className="oprail-app">
      <aside
        className={`shell-sidebar ${
          collapsed ? 'is-collapsed' : ''
        }`}
      >
        <Sidebar
          collapsed={collapsed}
          view={view}
          setView={setView}
        />

        <button
          className="shell-collapse-button"
          type="button"
          onClick={() =>
            setCollapsed(
              (value) => !value,
            )
          }
          aria-label={
            collapsed
              ? 'Expand sidebar'
              : 'Collapse sidebar'
          }
          title={
            collapsed
              ? 'Expand sidebar'
              : 'Collapse sidebar'
          }
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </aside>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              className="shell-drawer-backdrop"
              type="button"
              aria-label="Close navigation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() =>
                setMobileOpen(false)
              }
            />

            <motion.aside
              className="shell-mobile-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.2 }}
            >
              <button
                className="shell-drawer-close"
                type="button"
                onClick={() =>
                  setMobileOpen(false)
                }
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>

              <Sidebar
                collapsed={false}
                view={view}
                setView={setView}
                closeMobile={() =>
                  setMobileOpen(false)
                }
              />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <div className="shell-main">
        <header className="shell-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="shell-icon-button md:hidden"
              type="button"
              onClick={() =>
                setMobileOpen(true)
              }
              aria-label="Open navigation"
              title="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <div className="shell-breadcrumb">
                <span>OpRail</span>
                <span aria-hidden="true">
                  /
                </span>
                <span>
                  {page.section}
                </span>
              </div>

              <h1 className="shell-page-title">
                {page.title}
              </h1>
            </div>
          </div>

          <div className="shell-topbar-actions">
            <div
              className="shell-clock"
              aria-label={`Current time ${now.toLocaleTimeString(
                [],
                {
                  hour: '2-digit',
                  minute: '2-digit',
                },
              )}`}
            >
              <span className="shell-clock-label">
                Local time
              </span>

              <span>
                {now.toLocaleTimeString(
                  [],
                  {
                    hour: '2-digit',
                    minute: '2-digit',
                  },
                )}
              </span>
            </div>

            <div
              className={`shell-health ${
                online
                  ? 'is-online'
                  : 'is-offline'
              }`}
              role="status"
            >
              <span
                className="status-dot"
                aria-hidden="true"
              />

              <span className="hidden sm:inline">
                Backend
              </span>{' '}
              {online
                ? 'Online'
                : 'Offline'}
            </div>

            <button
              className="shell-icon-button"
              type="button"
              onClick={() =>
                window.location.reload()
              }
              aria-label="Refresh application"
              title="Refresh application"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="shell-content">
          <div className="shell-content-heading">
            <div>
              <p className="shell-eyebrow">
                {page.section}
              </p>

              <p className="shell-description">
                {page.description}
              </p>
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  )
}