import { useState, useEffect } from 'react';
import InteractivePlotMap from '../components/PlotMap/InteractivePlotMap';
import PricePerCentSetter from '../components/PlotMap/PricePerCentSetter';
import PlotImageUpload from '../components/PlotMap/PlotImageUpload';
import { projectsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ProjectMap({ projectId, onBookPlot }) {
  const { user } = useAuth();
  const [plots, setPlots] = useState([]);
  const [pricePerCent, setPricePerCent] = useState(0);
  const [gridCols, setGridCols] = useState(10);
  const [totalPlots, setTotalPlots] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlots();
  }, [projectId]);

  const loadPlots = async () => {
    setLoading(true);
    try {
      const data = await projectsApi.getPlots(projectId);
      setPlots(data.plots);
      setPricePerCent(data.pricePerCent || 0);
      setGridCols(data.gridCols || 10);
      setTotalPlots(data.totalPlots || data.plots.length);
    } catch (err) {
      console.error('Failed to load plots:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalysisComplete = (result) => {
    const payload = result?.data || result;
    if (payload?.plots?.length > 0) {
      setPlots(payload.plots);
      setGridCols(payload.gridCols || 10);
      setTotalPlots(payload.totalPlots || payload.plots.length);
      loadPlots();
    }
  };

  const handleStatusChange = async (plotId, newStatus) => {
    await projectsApi.updatePlotStatus(projectId, plotId, newStatus);
    setPlots(prev => prev.map(p => p._id === plotId ? { ...p, status: newStatus } : p));
  };

  const statusCount = (s) => plots.filter(p => p.status === s).length;

  if (loading) return <div style={{ color: '#888', padding: 20 }}>Loading plots...</div>;

  return (
    <div style={{ padding: '0 0 2rem' }}>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: totalPlots, color: '#888' },
          { label: 'Available', value: statusCount('available'), color: '#1D9E75' },
          { label: 'Booked', value: statusCount('booked'), color: '#BA7517' },
          { label: 'Sold', value: statusCount('sold'), color: '#888780' },
          { label: 'On Hold', value: statusCount('hold'), color: '#7F77DD' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: '#1a1a1a', border: '1px solid #2a2a2a',
            borderRadius: 8, padding: '6px 14px',
            fontSize: 13, color: '#888'
          }}>
            {label}: <strong style={{ color }}>{value}</strong>
          </div>
        ))}
      </div>

      {/* Price per cent setter (owner only) */}
      {user?.role === 'owner' && (
        <PricePerCentSetter
          projectId={projectId}
          currentPrice={pricePerCent}
          onUpdate={setPricePerCent}
        />
      )}

      {/* Image upload (owner only) */}
      {user?.role === 'owner' && plots.length === 0 && (
        <PlotImageUpload projectId={projectId} onAnalysisComplete={handleAnalysisComplete} />
      )}

      {/* Map */}
      {plots.length > 0 ? (
        <InteractivePlotMap
          plots={plots}
          pricePerCent={pricePerCent}
          gridCols={gridCols}
          onStatusChange={handleStatusChange}
          userRole={user?.role}
          onBookPlot={onBookPlot}
        />
      ) : (
        <div style={{
          border: '1px dashed #2a2a2a', borderRadius: 12,
          padding: '40px 20px', textAlign: 'center', color: '#555'
        }}>
          No plots yet. Upload a layout image to auto-detect plots.
        </div>
      )}
    </div>
  );
}
