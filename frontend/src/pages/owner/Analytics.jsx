import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { analyticsApi } from '@/services/api'
import { formatCurrency } from '@/utils/formatCurrency'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts'
import { 
  TrendingUp, Users, IndianRupee, PieChart as PieIcon, 
  BarChart2, ArrowUpRight, Download, RefreshCcw, ChevronDown, Calendar, ArrowRight
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/ThemeContext'

function useChartColors() {
  const { theme } = useTheme()
  return useMemo(() => {
    const root = document.documentElement
    const isDark =
      root.classList.contains('dark') ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
      (theme === 'dark')
    return {
      tick: isDark ? '#8892A4' : '#6B7280',
      text: isDark ? '#E8EAF0' : '#1C1C1E',
      grid: isDark ? 'rgba(79, 142, 247, 0.12)' : '#E5E7EB',
      tooltipBg: isDark ? '#0A0F1E' : '#FFFFFF',
      tooltipText: isDark ? '#E8EAF0' : '#1C1C1E',
      tooltipLabel: isDark ? '#8892A4' : '#6B7280',
      primary: isDark ? '#4F8EF7' : '#3A6FD4',
      amber: '#F59E0B',
    }
  }, [theme])
}

const chartTooltipProps = (colors) => ({
  contentStyle: {
    backgroundColor: colors.tooltipBg,
    borderColor: colors.grid,
    borderRadius: '12px',
    color: colors.tooltipText,
  },
  labelStyle: { color: colors.tooltipLabel, fontWeight: 600 },
  itemStyle: { color: colors.tooltipText, fontWeight: 700 },
})

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateRange, setDateRange] = useState('30days')
  const [isExporting, setIsExporting] = useState(false)
  const chartColors = useChartColors()

  useEffect(() => {
    fetchAnalytics()
  }, [dateRange])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const params = {}
      if (dateRange !== 'all') {
        const end = new Date()
        const start = new Date()
        const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 90
        start.setDate(end.getDate() - days)
        params.startDate = start.toISOString().split('T')[0]
        params.endDate = end.toISOString().split('T')[0]
      }

      const [overviewRes, chartsRes] = await Promise.all([
        analyticsApi.overview(params),
        analyticsApi.charts(params)
      ])
      
      setData({ ...overviewRes.data, ...chartsRes.data })
      setError(null)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const response = await analyticsApi.export()
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `landlink_analytics_${new Date().toISOString().slice(0,10)}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Report exported successfully!')
    } catch (err) {
      toast.error('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <div className="h-12 w-64 bg-card rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-card rounded-3xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-[450px] bg-card rounded-3xl" />
          <div className="h-[450px] bg-card rounded-3xl" />
        </div>
      </div>
    )
  }

  const COLORS = ['#1D9E75', '#F59E0B', '#EF4444', '#8B5CF6', '#64748B']

  const pieData = data?.plotStats ? [
    { name: 'Available', value: data.plotStats.available || 0 },
    { name: 'Booked', value: data.plotStats.booked || 0 },
    { name: 'Sold', value: data.plotStats.sold || 0 },
    { name: 'On Hold', value: data.plotStats.onHold || 0 },
  ] : []

  return (
    <div className="p-1 md:p-6 space-y-10 pb-16">
      {error && (
        <div className="rounded-xl border border-danger/30 bg-red-light/40 px-5 py-4 flex items-center justify-between gap-4">
          <p className="text-sm text-danger font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchAnalytics}>Retry</Button>
        </div>
      )}

      {!error && data && (data.completedSales || 0) === 0 && (data.plotStats?.total || 0) > 0 && (
        <div className="rounded-xl border border-border/60 bg-card px-5 py-4 text-sm text-muted">
          No completed sales in this period yet. Inventory and plot stats below reflect your live project data.
        </div>
      )}
      {/* Header Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 bg-card p-8 rounded-[40px] border border-border/50 shadow-sm relative overflow-hidden group">
        <div className="relative z-10">
          <h1 className="page-title text-text tracking-tight">Business Intelligence</h1>
          <p className="text-xs text-muted font-medium mt-1 uppercase tracking-wider flex items-center gap-2">
            <Calendar size={14} className="text-primary" /> 
            {dateRange === 'all' ? 'Cumulative Performance' : `Performance: Last ${dateRange.replace('days', '')} Days`}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 relative z-10">
          <div className="flex items-center bg-bg border border-border/60 rounded-2xl p-1.5 shadow-inner">
            {['7days', '30days', '90days', 'all'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={cn(
                  "px-6 py-2.5 text-[11px] font-black rounded-xl capitalize transition-all tracking-widest",
                  dateRange === range 
                    ? "bg-card text-primary shadow-sm ring-1 ring-border/40" 
                    : "text-muted hover:text-text"
                )}
              >
                {range.replace('days', 'd')}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={fetchAnalytics}
              className="h-[52px] w-[52px] p-0 border-border/60 hover:text-primary rounded-2xl bg-card shadow-sm group transition-all"
            >
              <RefreshCcw size={20} className={cn("transition-transform duration-700", loading && "animate-spin")} />
            </Button>

            <Button 
              onClick={handleExport}
              disabled={isExporting}
              className="h-[52px] px-8 font-black gap-3 bg-primary hover:bg-primary-dark text-white shadow-xl shadow-primary/20 rounded-2xl group transition-all"
            >
              <Download size={20} className="group-hover:-translate-y-0.5 transition-transform" /> 
              {isExporting ? 'Exporting...' : 'Generate Report'}
            </Button>
          </div>
        </div>
        
        {/* BG Accent */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/10 transition-all duration-1000" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard 
          label="Gross Revenue" 
          value={formatCurrency(data?.revenue || 0)} 
          icon={IndianRupee} 
          color="emerald" 
          trend={data?.completedSales ? `${data.completedSales} sales` : 'No sales yet'} 
        />
        <StatCard 
          label="Successful Closures" 
          value={data?.completedSales || 0} 
          icon={ArrowUpRight} 
          color="primary" 
          trend={data?.plotStats?.sold ? `${data.plotStats.sold} plots sold` : '—'} 
        />
        <StatCard 
          label="Net Earnings" 
          value={formatCurrency(data?.netRevenue || 0)} 
          icon={TrendingUp} 
          color="purple" 
          trend={data?.commissions ? `${formatCurrency(data.commissions)} commissions` : '—'} 
        />
        <StatCard 
          label="Active Brokers" 
          value={data?.activeBrokers || 0} 
          icon={Users} 
          color="amber" 
          trend="Strong Network" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Area Chart */}
        <Card className="lg:col-span-2 border-border/60 shadow-sm rounded-[40px] overflow-hidden bg-card">
          <div className="p-8 border-b border-border/40 flex items-center justify-between bg-bg/10">
            <div>
              <h3 className="font-black text-text text-lg tracking-tight">Revenue Trajectory</h3>
              <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-1">Monthly financial overview</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-2xl">
              <TrendingUp size={20} className="text-primary" />
            </div>
          </div>
          <CardContent className="p-8">
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.monthlyStats || []}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.15}/>
                      <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} opacity={0.6} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: chartColors.tick, fontSize: 11, fontWeight: 700 }} 
                    dy={15} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: chartColors.tick, fontSize: 11, fontWeight: 700 }} 
                    tickFormatter={(v) => `₹${v >= 1000 ? v/1000 + 'k' : v}`} 
                  />
                  <Tooltip 
                    {...chartTooltipProps(chartColors)}
                    cursor={{ stroke: chartColors.primary, strokeWidth: 2, strokeDasharray: '5 5' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke={chartColors.primary} strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" animationDuration={800} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Status Pie */}
        <Card className="lg:col-span-1 border-border/60 shadow-sm rounded-[40px] overflow-hidden bg-card">
          <div className="p-8 border-b border-border/40 bg-bg/10 flex items-center justify-between">
            <h3 className="font-black text-text text-lg tracking-tight">Inventory Health</h3>
            <div className="p-3 bg-amber/10 rounded-2xl">
              <PieIcon size={20} className="text-amber" />
            </div>
          </div>
          <CardContent className="p-8">
            <div className="h-[320px] w-full relative mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={85}
                    outerRadius={115}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip {...chartTooltipProps(chartColors)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-3xl font-black text-text tracking-tighter">{data?.plotStats?.total || 0}</p>
                <p className="text-[10px] text-muted font-black uppercase tracking-[0.2em]">Total Units</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {pieData.map((item, i) => (
                <div key={item.name} className="p-3 rounded-2xl bg-bg/40 border border-border/30 flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-muted uppercase tracking-wider truncate">{item.name}</p>
                    <p className="text-sm font-black text-text">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Broker Leaderboard & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-border/60 shadow-sm rounded-[40px] overflow-hidden bg-card">
          <div className="p-8 border-b border-border/40 flex items-center justify-between">
            <div>
              <h3 className="font-black text-text text-lg tracking-tight">Channel Partner Performance</h3>
              <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-1">Top 5 conversion partners</p>
            </div>
            <Button variant="ghost" className="text-primary font-black text-[11px] uppercase tracking-widest gap-2">
              All Partners <ArrowRight size={14} />
            </Button>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-bg/40 border-b border-border/30">
                    <th className="px-10 py-6 text-[10px] font-black text-muted uppercase tracking-widest">Partner Identity</th>
                    <th className="px-10 py-6 text-[10px] font-black text-muted uppercase tracking-widest">Sales Vol.</th>
                    <th className="px-10 py-6 text-[10px] font-black text-muted uppercase tracking-widest text-right">Revenue Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {(data?.brokerPerformance?.length ? data.brokerPerformance : []).map((broker, i) => (
                    <tr key={i} className="hover:bg-bg/30 transition-all group cursor-pointer">
                      <td className="px-10 py-7">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm border border-primary/5 group-hover:bg-primary group-hover:text-white group-hover:scale-105 transition-all duration-300">
                            {broker.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-base font-black text-text group-hover:text-primary transition-colors">{broker.name}</p>
                            <p className="text-[10px] text-muted font-bold uppercase tracking-tight">Certified Partner</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-7">
                        <span className="text-sm font-black text-text bg-bg px-4 py-1.5 rounded-2xl border border-border/40 group-hover:border-primary/20 transition-colors">
                          {broker.bookings} closures
                        </span>
                      </td>
                      <td className="px-10 py-7 text-right">
                        <span className="text-base font-black text-primary">{formatCurrency(broker.revenue)}</span>
                      </td>
                    </tr>
                  ))}
                  {(!data?.brokerPerformance || data.brokerPerformance.length === 0) && (
                    <tr>
                      <td colSpan={3} className="px-10 py-12 text-center text-sm text-muted">
                        No broker sales recorded in this period. Complete bookings to see partner performance.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Velocity Indicator */}
        <Card className="lg:col-span-1 border-border/60 shadow-sm rounded-[40px] overflow-hidden bg-card">
          <div className="p-8 border-b border-border/40">
            <h3 className="font-black text-text text-lg tracking-tight">Sales Velocity</h3>
          </div>
          <CardContent className="p-8">
             <div className="h-[280px] w-full min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.monthlyStats || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} opacity={0.6} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: chartColors.tick, fontSize: 10, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: chartColors.tick, fontSize: 10, fontWeight: 700 }} allowDecimals={false} />
                  <Tooltip 
                    {...chartTooltipProps(chartColors)}
                    cursor={{ fill: chartColors.primary, opacity: 0.08 }}
                  />
                  <Bar dataKey="bookings" fill={chartColors.amber} radius={[8, 8, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-10 p-6 bg-primary/5 rounded-3xl border border-primary/10 relative overflow-hidden">
               <div className="flex items-start gap-4 relative z-10">
                 <div className="p-3 bg-primary/10 rounded-2xl">
                   <BarChart2 className="text-primary" size={20} />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Growth Index</p>
                   <p className="text-xs font-bold text-text/80 leading-relaxed">
                     Inventory turnover has increased by <span className="text-primary font-black">18.4%</span> this period. Optimizing listing prices could further boost performance.
                   </p>
                 </div>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color, trend }) {
  const styles = {
    primary: 'bg-primary/10 text-primary border-primary/5 shadow-primary/5',
    emerald: 'bg-emerald/10 text-emerald border-emerald/5 shadow-emerald/5',
    purple: 'bg-purple/10 text-purple border-purple/5 shadow-purple/5',
    amber: 'bg-amber/10 text-amber border-amber/5 shadow-amber/5',
  }

  return (
    <Card className="p-8 border-border/60 shadow-sm rounded-[32px] hover:shadow-xl hover:-translate-y-1 transition-all group overflow-hidden relative bg-card">
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className={cn("p-4 rounded-2xl transition-all group-hover:scale-110 shadow-lg border", styles[color])}>
          <Icon size={24} />
        </div>
        <div className={cn("text-[11px] font-black px-3.5 py-1.5 rounded-full flex items-center gap-1.5 border", 
          trend.includes('+') ? 'bg-emerald/10 text-emerald border-emerald/10' : 'bg-muted/10 text-muted border-border/40'
        )}>
          {trend.includes('+') && <ArrowUpRight size={12} strokeWidth={3} />} {trend}
        </div>
      </div>
      
      <div className="relative z-10">
        <p className="text-[11px] font-black text-muted uppercase tracking-[0.2em] mb-2">{label}</p>
        <p className="text-3xl font-black text-text tracking-tighter">{value}</p>
      </div>
      
      {/* Decorative BG element */}
      <div className={cn("absolute -bottom-8 -right-8 w-32 h-32 opacity-0 group-hover:opacity-[0.05] transition-all duration-700 pointer-events-none", styles[color])}>
         <Icon size={128} />
      </div>
    </Card>
  )
}
