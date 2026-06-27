import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getPlotTooltipMetrics } from '@/utils/plotColors';
import { getSmartTooltipPosition } from '@/utils/smartTooltip';

function PlotTooltip({ plot, anchorRect }) {
  if (!plot || !anchorRect) return null;
  const m = getPlotTooltipMetrics(plot);
  const { top, left } = getSmartTooltipPosition(anchorRect, 210, 190);

  return createPortal(
    <div style={{
      position: 'fixed',
      top,
      left,
      zIndex: 9999,
      background: 'var(--card-bg)',
      color: 'var(--text)',
      fontSize: 12,
      borderRadius: 10,
      padding: '12px 14px',
      boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--border)',
      minWidth: 200,
      lineHeight: 1.45,
      pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
        Plot {m.plotNumber}
      </div>
      <div>Width (m): {m.width}</div>
      <div>Length (m): {m.length}</div>
      <div style={{ marginTop: 4 }}>Area (Sq.Mtr): {m.areaSqM}</div>
      <div>Area (Sq.Ft): {m.areaSqFt}</div>
      <div style={{ marginTop: 4, fontWeight: 600 }}>Cent: {m.cent}</div>
      <div style={{ marginTop: 4, color: 'var(--muted)' }}>Status: {m.status}</div>
    </div>,
    document.body
  );
}

const PlotGrid = ({ plots, userRole, onPlotClick, selectedPlot }) => {
  const [hovered, setHovered] = useState(null);
  const total = plots.length;

  const cols =
    total <= 20  ? 5  :
    total <= 50  ? 8  :
    total <= 100 ? 12 :
    total <= 200 ? 15 :
    total <= 500 ? 20 :
    total <= 1000 ? 25 : 30;

  const getCellSize = () => {
    if (total <= 20)  return { minH: 48, fontSize: 11 };
    if (total <= 50)  return { minH: 36, fontSize: 10 };
    if (total <= 100) return { minH: 28, fontSize: 9  };
    if (total <= 200) return { minH: 22, fontSize: 8  };
    if (total <= 500) return { minH: 18, fontSize: 7  };
    return { minH: 14, fontSize: 6 };
  };
  const cellSize = getCellSize();

  const statusStyles = {
    available:    { bg: 'var(--emerald-light)', text: 'var(--emerald)', border: '1.5px solid var(--emerald)' },
    booked:       { bg: 'var(--primary-light)', text: 'var(--primary)', border: '1.5px solid var(--primary)' },
    sold:         { bg: 'var(--red-light)', text: 'var(--red)', border: '1.5px solid var(--red)' },
    hold:         { bg: 'var(--amber-light)', text: 'var(--warning)', border: '1.5px solid var(--warning)' },
    not_for_sale: { bg: 'rgba(148, 163, 184, 0.12)', text: 'var(--muted)', border: '1.5px dashed var(--border)' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PlotTooltip plot={hovered?.plot} anchorRect={hovered?.rect} />

      <div style={{
        position: 'relative',
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: 'var(--card-bg)',
        minHeight: total <= 50 ? 400 : total <= 200 ? 500 : total <= 500 ? 600 : 700,
      }}>
        <div style={{
          padding: total > 500 ? 8 : total > 200 ? 12 : 16,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gap: total > 500 ? 1 : total > 200 ? 2 : 3,
          alignContent: 'start',
        }}>
          {plots.map((plot) => {
            const config = statusStyles[plot.status] || statusStyles.available;
            const isClickable = userRole === 'owner' || plot.status === 'available' || plot.status === 'hold';
            const isSelected = selectedPlot?._id === plot._id;
            const needsReview = plot.needsReview === true;

            return (
              <div
                key={plot._id}
                onClick={() => isClickable && onPlotClick?.(plot)}
                onMouseEnter={(e) => setHovered({ plot, rect: e.currentTarget.getBoundingClientRect() })}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: config.bg,
                  color: config.text,
                  border: isSelected ? '2px solid var(--primary)' : needsReview ? '1.5px solid var(--warning)' : config.border,
                  cursor: isClickable ? 'pointer' : 'default',
                  borderRadius: total > 500 ? 2 : total > 200 ? 3 : 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: cellSize.fontSize,
                  fontWeight: 600,
                  minHeight: cellSize.minH,
                  height: cellSize.minH,
                  transition: 'all 0.15s',
                  transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                  userSelect: 'none',
                  position: 'relative',
                }}
              >
                {total <= 500 ? plot.plotNumber : ''}
                {needsReview && (
                  <div style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, background: 'var(--warning)', borderRadius: '50%' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export { PlotGrid };
export default PlotGrid;
