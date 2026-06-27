import { useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react';
import { resolveMediaUrl } from '@/utils/mediaUrl';

const STATUS_COLORS = {
  available: { fill: 'rgba(45, 106, 79, 0.4)', stroke: '#2D6A4F', label: 'Available' },
  sold: { fill: 'rgba(139, 26, 26, 0.4)', stroke: '#8B1A1A', label: 'Sold' },
  hold: { fill: 'rgba(181, 119, 13, 0.4)', stroke: '#B5770D', label: 'Reserved' },
  booked: { fill: 'rgba(201, 168, 76, 0.35)', stroke: '#C9A84C', label: 'Booked' },
  not_for_sale: { fill: 'rgba(140, 128, 112, 0.25)', stroke: '#8C8070', label: 'N/A' },
};

export default function SvgPlotMap({ plots = [], layoutImageUrl, readOnly = false, onPlotClick }) {
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const imageUrl = resolveMediaUrl(layoutImageUrl);

  const handleClick = (plot) => {
    setSelected(plot);
    onPlotClick?.(plot);
  };

  const active = hovered || selected;

  return (
    <div className="glass-card overflow-hidden">
      <TransformWrapper initialScale={1} minScale={0.4} maxScale={4} centerOnInit>
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="flex items-center gap-2 p-3 border-b border-border/40 bg-bg/30">
              <button type="button" onClick={() => zoomIn()} className="p-2 rounded-lg hover:bg-primary/10 text-text"><ZoomIn size={16} /></button>
              <button type="button" onClick={() => zoomOut()} className="p-2 rounded-lg hover:bg-primary/10 text-text"><ZoomOut size={16} /></button>
              <button type="button" onClick={() => resetTransform()} className="p-2 rounded-lg hover:bg-primary/10 text-text"><Maximize2 size={16} /></button>
              <div className="ml-auto flex gap-3 text-xs text-muted">
                {Object.values(STATUS_COLORS).map((s) => (
                  <span key={s.label} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.stroke }} /> {s.label}
                  </span>
                ))}
              </div>
            </div>

            <TransformComponent wrapperClass="w-full" contentClass="w-full">
              <div className="relative w-full" style={{ minHeight: 480 }}>
                {imageUrl && (
                  <img src={imageUrl} alt="Layout" className="w-full block opacity-30 pointer-events-none select-none" />
                )}
                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                  {plots.map((plot) => {
                    const c = plot.coordinates || plot.position || { x: 0, y: 0, width: 5, height: 5 };
                    const style = STATUS_COLORS[plot.status] || STATUS_COLORS.available;
                    const isActive = active?.plotId === plot.plotId || active?._id === plot.plotId;
                    return (
                      <g key={plot.plotId || plot._id}>
                        <rect
                          x={c.x}
                          y={c.y}
                          width={c.width}
                          height={c.height}
                          fill={style.fill}
                          stroke={isActive ? '#6C63FF' : style.stroke}
                          strokeWidth={isActive ? 0.6 : 0.35}
                          rx={0.4}
                          className={readOnly ? 'cursor-pointer' : 'cursor-pointer'}
                          onMouseEnter={() => setHovered(plot)}
                          onMouseLeave={() => setHovered(null)}
                          onClick={() => handleClick(plot)}
                        />
                        {c.width > 3 && (
                          <text
                            x={c.x + c.width / 2}
                            y={c.y + c.height / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={Math.min(c.width, c.height) * 0.35}
                            fill="#fff"
                            fontWeight="700"
                            pointerEvents="none"
                          >
                            {plot.plotNumber}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>

      {selected && (
        <div className="p-4 border-t border-border/40 bg-bg/40 animate-fade-in">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-bold text-text">Plot {selected.plotNumber}</p>
              <p className="text-sm text-accent capitalize">{selected.status}</p>
              {selected.size?.areaSqFeet && (
                <p className="text-sm text-muted mt-1">{selected.size.areaSqFeet} sqft</p>
              )}
              {selected.price > 0 && (
                <p className="text-sm font-semibold text-primary mt-1">₹{Number(selected.price).toLocaleString('en-IN')}</p>
              )}
            </div>
            <button type="button" onClick={() => setSelected(null)} className="p-1 text-muted hover:text-text">
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
