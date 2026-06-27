import { useState, useRef } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, Maximize2, Upload, Calendar, Trash2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { projectsApi } from '@/services/api';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import { Button } from '@/components/ui/button';

export default function LayoutViewer({ projectId, layoutImageUrl, layoutUpdatedAt, onUpdated, onDeleted, canEdit = true }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageUrl, setImageUrl] = useState(layoutImageUrl);
  const [updatedAt, setUpdatedAt] = useState(layoutUpdatedAt);
  const [pendingFile, setPendingFile] = useState(null);
  const fileRef = useRef(null);
  const abortRef = useRef(false);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imageUrl && !window.confirm('This will replace the existing blueprint. Confirm?')) {
      e.target.value = '';
      return;
    }
    setPendingFile(file);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    setProgress(0);
    abortRef.current = false;
    try {
      const { data } = await projectsApi.uploadLayout(projectId, pendingFile, setProgress);
      if (abortRef.current) return;
      const url = data.data?.layoutImageUrl || data.layoutImageUrl;
      setImageUrl(url);
      setUpdatedAt(new Date().toISOString());
      setPendingFile(null);
      onUpdated?.(url);
      toast.success('Blueprint uploaded successfully');
    } catch (err) {
      if (!abortRef.current) {
        toast.error(err.response?.data?.message || err.response?.data?.error || 'Upload failed');
      }
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleCancelUpload = () => {
    abortRef.current = true;
    setUploading(false);
    setPendingFile(null);
    setProgress(0);
    toast('Upload cancelled');
  };

  const handleDeleteLayout = async () => {
    if (!window.confirm('Delete this blueprint? This does not remove extracted plot data.')) return;
    try {
      await projectsApi.deleteLayout(projectId);
      setImageUrl(null);
      setUpdatedAt(null);
      setPendingFile(null);
      onDeleted?.();
      onUpdated?.(null);
      toast.success('Blueprint deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete blueprint');
    }
  };

  const src = resolveMediaUrl(imageUrl);

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text">Blueprint Layout</h2>
          <p className="text-sm text-muted mt-1">Visual blueprint viewer only — plot table OCR is done in Configure Plots.</p>
          {updatedAt && (
            <p className="text-sm text-muted flex items-center gap-2 mt-1">
              <Calendar size={14} /> Last updated: {new Date(updatedAt).toLocaleString('en-IN')}
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,application/pdf" className="hidden" onChange={handleFileSelect} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} variant="outline" className="gap-2">
              <Upload size={16} /> {imageUrl ? 'Change Blueprint' : 'Upload Blueprint'}
            </Button>
            {pendingFile && !uploading && (
              <>
                <Button onClick={handleUpload} className="gap-2">Upload Selected</Button>
                <button type="button" onClick={() => setPendingFile(null)} className="btn-ghost text-sm py-2 px-4 flex items-center gap-1">
                  <X size={14} /> Cancel
                </button>
              </>
            )}
            {imageUrl && (
              <button type="button" onClick={handleDeleteLayout} className="btn-danger flex items-center gap-2 text-sm py-2 px-4">
                <Trash2 size={14} /> Delete Blueprint
              </button>
            )}
          </div>
        )}
      </div>

      {pendingFile && (
        <div className="glass-card p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-muted">Selected: <span className="text-text font-medium">{pendingFile.name}</span></p>
          {!uploading && (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleUpload}>Start Upload</Button>
              <button type="button" onClick={() => setPendingFile(null)} className="btn-ghost text-sm py-2 px-3">Cancel</button>
            </div>
          )}
        </div>
      )}

      {uploading && (
        <div className="space-y-2">
          <div className="w-full h-2 bg-primary/10 rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <button type="button" onClick={handleCancelUpload} className="btn-ghost text-sm py-2 px-4">Cancel Upload</button>
        </div>
      )}

      {!src ? (
        <div className="glass-card p-16 text-center text-muted">
          <Upload size={40} className="mx-auto mb-4 opacity-40" />
          <p>No blueprint uploaded yet. Upload a PNG, JPG, or PDF blueprint here.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden p-0">
          <TransformWrapper initialScale={1} minScale={0.4} maxScale={5} wheel={{ step: 0.08 }} panning={{ velocityDisabled: true }} centerOnInit centerZoomedOut>
            {({ zoomIn, zoomOut, resetTransform, centerView }) => (
              <>
                <div className="flex flex-wrap gap-2 p-3 border-b border-border bg-card">
                  <button type="button" onClick={() => zoomIn()} className="px-3 py-2 rounded-lg hover:bg-primary/10 text-text text-xs font-semibold flex items-center gap-1.5 border border-border"><ZoomIn size={14} /> Zoom In</button>
                  <button type="button" onClick={() => zoomOut()} className="px-3 py-2 rounded-lg hover:bg-primary/10 text-text text-xs font-semibold flex items-center gap-1.5 border border-border"><ZoomOut size={14} /> Zoom Out</button>
                  <button type="button" onClick={() => centerView(1)} className="px-3 py-2 rounded-lg hover:bg-primary/10 text-text text-xs font-semibold flex items-center gap-1.5 border border-border"><Maximize2 size={14} /> Fit Screen</button>
                  <button type="button" onClick={() => resetTransform()} className="px-3 py-2 rounded-lg hover:bg-primary/10 text-text text-xs font-semibold border border-border">Reset Zoom</button>
                </div>
                <div className="flex items-center justify-center min-h-[420px] md:min-h-[560px] p-6 md:p-10 bg-bg/40">
                  <TransformComponent wrapperClass="w-full flex items-center justify-center" contentClass="flex items-center justify-center">
                    <img src={src} alt="Project blueprint" className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md border border-border/40" draggable={false} />
                  </TransformComponent>
                </div>
              </>
            )}
          </TransformWrapper>
        </div>
      )}
    </div>
  );
}
