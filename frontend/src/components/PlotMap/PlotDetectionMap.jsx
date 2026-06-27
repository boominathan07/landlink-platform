import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Check, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { projectsApi } from '@/services/api';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import { Button } from '@/components/ui/button';

const STATUS_COLORS = {
  available: { fill: 'rgba(16, 185, 129, 0.25)', stroke: '#10B981', label: 'Available' },
  hold: { fill: 'rgba(245, 158, 11, 0.25)', stroke: '#F59E0B', label: 'Hold' },
  sold: { fill: 'rgba(239, 68, 68, 0.25)', stroke: '#EF4444', label: 'Sold' },
  booked: { fill: 'rgba(79, 142, 247, 0.25)', stroke: '#4F8EF7', label: 'Booked' },
};

export default function PlotDetectionMap({ projectId, layoutImageUrl, onConfirmed, autoRun = false }) {
  const [plots, setPlots] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef(null);
  const drawStart = useRef(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [draftRect, setDraftRect] = useState(null);

  const imageSrc = resolveMediaUrl(layoutImageUrl);

  const runDetection = useCallback(async () => {
    setDetecting(true);
    try {
      const { data } = await projectsApi.autoDetectPlots(projectId);
      setPlots(data.plots || []);
      toast.success(`Detected ${data.plots?.length || 0} plots`);
    } catch (err) {
      console.error('Auto-detect error:', err.response?.data || err.message);
      toast.error(err.response?.data?.message || 'Could not auto-detect plots');
    } finally {
      setDetecting(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (layoutImageUrl && autoRun) runDetection();
  }, [layoutImageUrl, autoRun, runDetection]);

  const pctFromEvent = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleMouseDown = (e) => {
    if (!manualMode) return;
    const pt = pctFromEvent(e);
    if (!pt) return;
    drawStart.current = pt;
    setDraftRect({ x: pt.x, y: pt.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e) => {
    if (!manualMode || !drawStart.current) return;
    const pt = pctFromEvent(e);
    if (!pt) return;
    const x = Math.min(drawStart.current.x, pt.x);
    const y = Math.min(drawStart.current.y, pt.y);
    const width = Math.abs(pt.x - drawStart.current.x);
    const height = Math.abs(pt.y - drawStart.current.y);
    setDraftRect({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (!manualMode || !draftRect || draftRect.width < 1 || draftRect.height < 1) {
      drawStart.current = null;
      setDraftRect(null);
      return;
    }
    const plotNumber = `Plot-${plots.length + 1}`;
    setPlots((prev) => [
      ...prev,
      {
        plotId: `plot-${prev.length + 1}`,
        plotNumber,
        x: draftRect.x,
        y: draftRect.y,
        width: draftRect.width,
        height: draftRect.height,
        coordinates: { ...draftRect },
        status: 'available',
      },
    ]);
    drawStart.current = null;
    setDraftRect(null);
  };

  const handleConfirm = async () => {
    if (!plots.length) return;
    setSaving(true);
    try {
      await projectsApi.confirmAutoPlots(projectId, plots);
      toast.success(`Saved ${plots.length} plots`);
      onConfirmed?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save plots');
    } finally {
      setSaving(false);
    }
  };

  if (!imageSrc) {
    return (
      <div className="luxury-card text-center text-muted py-12">
        Upload a layout image first to detect plots.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h3 className="section-title text-text text-xl">Plot Detection</h3>
          <p className="text-sm text-muted">Click rectangles to select · {plots.length} plots detected</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={runDetection} disabled={detecting}>
            {detecting ? 'Detecting…' : 'Auto-Detect Plots'}
          </Button>
          <Button
            variant={manualMode ? 'default' : 'outline'}
            onClick={() => setManualMode((m) => !m)}
            className="gap-2"
          >
            <Pencil size={14} /> Manual Draw
          </Button>
          <Button onClick={handleConfirm} disabled={saving || !plots.length} className="gap-2">
            <Check size={14} /> Confirm Plots
          </Button>
        </div>
      </div>

      {manualMode && (
        <p className="text-xs text-muted label-caption">
          Click and drag on the image to draw plot boundaries
        </p>
      )}

      <div
        ref={containerRef}
        className="relative w-full rounded-xl overflow-hidden border border-border select-none"
        style={{ cursor: manualMode ? 'crosshair' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img src={imageSrc} alt="Layout" className="w-full block" draggable={false} />
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          style={{ pointerEvents: manualMode ? 'none' : 'auto' }}
        >
          {plots.map((plot, idx) => {
            const c = plot.coordinates || plot.percentBounds || plot;
            const x = c.x ?? 0;
            const y = c.y ?? 0;
            const w = c.width ?? c.w ?? 5;
            const h = c.height ?? c.h ?? 5;
            const style = STATUS_COLORS[plot.status] || STATUS_COLORS.available;
            const isSelected = selectedIdx === idx;
            const isHovered = hoveredIdx === idx;
            return (
              <motion.rect
                key={plot.plotId || idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.04, type: 'spring', stiffness: 300, damping: 30 }}
                x={x}
                y={y}
                width={w}
                height={h}
                fill={isHovered ? style.fill.replace('0.25', '0.45') : style.fill}
                stroke={isSelected ? '#4F8EF7' : style.stroke}
                strokeWidth={isSelected ? 0.8 : 0.4}
                rx={0.3}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => !manualMode && setSelectedIdx(isSelected ? null : idx)}
              />
            );
          })}
          {draftRect && (
            <rect
              x={draftRect.x}
              y={draftRect.y}
              width={draftRect.width}
              height={draftRect.height}
              fill="rgba(201,168,76,0.25)"
              stroke="#C9A84C"
              strokeWidth={0.5}
              strokeDasharray="1 0.5"
            />
          )}
        </svg>
      </div>

      <AnimatePresence>
        {hoveredIdx != null && plots[hoveredIdx] && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card p-4 max-w-xs"
          >
            <p className="font-bold text-text">Plot {plots[hoveredIdx].plotNumber}</p>
            <p className="text-sm text-muted mt-1">{STATUS_COLORS[plots[hoveredIdx].status]?.label || 'Available'}</p>
            {plots[hoveredIdx].extractedArea && (
              <p className="text-sm text-muted mt-1">Area: {plots[hoveredIdx].extractedArea}</p>
            )}
            {plots[hoveredIdx].rawText && plots[hoveredIdx].rawText !== plots[hoveredIdx].plotNumber && (
              <p className="text-xs text-muted mt-2 truncate">{plots[hoveredIdx].rawText}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {selectedIdx != null && plots[selectedIdx] && (
        <div className="luxury-card flex items-center justify-between py-4">
          <span className="font-medium text-text">{plots[selectedIdx].plotNumber}</span>
          <button
            type="button"
            className="text-muted hover:text-red flex items-center gap-1 text-sm"
            onClick={() => {
              setPlots((prev) => prev.filter((_, i) => i !== selectedIdx));
              setSelectedIdx(null);
            }}
          >
            <RotateCcw size={14} /> Remove
          </button>
        </div>
      )}
    </div>
  );
}
