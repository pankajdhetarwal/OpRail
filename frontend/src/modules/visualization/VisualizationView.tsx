import { useMemo, useState } from 'react'
import { api } from '../../core/api/client'
import type { TimeSpaceResponse } from '../../types/api'
import { EmptyState, ErrorState, LoadingState, Panel } from '../../components/common'

const CHART_HEIGHT = 470
const PLOT_LEFT = 205
const PLOT_RIGHT = 45
const PLOT_TOP = 58
const PLOT_BOTTOM = 72
const MIN_CHART_WIDTH = 1900

const STATION_NAMES: Record<string, string> = {
  BBS: 'Bhubaneswar',
  BNC: 'Bengaluru Cantonment',
}

const getStationName = (code: string) => STATION_NAMES[code] ?? ''

const formatMinute = (minute: number) => {
  const rounded = Math.max(0, Math.min(1440, Math.round(minute)))
  if (rounded === 1440) return '24:00'
  const hours = Math.floor(rounded / 60)
  const mins = rounded % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

const unique = <T,>(values: T[]) => [...new Set(values)]

export function VisualizationView() {
  const section = 'BBS'
  const [date, setDate] = useState('')
  const [data, setData] = useState<TimeSpaceResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedTrain, setSelectedTrain] = useState('')
  const [compareTrain, setCompareTrain] = useState('')
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0)

  const activeTrain = data?.trains.find((train) => train.train_number === selectedTrain) ?? data?.trains[0]
  const comparisonTrain = data?.trains.find(
    (train) => train.train_number === compareTrain && train.train_number !== activeTrain?.train_number,
  )
  const selectedBlock = data?.blocks[selectedBlockIndex] ?? data?.blocks[0]

  const allStations = useMemo(() => {
    const stations = [
      ...(activeTrain?.points.map((point) => point.station) ?? []),
      ...(comparisonTrain?.points.map((point) => point.station) ?? []),
      ...(selectedBlock ? [selectedBlock.start_station, selectedBlock.end_station] : []),
    ]
    return unique(stations.filter(Boolean))
  }, [activeTrain, comparisonTrain, selectedBlock])

  // Show only four evenly-spaced station labels. The complete backend station
  // sequence is still retained for the train geometry.
  const visibleStations = useMemo(() => {
    if (!allStations.length) return []
    if (allStations.length <= 4) return allStations

    const start = selectedBlock?.start_station
    const end = selectedBlock?.end_station
    const startIndex = start ? allStations.indexOf(start) : -1
    const endIndex = end ? allStations.indexOf(end) : -1

    if (startIndex >= 0 && endIndex >= 0) {
      const lo = Math.min(startIndex, endIndex)
      const hi = Math.max(startIndex, endIndex)
      const before = allStations[Math.max(0, lo - 1)]
      const after = allStations[Math.min(allStations.length - 1, hi + 1)]
      return unique([before, start, end, after].filter(Boolean) as string[])
    }

    const indexes = [
      0,
      Math.round((allStations.length - 1) / 3),
      Math.round(((allStations.length - 1) * 2) / 3),
      allStations.length - 1,
    ]
    return unique(indexes.map((index) => allStations[index]).filter(Boolean))
  }, [allStations, selectedBlock])

  // Place the four visible station labels at fixed, evenly-spaced Y positions.
  // Hidden/intermediate stations are interpolated between those anchors, so
  // the train geometry remains faithful without causing label collisions.
  const stationY = useMemo(() => {
    const top = PLOT_TOP
    const bottom = CHART_HEIGHT - PLOT_BOTTOM
    const result = new Map<string, number>()

    if (!visibleStations.length) return result

    const visibleIndexes = visibleStations
      .map((station) => ({ station, index: allStations.indexOf(station) }))
      .filter((item) => item.index >= 0)
      .sort((a, b) => a.index - b.index)

    if (visibleIndexes.length === 1) {
      result.set(visibleIndexes[0].station, (top + bottom) / 2)
      return result
    }

    visibleIndexes.forEach((item, position) => {
      const yPosition = top + (position / (visibleIndexes.length - 1)) * (bottom - top)
      result.set(item.station, yPosition)
    })

    // Interpolate every hidden station between its nearest visible anchors.
    for (let i = 0; i < allStations.length; i += 1) {
      const station = allStations[i]
      if (result.has(station)) continue

      let previous = visibleIndexes[0]
      let next = visibleIndexes[visibleIndexes.length - 1]

      for (let j = 0; j < visibleIndexes.length - 1; j += 1) {
        const left = visibleIndexes[j]
        const right = visibleIndexes[j + 1]
        if (i >= left.index && i <= right.index) {
          previous = left
          next = right
          break
        }
      }

      const span = Math.max(1, next.index - previous.index)
      const ratio = Math.max(0, Math.min(1, (i - previous.index) / span))
      const previousY = result.get(previous.station) ?? top
      const nextY = result.get(next.station) ?? bottom
      result.set(station, previousY + ratio * (nextY - previousY))
    }

    return result
  }, [allStations, visibleStations])

  const y = (station: string) => {
    const top = PLOT_TOP
    const bottom = CHART_HEIGHT - PLOT_BOTTOM
    return stationY.get(station) ?? (top + bottom) / 2
  }

  const labelPoint = (points: { station: string; minute: number }[]) => {
    if (!points.length) return null

    const first = points[0]
    const last = points[points.length - 1]
    const firstX = x(first.minute)
    const lastX = x(last.minute)

    // Keep labels inside the scrollable plot even when a train finishes at 24:00.
    if (lastX > plotRight - 150) {
      return { point: last, anchor: 'end' as const, x: Math.max(PLOT_LEFT + 8, lastX - 12) }
    }

    return { point: first, anchor: 'start' as const, x: Math.min(plotRight - 8, firstX + 12) }
  }

  const timeRange = useMemo(() => {
    // Always preserve the complete day. This makes the time-space page useful
    // even when the selected trains operate far away from the maintenance block.
    return { min: 0, max: 1440 }
  }, [])

  const chartWidth = useMemo(() => {
    const span = timeRange.max - timeRange.min
    return Math.max(MIN_CHART_WIDTH, Math.round((span / 60) * 92 + PLOT_LEFT + PLOT_RIGHT))
  }, [timeRange])

  const x = (minute: number) => {
    const width = chartWidth - PLOT_LEFT - PLOT_RIGHT
    return PLOT_LEFT + (Math.max(0, Math.min(1440, minute)) / 1440) * width
  }

  const plotRight = chartWidth - PLOT_RIGHT
  const plotBottom = CHART_HEIGHT - PLOT_BOTTOM

  const primaryPoints = activeTrain?.points ?? []
  const comparePoints = comparisonTrain?.points ?? []
  const primaryPath = primaryPoints.map((point) => `${x(point.minute)},${y(point.station)}`).join(' ')
  const comparePath = comparePoints.map((point) => `${x(point.minute)},${y(point.station)}`).join(' ')
  const primaryLabel = labelPoint(primaryPoints)
  const compareLabel = labelPoint(comparePoints)

  const visibleMarkers = (points: { station: string; minute: number }[]) => {
    if (!points.length) return []
    return points.filter((point, index) => {
      if (index === 0 || index === points.length - 1) return true
      return point.station !== points[index - 1].station || point.station !== points[index + 1].station
    })
  }

  const primaryMarkers = visibleMarkers(primaryPoints)
  const compareMarkers = visibleMarkers(comparePoints)

  const ticks = useMemo(() => {
    const values: number[] = []
    for (let minute = 0; minute <= 1440; minute += 120) values.push(minute)
    return values
  }, [])

  const runDiagram = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ section: section.trim() || 'BBS' })
      if (date) params.set('date', date)
      const result = await api.timeSpace(params)
      setData(result)
      setSelectedTrain(result.trains[0]?.train_number ?? '')
      setCompareTrain(result.trains[1]?.train_number ?? '')
      setSelectedBlockIndex(0)
    } catch (e) {
      setError((e as Error).message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel title="Time-Space Diagram">
      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1.25fr_1.25fr_0.8fr_auto]">
          <label className="text-xs text-gray-700">
            <span className="mb-1.5 block font-semibold uppercase tracking-[0.12em] text-gray-500">Primary train</span>
            <select className="input h-10 w-full" value={activeTrain?.train_number ?? ''} onChange={(event) => setSelectedTrain(event.target.value)} disabled={!data}>
              {data?.trains.map((train) => <option key={train.train_number} value={train.train_number}>Train {train.train_number}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-700">
            <span className="mb-1.5 block font-semibold uppercase tracking-[0.12em] text-gray-500">Compare with</span>
            <select className="input h-10 w-full" value={compareTrain} onChange={(event) => setCompareTrain(event.target.value)} disabled={!data}>
              <option value="">None</option>
              {data?.trains.filter((train) => train.train_number !== activeTrain?.train_number).map((train) => <option key={train.train_number} value={train.train_number}>Train {train.train_number}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-700">
            <span className="mb-1.5 block font-semibold uppercase tracking-[0.12em] text-gray-500">Date</span>
            <input className="input h-10 w-full" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <div className="flex items-end">
            <button className="h-10 w-full rounded border border-teal-600 bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50" onClick={runDiagram} disabled={loading}>
              {loading ? 'Generating…' : 'Generate Diagram'}
            </button>
          </div>
        </div>

        {loading ? <LoadingState label="Generating time-space data" /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error && !data ? <EmptyState label="Select a section/date and generate the diagram." /> : null}

        {!loading && !error && data ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              {[
                ['Trains returned', String(data.trains.length), ''],
                ['Stations in view', `${visibleStations.length} (${allStations.length})`, 'local block vicinity'],
                ['Maintenance blocks', String(data.blocks.length), ''],
                ['Time window', '00:00 – 24:00', 'full day'],
              ].map(([label, value, hint]) => (
                <div key={label} className="rounded border border-gray-300 bg-white px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
                  {hint ? <p className="mt-1 text-[10px] text-slate-600">{hint}</p> : null}
                </div>
              ))}
            </div>

            {data.blocks.length > 0 ? (
              <div className="rounded border border-amber-400/20 bg-amber-400/[0.035] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/70">Maintenance block</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {selectedBlock?.start_station} · {getStationName(selectedBlock?.start_station ?? '') || 'Station'} → {selectedBlock?.end_station} · {getStationName(selectedBlock?.end_station ?? '') || 'Station'}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-700">
                    <div>{formatMinute(selectedBlock?.start_minute ?? 0)} → {formatMinute(selectedBlock?.end_minute ?? 0)}</div>
                    <div>{Math.max(0, (selectedBlock?.end_minute ?? 0) - (selectedBlock?.start_minute ?? 0))} minutes</div>
                  </div>
                </div>
                {data.blocks.length > 1 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.blocks.map((block, index) => (
                      <button key={`${block.start_station}-${block.end_station}-${block.start_minute}-${index}`} type="button" className={`rounded border px-2 py-1 text-xs ${index === selectedBlockIndex ? 'border-amber-400 bg-amber-100 text-amber-900' : 'border-gray-400 bg-gray-100 text-gray-700'}`} onClick={() => setSelectedBlockIndex(index)}>
                        {block.start_station} → {block.end_station} · {formatMinute(block.start_minute)}–{formatMinute(block.end_minute)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <section className="overflow-hidden rounded border border-gray-300 bg-white">
              <div className="flex items-center justify-between border-b border-gray-300 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Time-Space Diagram</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500">Full train schedules · scroll horizontally to inspect the complete movement</p>
                </div>
                <div className="hidden items-center gap-2 text-xs text-gray-500 md:flex">← → Scroll timeline</div>
              </div>

              <div className="overflow-x-auto px-2 pb-3">
                <svg viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`} className="block max-w-none" style={{ width: `${chartWidth}px`, height: `${CHART_HEIGHT}px` }} role="img" aria-label="Railway time-space diagram">
                  <rect width={chartWidth} height={CHART_HEIGHT} fill="transparent" />

                  {visibleStations.map((station) => (
                    <g key={station}>
                      <line x1={PLOT_LEFT} x2={plotRight} y1={y(station)} y2={y(station)} stroke="#1e293b" strokeWidth="1" />
                      <text x={PLOT_LEFT - 18} y={y(station) - 2} textAnchor="end" fill="#e2e8f0" fontSize="14" fontWeight="700">{station}</text>
                      {getStationName(station) ? <text x={PLOT_LEFT - 18} y={y(station) + 15} textAnchor="end" fill="#64748b" fontSize="10">{getStationName(station)}</text> : null}
                    </g>
                  ))}

                  {ticks.map((tick) => (
                    <g key={tick}>
                      <line x1={x(tick)} x2={x(tick)} y1={PLOT_TOP} y2={plotBottom} stroke="#172033" strokeWidth="1" strokeDasharray="3 5" />
                      <text x={x(tick)} y={CHART_HEIGHT - 38} textAnchor="middle" fill="#64748b" fontSize="11">{formatMinute(tick)}</text>
                    </g>
                  ))}

                  {selectedBlock ? (
                    <g>
                      <rect x={x(selectedBlock.start_minute)} y={PLOT_TOP + 1} width={Math.max(8, x(selectedBlock.end_minute) - x(selectedBlock.start_minute))} height={plotBottom - PLOT_TOP - 2} rx="5" fill="#ef4444" fillOpacity="0.12" stroke="#ef4444" strokeWidth="1.5" strokeOpacity="0.85" />
                      <text x={x(selectedBlock.start_minute) + 12} y={PLOT_TOP + 18} fill="#fca5a5" fontSize="11" fontWeight="700">MAINTENANCE BLOCK</text>
                      <text x={x(selectedBlock.start_minute) + 12} y={PLOT_TOP + 34} fill="#fca5a5" fontSize="11">{formatMinute(selectedBlock.start_minute)} – {formatMinute(selectedBlock.end_minute)}</text>
                    </g>
                  ) : null}

                  {comparePath ? <polyline points={comparePath} fill="none" stroke="#4ade80" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.95" /> : null}
                  {primaryPath ? <polyline points={primaryPath} fill="none" stroke="#22d3ee" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /> : null}

                  {primaryMarkers.map((point, index) => (
                    <circle key={`p-${point.station}-${point.minute}-${index}`} cx={x(point.minute)} cy={y(point.station)} r="3.2" fill="#22d3ee">
                      <title>{`Train ${activeTrain?.train_number ?? ''} · ${point.station} · ${formatMinute(point.minute)}`}</title>
                    </circle>
                  ))}
                  {compareMarkers.map((point, index) => (
                    <circle key={`c-${point.station}-${point.minute}-${index}`} cx={x(point.minute)} cy={y(point.station)} r="3" fill="#4ade80">
                      <title>{`Train ${comparisonTrain?.train_number ?? ''} · ${point.station} · ${formatMinute(point.minute)}`}</title>
                    </circle>
                  ))}

                  {activeTrain && primaryLabel ? (
                    <text
                      x={primaryLabel.x}
                      y={Math.max(PLOT_TOP + 16, Math.min(plotBottom - 8, y(primaryLabel.point.station) - 12))}
                      textAnchor={primaryLabel.anchor}
                      fill="#22d3ee"
                      fontSize="13"
                      fontWeight="700"
                    >
                      Train {activeTrain.train_number}
                    </text>
                  ) : null}
                  {comparisonTrain && compareLabel ? (
                    <text
                      x={compareLabel.x}
                      y={Math.max(PLOT_TOP + 16, Math.min(plotBottom - 8, y(compareLabel.point.station) - 12))}
                      textAnchor={compareLabel.anchor}
                      fill="#4ade80"
                      fontSize="13"
                      fontWeight="700"
                    >
                      Train {comparisonTrain.train_number}
                    </text>
                  ) : null}

                  <text x={PLOT_LEFT} y={22} fill="#64748b" fontSize="10" fontWeight="700" letterSpacing="1.5">STATION</text>
                  <text x={plotRight} y={CHART_HEIGHT - 10} textAnchor="end" fill="#64748b" fontSize="10" fontWeight="700" letterSpacing="1.5">TIME →</text>
                </svg>
              </div>
            </section>

            <div className="flex flex-wrap gap-x-6 gap-y-2 px-1 text-xs text-gray-700">
              <span className="inline-flex items-center gap-2"><i className="h-2.5 w-6 rounded bg-cyan-400" /> Primary train {activeTrain?.train_number ?? '—'}</span>
              {comparisonTrain ? <span className="inline-flex items-center gap-2"><i className="h-2.5 w-6 rounded bg-green-400" /> Comparison train {comparisonTrain.train_number}</span> : null}
              <span className="inline-flex items-center gap-2"><i className="h-3 w-7 rounded border border-red-400/80 bg-red-400/15" /> Maintenance block ({formatMinute(selectedBlock?.start_minute ?? 0)} – {formatMinute(selectedBlock?.end_minute ?? 0)})</span>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded border border-cyan-500 bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Primary train</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{activeTrain?.train_number ?? '—'}</p>
                <p className="mt-1 text-sm text-gray-800">{activeTrain?.points[0]?.station ?? '—'} → {activeTrain?.points.at(-1)?.station ?? '—'}</p>
                <p className="mt-2 text-xs text-gray-500">{primaryPoints.length} plotted points · full schedule</p>
              </div>
              <div className="rounded border border-green-500 bg-white p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-green-300">Comparison train</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{comparisonTrain?.train_number ?? 'None'}</p>
                <p className="mt-1 text-sm text-gray-800">{comparisonTrain?.points[0]?.station ?? '—'} → {comparisonTrain?.points.at(-1)?.station ?? '—'}</p>
                <p className="mt-2 text-xs text-gray-500">{comparePoints.length} plotted points · full schedule</p>
              </div>
              <div className="rounded border border-red-400/30 bg-red-400/[0.035] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-300">Maintenance block</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{formatMinute(selectedBlock?.start_minute ?? 0)} – {formatMinute(selectedBlock?.end_minute ?? 0)}</p>
                <p className="mt-1 text-sm text-gray-800">{selectedBlock?.start_station ?? '—'} → {selectedBlock?.end_station ?? '—'}</p>
                <p className="mt-2 text-xs text-gray-500">{Math.max(0, (selectedBlock?.end_minute ?? 0) - (selectedBlock?.start_minute ?? 0))} minutes · infrastructure restriction</p>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Panel>
  )
}