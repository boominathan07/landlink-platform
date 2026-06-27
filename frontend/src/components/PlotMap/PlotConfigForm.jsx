import { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { projectsApi } from '@/services/api'
import PlotImageUpload from './PlotImageUpload'

export function PlotConfigForm({ 
  projectId, 
  onGenerated, 
  existingPlotCount, 
  onExtractStart, 
  onAutoDetectGrid, 
  onAnalysisComplete,
  isExtracting,
  pendingLayoutFile,
  onPendingFileChange,
}) {
  const [activeTab, setActiveTab] = useState('auto')
  const [form, setForm] = useState({
    totalPlots: existingPlotCount || 35,
    columns: 7,
    defaultAreaSqft: 1200,
    defaultPrice: 1800000,
    prefix: '',
    startNumber: 1,
    defaultFacing: 'East',
    cornerPlots: '',
    roadFacingPlots: '',
    notForSalePlots: '',
  })
  const [generating, setGenerating] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGenerating(true)
    try {
      await projectsApi.generatePlots(projectId, form)
      onGenerated?.()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate plots')
    } finally {
      setGenerating(false)
    }
  }

  const rows = Math.ceil(form.totalPlots / form.columns)

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-bg/60 border border-border/60 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('auto')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'auto'
              ? 'bg-primary text-white shadow-md'
              : 'text-muted hover:bg-card/50'
          }`}
        >
          ⚡ Auto-Detect Layout
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'manual'
              ? 'bg-primary text-white shadow-md'
              : 'text-muted hover:bg-card/50'
          }`}
        >
          🛠️ Configure Manually
        </button>
      </div>

      {activeTab === 'auto' ? (
        <div className="space-y-6">
          <div className="bg-card border border-border/80 rounded-[2rem] p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-black text-text">PaddleOCR Table Parser</h3>
              <p className="text-xs text-muted font-semibold mt-1">Upload a plot table image or PDF for OCR only. This file is not saved as a blueprint and will not appear on the Layout page.</p>
            </div>
            
            <PlotImageUpload 
              projectId={projectId}
              onFileSelected={onPendingFileChange}
              onAnalysisComplete={(result) => {
                onPendingFileChange?.(null);
                if (onAnalysisComplete) {
                  onAnalysisComplete(result);
                }
              }} 
            />
            {pendingLayoutFile && (
              <div className="flex flex-col gap-2 pt-2">
                <p className="text-xs font-semibold text-muted">
                  Selected: {pendingLayoutFile.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => onAutoDetectGrid?.(pendingLayoutFile)} disabled={isExtracting} className="h-10">
                    {isExtracting ? 'Analyzing...' : 'Analyze & Create Plots'}
                  </Button>
                  <Button type="button" variant="outline" onClick={onExtractStart} disabled={isExtracting} className="h-10">
                    Preview Extracted Data
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-[12px] p-6">
          <h3 className="text-lg font-semibold text-text mb-4">Configure Plots</h3>
          <p className="text-sm text-muted mb-6">
            Auto-generate plots in a grid layout. System will create {form.totalPlots} plots in {rows} rows × {form.columns} columns.
          </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Total number of plots *</label>
              <Input
                type="number"
                min="1"
                value={form.totalPlots}
                onChange={(e) => setForm({ ...form, totalPlots: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Number of columns *</label>
              <Input
                type="number"
                min="1"
                value={form.columns}
                onChange={(e) => setForm({ ...form, columns: parseInt(e.target.value) || 1 })}
                required
              />
              <p className="text-xs text-muted mt-1">Rows auto-calculated: {rows}</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Default area per plot (sqft) *</label>
              <Input
                type="number"
                min="1"
                value={form.defaultAreaSqft}
                onChange={(e) => setForm({ ...form, defaultAreaSqft: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Default price per plot (₹) *</label>
              <Input
                type="number"
                min="1"
                value={form.defaultPrice}
                onChange={(e) => setForm({ ...form, defaultPrice: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Plot number prefix (optional)</label>
              <Input
                placeholder="e.g., A for A-1, A-2..."
                value={form.prefix}
                onChange={(e) => setForm({ ...form, prefix: e.target.value })}
              />
              <p className="text-xs text-muted mt-1">Leave empty for 1, 2, 3...</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Starting number</label>
              <Input
                type="number"
                min="1"
                value={form.startNumber}
                onChange={(e) => setForm({ ...form, startNumber: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Default facing *</label>
            <select
              className="w-full h-10 px-3 border border-border rounded-[10px] text-sm bg-bg text-text"
              value={form.defaultFacing}
              onChange={(e) => setForm({ ...form, defaultFacing: e.target.value })}
              required
            >
              <option value="North">North</option>
              <option value="South">South</option>
              <option value="East">East</option>
              <option value="West">West</option>
              <option value="NE">North-East</option>
              <option value="NW">North-West</option>
              <option value="SE">South-East</option>
              <option value="SW">South-West</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Corner plots (comma-separated)</label>
            <Input
              placeholder="e.g., 1,7,29,35"
              value={form.cornerPlots}
              onChange={(e) => setForm({ ...form, cornerPlots: e.target.value })}
            />
            <p className="text-xs text-muted mt-1">These plots get 10% price premium</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Road-facing plots (comma-separated)</label>
            <Input
              placeholder="e.g., 1,2,3"
              value={form.roadFacingPlots}
              onChange={(e) => setForm({ ...form, roadFacingPlots: e.target.value })}
            />
            <p className="text-xs text-muted mt-1">These plots get 10% price premium</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Not-for-sale plots (comma-separated)</label>
            <Input
              placeholder="e.g., 8,9"
              value={form.notForSalePlots}
              onChange={(e) => setForm({ ...form, notForSalePlots: e.target.value })}
            />
            <p className="text-xs text-muted mt-1">Marked as road/park, gray color, not bookable</p>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button type="submit" disabled={generating}>
              {generating ? 'Generating...' : 'Generate Plots'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => onGenerated?.()}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
      )}

      <div className="bg-amber-light border border-amber/30 rounded-[12px] p-4">
        <p className="text-sm text-accent">
          <strong>⚠ Note:</strong> This will replace all existing plots for this project.
          Make sure to configure correctly before generating.
        </p>
      </div>
    </div>
  )
}
