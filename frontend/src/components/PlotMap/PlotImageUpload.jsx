import { useState } from 'react';
import { Upload, Loader, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { projectsApi } from '../../services/api';

const PlotImageUpload = ({ projectId, onAnalysisComplete, onFileSelected }) => {
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    onFileSelected?.(selectedFile);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      // Upload & analyze
      const response = await projectsApi.analyzeLayout(projectId, formData);
      
      // Handle axios wrapper response structure
      const result = response.data || response;
      onAnalysisComplete(result);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div className="relative group transition-all duration-300">
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
          id="plot-image"
        />
        <label
          htmlFor="plot-image"
          className="flex flex-col items-center justify-center border-2 border-dashed border-border/60 hover:border-primary/60 rounded-[2rem] p-10 text-center bg-card/40 backdrop-blur-md cursor-pointer hover:bg-card/70 transition-all duration-300 shadow-lg"
        >
          <div className="p-4 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-all duration-300">
            <Upload className="h-8 w-8" />
          </div>
          <p className="mt-4 text-sm font-bold text-text">
            Upload plot layout image or PDF
          </p>
          <p className="mt-1 text-xs text-muted font-medium">
            PNG, JPG, WEBP, or tabular PDF — PaddleOCR extracts plot numbers and cents per row
          </p>
        </label>
      </div>

      {/* Preview and trigger CTA */}
      {preview && (
        <div className="relative overflow-hidden rounded-[2rem] border border-border/80 bg-card/60 backdrop-blur-md p-4 shadow-xl animate-in zoom-in-95 duration-200">
          <div className="relative group rounded-2xl overflow-hidden border border-border/40">
            <img src={preview} alt="Layout preview" className="w-full h-auto max-h-[300px] object-contain bg-bg/50" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-bold bg-black/60 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <ImageIcon size={12} /> Changed layout? Upload another file
              </span>
            </div>
          </div>
          
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="mt-4 w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white py-3.5 px-6 rounded-2xl font-bold transition-all duration-300 disabled:opacity-50 shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
          >
            {analyzing ? (
              <>
                <Loader className="animate-spin" size={18} />
                <span className="animate-pulse">Analyzing Layout Image...</span>
              </>
            ) : (
              <>
                <CheckCircle size={18} />
                <span>Analyze & Detect Plots</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default PlotImageUpload;
