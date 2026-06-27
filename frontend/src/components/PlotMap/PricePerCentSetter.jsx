import { useState } from 'react';
import { IndianRupee, Check } from 'lucide-react';
import { projectsApi } from '../../services/api';

export default function PricePerCentSetter({ projectId, currentPrice, onUpdate }) {
  const [price, setPrice] = useState(currentPrice || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!price || price <= 0) return;
    setSaving(true);
    try {
      await projectsApi.setPricePerCent(projectId, parseFloat(price));
      onUpdate(parseFloat(price));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: '#1a1a1a',
      border: '1px solid #2a2a2a',
      borderRadius: 8,
      padding: '10px 14px',
      marginBottom: 12,
      flexWrap: 'wrap',
    }}>
      <IndianRupee size={16} color="#1D9E75" />
      <span style={{ fontSize: 13, color: '#888' }}>Price per cent (₹)</span>
      <input
        type="number"
        value={price}
        onChange={e => setPrice(e.target.value)}
        placeholder="e.g. 50000"
        min="0"
        style={{
          background: '#111',
          border: '1px solid #333',
          borderRadius: 6,
          color: '#fff',
          padding: '6px 10px',
          fontSize: 13,
          width: 130,
        }}
      />
      <button
        onClick={handleSave}
        disabled={saving || !price}
        style={{
          background: saved ? '#1D9E75' : '#185FA5',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '6px 16px',
          fontSize: 13,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saved ? <><Check size={14} /> Saved</> : saving ? 'Saving...' : 'Set Price'}
      </button>
      {currentPrice > 0 && (
        <span style={{ fontSize: 12, color: '#555' }}>
          Current: ₹{Number(currentPrice).toLocaleString('en-IN')}/cent
        </span>
      )}
    </div>
  );
}
