import { useState, useRef } from 'react'
import { formatCurrency } from '@/utils/formatCurrency'
import { PlotStatusBadge } from '../PlotStatusBadge'

export function PlotMap({
  plots = [],
  userRole = 'owner',
  onPlotClick,
  selectedPlotId,
}) {
  const [hovered, setHovered] = useState(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef(null)

  const canClick = (plot) => {
    if (userRole === 'broker') return plot.status === 'available' || plot.status === 'hold'
    return true
  }

  const handlePointerDown = (e) => {
    if (e.target.tagName === 'rect' || e.target.tagName === 'text') return
    dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }

  const handlePointerMove = (e) => {
    if (!dragRef.current) return
    setPan({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y })
  }

  const handlePointerUp = () => {
    dragRef.current = null
  }

  const handleWheel = (e) => {
    e.preventDefault()
    const zoomFactor = 0.05
    const delta = e.deltaY < 0 ? 1 : -1
    setScale((prev) => Math.max(0.4, Math.min(prev + delta * zoomFactor, 3)))
  }

  // Fallback row/col if not populated
  const processedPlots = plots.map((plot, index) => {
    const row = typeof plot.gridRow === 'number' ? plot.gridRow : Math.floor(index / 7)
    const col = typeof plot.gridCol === 'number' ? plot.gridCol : (index % 7)
    return { ...plot, row, col }
  })

  const cols = Math.max(...processedPlots.map((p) => p.col), 6) + 1
  const rows = Math.max(...processedPlots.map((p) => p.row), 3) + 1
  const cellWidth = 140
  const cellHeight = 100
  const gap = 16
  const padding = 24
  const svgWidth = cols * (cellWidth + gap) - gap + padding * 2
  const svgHeight = rows * (cellHeight + gap) - gap + padding * 2

  const statusColors = {
    available:    { bg: 'rgba(34, 197, 94, 0.08)', stroke: 'rgba(34, 197, 94, 0.4)', text: '#22C55E', font: '#166534' },
    booked:       { bg: 'rgba(59, 130, 246, 0.08)', stroke: 'rgba(59, 130, 246, 0.4)', text: '#3B82F6', font: '#1E40AF' },
    sold:         { bg: 'rgba(239, 68, 68, 0.08)', stroke: 'rgba(239, 68, 68, 0.4)', text: '#EF4444', font: '#991B1B' },
    hold:         { bg: 'rgba(234, 179, 8, 0.08)', stroke: 'rgba(234, 179, 8, 0.4)', text: '#F59E0B', font: '#92400E' },
    not_for_sale: { bg: 'rgba(148, 163, 184, 0.05)', stroke: 'rgba(148, 163, 184, 0.25)', text: '#94A3B8', font: '#475569' },
  }

  const getColors = (plot) => {
    const isSelected = selectedPlotId === plot._id
    const base = statusColors[plot.status] || statusColors.available
    if (isSelected) {
      return {
        bg: 'rgba(79, 70, 229, 0.15)',
        stroke: '#4F46E5',
        text: '#4F46E5',
        font: '#3730A3',
        strokeWidth: 3,
      }
    }
    return {
      ...base,
      strokeWidth: 1.5,
    }
  }

  const hoveredPlot = plots.find((p) => p._id === hovered)

  return (
    <div className="space-y-4">
      {/* Zoom / Info Panel */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white/50 backdrop-blur-md p-3 rounded-2xl border border-border/40 shadow-sm">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(s + 0.15, 3))}
            className="h-9 px-4 text-sm font-bold rounded-xl border border-border bg-white hover:bg-bg active:scale-95 transition-all shadow-sm"
          >
            Zoom +
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(s - 0.15, 0.4))}
            className="h-9 px-4 text-sm font-bold rounded-xl border border-border bg-white hover:bg-bg active:scale-95 transition-all shadow-sm"
          >
            Zoom −
          </button>
          <button
            type="button"
            onClick={() => { setScale(1); setPan({ x: 0, y: 0 }) }}
            className="h-9 px-4 text-sm font-bold rounded-xl border border-border bg-white hover:bg-bg active:scale-95 transition-all shadow-sm"
          >
            Reset View
          </button>
        </div>
        
        {/* Floating Tooltip info */}
        <div className="min-h-[36px] flex items-center">
          {hoveredPlot ? (
            <div className="text-xs bg-card border border-border/80 rounded-xl px-4 py-2 shadow-md flex items-center gap-3 animate-in fade-in slide-in-from-right-2 duration-150">
              <span className="font-extrabold text-primary">Plot {hoveredPlot.plotNumber}</span>
              <span className="h-3 w-px bg-border/80" />
              <span className="font-bold text-text">{hoveredPlot.areaSqft} sqft</span>
              {hoveredPlot.cent && (
                <>
                  <span className="h-3 w-px bg-border/80" />
                  <span className="font-bold text-primary">{hoveredPlot.cent} Cent</span>
                </>
              )}
              <span className="h-3 w-px bg-border/80" />
              <span className="font-black text-emerald-500">{formatCurrency(hoveredPlot.price)}</span>
            </div>
          ) : (
            <p className="text-xs text-muted font-semibold uppercase tracking-wider">
              Hover plot to see dimensions • Click to select
            </p>
          )}
        </div>
      </div>

      {/* SVG Canvas Map Container */}
      <div
        className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-white/40 shadow-inner touch-none cursor-grab active:cursor-grabbing select-none"
        style={{ minHeight: 480 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            transition: dragRef.current ? 'none' : 'transform 150ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <svg
            width={svgWidth}
            height={svgHeight}
            className="overflow-visible"
          >
            {/* Grid Map Background styling */}
            <defs>
              <pattern id="grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="rgba(100, 116, 139, 0.07)" />
              </pattern>
            </defs>
            <rect width={svgWidth} height={svgHeight} fill="url(#grid-dots)" rx="24" />

            {/* Render each grid plot */}
            {processedPlots.map((plot) => {
              const x = padding + plot.col * (cellWidth + gap)
              const y = padding + plot.row * (cellHeight + gap)
              const colors = getColors(plot)
              const clickable = canClick(plot)
              const isHovered = hovered === plot._id

              return (
                <g
                  key={plot._id}
                  onClick={() => clickable && onPlotClick?.(plot)}
                  onMouseEnter={() => setHovered(plot._id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: clickable ? 'pointer' : 'default' }}
                  className="group"
                >
                  {/* Outer glow shadow for hovered / selected */}
                  {(isHovered || selectedPlotId === plot._id) && (
                    <rect
                      x={x - 4}
                      y={y - 4}
                      width={cellWidth + 8}
                      height={cellHeight + 8}
                      rx={12}
                      fill={selectedPlotId === plot._id ? 'rgba(79, 70, 229, 0.08)' : 'rgba(100, 116, 139, 0.05)'}
                      className="transition-all duration-200 animate-in fade-in zoom-in-95"
                    />
                  )}

                  {/* Main Grid Plot Rect */}
                  <rect
                    x={x}
                    y={y}
                    width={cellWidth}
                    height={cellHeight}
                    rx={10}
                    fill={colors.bg}
                    stroke={colors.stroke}
                    strokeWidth={colors.strokeWidth}
                    className="transition-all duration-200"
                  />

                  {/* Plot Text Details */}
                  {/* Plot No */}
                  <text
                    x={x + cellWidth / 2}
                    y={y + cellHeight / 2 - 10}
                    textAnchor="middle"
                    fill={colors.font}
                    className="text-sm font-black tracking-wide"
                  >
                    Plot {plot.plotNumber}
                  </text>

                  {/* Cent & Dimensions */}
                  <text
                    x={x + cellWidth / 2}
                    y={y + cellHeight / 2 + 12}
                    textAnchor="middle"
                    fill="rgba(100, 116, 139, 0.8)"
                    className="text-[10px] font-bold"
                  >
                    {plot.cent ? `${plot.cent} Cent` : `${plot.areaSqft} sqft`}
                  </text>
                  <text
                    x={x + cellWidth / 2}
                    y={y + cellHeight / 2 + 25}
                    textAnchor="middle"
                    fill="rgba(100, 116, 139, 0.6)"
                    className="text-[9px] font-semibold"
                  >
                    {plot.width && plot.length ? `${plot.width}×${plot.length} ft` : ''}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* Dynamic Status Badges Info */}
      <div className="flex flex-wrap gap-4 justify-center py-3 bg-bg/50 rounded-2xl border border-border/40 shadow-sm max-w-lg mx-auto">
        {['available', 'booked', 'sold', 'hold'].map((status) => (
          <PlotStatusBadge key={status} status={status} />
        ))}
      </div>
    </div>
  )
}
