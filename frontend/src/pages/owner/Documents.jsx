import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { projectsApi, documentsApi } from '@/services/api'
import { 
  FileText, Search, Filter, Download, 
  Trash2, Building2, Eye, FilePlus, ExternalLink
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export default function Documents() {
  const [projects, setProjects] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedProject, setSelectedProject] = useState('all')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data: pRes } = await projectsApi.list()
      setProjects(pRes.projects)
      
      const allDocs = []
      const apiUrl = import.meta.env.VITE_API_URL || ''
      for (const p of pRes.projects) {
        try {
          const { data: dRes } = await documentsApi.list(p._id)
          const docs = dRes.documents || []
          allDocs.push(...docs.map(d => ({ 
            ...d, 
            projectName: p.name, 
            projectId: p._id,
            fileUrl: d.fileUrl?.startsWith('http') ? d.fileUrl : `${apiUrl}${d.fileUrl}`
          })))
        } catch (err) {
          console.error(`Failed to load docs for project ${p.name}`, err)
        }
      }
      setDocuments(allDocs)
    } catch (err) {
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return
    try {
      await documentsApi.delete(id)
      toast.success('Document deleted')
      setDocuments(prev => prev.filter(d => d._id !== id))
    } catch (err) {
      toast.error('Failed to delete document')
    }
  }

  const filteredDocs = documents.filter(d => 
    (selectedProject === 'all' || d.projectId === selectedProject) &&
    (d.name.toLowerCase().includes(search.toLowerCase()) || d.projectName.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-8 pb-12 transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-text tracking-tight">Document Vault</h1>
          <p className="text-sm text-muted font-medium mt-1">Centralized storage for all your project legal papers and layouts</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input 
              type="text" 
              placeholder="Search documents..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-card border border-border/60 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <select 
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="h-11 px-4 bg-card border border-border/60 rounded-xl text-sm font-bold text-text outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Projects</option>
            {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="h-44 bg-card rounded-2xl animate-pulse border border-border" />)}
        </div>
      ) : filteredDocs.length === 0 ? (
        <Card className="p-24 text-center border-border/60 border-dashed border-2 bg-card/30">
          <div className="w-20 h-20 bg-bg rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
            <FileText className="w-10 h-10 text-muted" />
          </div>
          <h3 className="text-xl font-bold text-text">No documents found</h3>
          <p className="text-muted mt-2">Upload documents from individual project pages to see them here.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDocs.map((d) => (
            <Card key={d._id} className="p-5 border-border/60 shadow-sm hover:shadow-card-hover transition-all bg-card flex flex-col group overflow-hidden relative">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-12 bg-primary/10 text-primary flex items-center justify-center rounded-lg shadow-sm border border-primary/5 group-hover:scale-110 transition-transform">
                  <FileText size={24} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleDelete(d._id)} className="p-2 text-muted hover:text-red transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-text truncate group-hover:text-primary transition-colors" title={d.name}>{d.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary-light px-1.5 py-0.5 rounded">{d.type}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border/40 space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted font-bold">
                  <Building2 size={14} className="text-primary" /> 
                  <span className="truncate">{d.projectName}</span>
                </div>
                <a 
                  href={d.fileUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="w-full h-10 bg-bg hover:bg-primary hover:text-white text-primary text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all border border-border/60 group-hover:border-primary/20"
                >
                  <Eye size={14} /> View Document
                </a>
              </div>

              {/* Status Indicator */}
              <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
