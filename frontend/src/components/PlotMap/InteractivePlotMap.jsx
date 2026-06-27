import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getPlotTooltipMetrics, PLOT_STATUS, STATUS_LABELS } from '@/utils/plotColors';
import { getSmartTooltipPosition } from '@/utils/smartTooltip';
import { plotsApi } from '@/services/api';

const fmt = (v, dec = 2) => (v != null ? Number(v).toFixed(dec) : '—');
const fmtPrice = (v) => (v ? `₹${Number(v).toLocaleString('en-IN')}` : '—');

const STATUS_STYLE = {
  available: { bg: 'var(--emerald-light)', border: 'var(--emerald)', text: 'var(--emerald)' },
  booked:    { bg: 'var(--amber-light)', border: 'var(--warning)', text: 'var(--warning)' },
  sold:      { bg: 'var(--red-light)', border: 'var(--red)', text: 'var(--red)' },
  hold:      { bg: 'var(--purple-light)', border: 'var(--purple)', text: 'var(--purple)' },
  not_for_sale: { bg: 'rgba(148, 163, 184, 0.12)', border: 'var(--muted)', text: 'var(--muted)' },
};

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

export default function InteractivePlotMap({ plots, pricePerCent, gridCols, onStatusChange, userRole, onBookPlot, onPlotChange }) {
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);

  const sortedPlots = useMemo(() =>
    [...plots].sort((a, b) => {
      const na = parseInt(String(a.plotNumber).replace(/\D/g, ''), 10) || 0;
      const nb = parseInt(String(b.plotNumber).replace(/\D/g, ''), 10) || 0;
      return na - nb;
    }), [plots]
  );

  const cols = gridCols || (plots.length <= 10 ? plots.length : plots.length <= 50 ? 10 : Math.ceil(Math.sqrt(plots.length)));

  const getPlotPrice = (plot) => {
    if (!pricePerCent || !(plot.cents ?? plot.cent)) return null;
    return (plot.cents ?? plot.cent) * pricePerCent;
  };

  const handleStatusChange = async (newStatus) => {
    if (!selected || userRole !== 'owner') return;
    try {
      if (onStatusChange) await onStatusChange(selected._id, newStatus);
      setSelected((prev) => ({ ...prev, status: newStatus }));
    } catch {
      /* parent handles toast */
    }
  };

  const selectedPlot = selected ? sortedPlots.find((p) => p._id === selected._id) || selected : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <PlotTooltip plot={hovered?.plot} anchorRect={hovered?.rect} />

      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, background: 'var(--card-bg)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 4 }}>
          {sortedPlots.map((plot) => {
            const style = STATUS_STYLE[plot.status] || STATUS_STYLE.available;
            const isSelected = selectedPlot?._id === plot._id;
            const needsReview = plot.needsReview === true;

            return (
              <div
                key={plot._id}
                onClick={() => setSelected(isSelected ? null : plot)}
                style={{
                  background: style.bg,
                  border: `2px solid ${needsReview ? 'var(--warning)' : isSelected ? 'var(--primary)' : style.border}`,
                  color: style.text,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: plots.length > 80 ? 10 : plots.length > 40 ? 11 : 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  aspectRatio: '1',
                  transition: 'transform 0.1s',
                  boxShadow: isSelected ? '0 0 0 3px var(--primary-light)' : 'none',
                  userSelect: 'none',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  setHovered({ plot, rect: e.currentTarget.getBoundingClientRect() });
                  if (!isSelected) e.currentTarget.style.transform = 'scale(1.06)';
                }}
                onMouseLeave={(e) => {
                  setHovered(null);
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {plot.plotNumber}
                {needsReview && (
                  <span style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedPlot && (
        <div style={{ marginTop: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>PLOT NUMBER</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{selectedPlot.plotNumber}</div>
            </div>
            <span style={{
              background: STATUS_STYLE[selectedPlot.status]?.bg || STATUS_STYLE.available.bg,
              color: STATUS_STYLE[selectedPlot.status]?.text || STATUS_STYLE.available.text,
              border: `1px solid ${STATUS_STYLE[selectedPlot.status]?.border || STATUS_STYLE.available.border}`,
              borderRadius: 20,
              padding: '3px 12px',
              fontSize: 12,
              fontWeight: 600,
            }}>
              {STATUS_LABELS[selectedPlot.status] || 'Available'}
            </span>
            <button type="button" onClick={() => setSelected(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>

          {(() => {
            const m = getPlotTooltipMetrics(selectedPlot);
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
                {[
                  { label: 'WIDTH (M)', value: m.width },
                  { label: 'LENGTH (M)', value: m.length },
                  { label: 'CENT', value: m.cent },
                  { label: 'AREA (SQM)', value: m.areaSqM },
                  { label: 'AREA (SQFT)', value: m.areaSqFt },
                  { label: 'STATUS', value: m.status },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
            Total price:{' '}
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--emerald)' }}>
              {getPlotPrice(selectedPlot) ? fmtPrice(getPlotPrice(selectedPlot)) : 'Set price/cent first'}
            </span>
          </div>

          {userRole === 'owner' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Change status:</span>
              {Object.entries(PLOT_STATUS).filter(([k]) => k !== 'selected').map(([status, st]) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleStatusChange(status)}
                  style={{
                    background: selectedPlot.status === status ? st.bg : 'transparent',
                    border: `1.5px solid ${st.border}`,
                    color: st.text,
                    borderRadius: 20,
                    padding: '4px 14px',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>
          )}

          {userRole === 'broker' && selectedPlot.status === 'available' && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {onBookPlot && (
                <>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault()
                      try {
                        const { data } = await plotsApi.hold(selectedPlot._id);
                        const updated = data.plot || { status: 'hold' };
                        setSelected((prev) => ({ ...prev, ...updated }));
                        onPlotChange?.(data.plot || { _id: selectedPlot._id, status: 'hold' });
                      } catch (err) {
                        alert(err.response?.data?.message || 'Failed to hold plot');
                      }
                    }}
                    style={{ background: 'var(--warning)', color: '#fff', border: 'none', borderRadius: 20, padding: '6px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Hold 24hrs
                  </button>
                  <button type="button" onClick={() => onBookPlot(selectedPlot)} style={{ background: 'var(--emerald)', color: '#fff', border: 'none', borderRadius: 20, padding: '6px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Book Plot
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
