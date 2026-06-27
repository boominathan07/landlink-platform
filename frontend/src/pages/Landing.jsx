import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Map, Shield, Users, Check, ArrowRight, Upload, UserPlus, BarChart3, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import AnimatedBackground from '@/components/common/AnimatedBackground'
import { publicApi } from '@/services/api'
import { fadeUpVariant, staggerContainer, cardVariant } from '@/utils/animations'

const features = [
  {
    icon: Map,
    title: 'Interactive Plot Maps',
    desc: 'Upload your layout image and auto-generate an interactive plot grid. Assign, track, and update plot status in real time.',
  },
  {
    icon: Users,
    title: 'Broker Management',
    desc: 'Invite brokers by email, assign projects, track commissions, and manage their access — all from one dashboard.',
  },
  {
    icon: Shield,
    title: 'Secure Document Vault',
    desc: 'Upload project approvals, legal docs, and plans. Brokers get instant access to only what they need.',
  },
]

const steps = [
  { num: '01', title: 'Create Your Project', desc: 'Owner adds project details and location.' },
  { num: '02', title: 'Upload Plot Layout', desc: 'Image auto-detected into an interactive map.' },
  { num: '03', title: 'Invite Your Brokers', desc: 'Email invite with role-based access.' },
  { num: '04', title: 'Track & Close', desc: 'Real-time analytics, commissions, and documents.' },
]

const plans = [
  { name: 'Essential', price: '₹0', features: ['3 projects', '3 brokers per project', '1GB storage', 'Plot map'] },
  { name: 'Prestige', price: '₹799/mo', features: ['Unlimited projects', 'Unlimited brokers', 'Commission tracking', '10GB vault', 'Analytics'], highlight: true },
  { name: 'Signature', price: '₹2,499/mo', features: ['Everything in Prestige', 'Team accounts', '50GB storage', 'Priority support'] },
]

function PlotGridMockup() {
  const cells = [
    { n: '1', s: 'available' }, { n: '2', s: 'available' }, { n: '3', s: 'sold' }, { n: '4', s: 'hold' },
    { n: '5', s: 'available' }, { n: '6', s: 'sold' }, { n: '7', s: 'available' }, { n: '8', s: 'available' },
    { n: '9', s: 'hold' }, { n: '10', s: 'available' }, { n: '11', s: 'available' }, { n: '12', s: 'sold' },
  ]
  const colors = {
    available: { bg: 'rgba(16,185,129,0.25)', border: '#10B981' },
    sold: { bg: 'rgba(239,68,68,0.25)', border: '#EF4444' },
    hold: { bg: 'rgba(245,158,11,0.25)', border: '#F59E0B' },
  }
  return (
    <div className="glass-card p-4 w-full max-w-lg mx-auto" style={{ boxShadow: '0 0 60px rgba(79,142,247,0.2)' }}>
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs text-[#8892A4] uppercase tracking-wider">Plot Map Preview</span>
        <span className="text-xs text-[#4F8EF7]">Live status</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {cells.map((c) => (
          <div
            key={c.n}
            className="aspect-square rounded flex items-center justify-center text-xs font-semibold"
            style={{
              background: colors[c.s].bg,
              border: `1.5px solid ${colors[c.s].border}`,
              color: colors[c.s].border,
            }}
          >
            {c.n}
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 px-1">
        {[['Available', '#10B981'], ['Sold', '#EF4444'], ['Hold', '#F59E0B']].map(([l, c]) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c, opacity: 0.7 }} />
            <span className="text-[10px] text-[#8892A4]">{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RevealSection({ children, className }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.15 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} className={cn('reveal-section', visible && 'visible', className)}>
      {children}
    </div>
  )
}

export default function Landing() {
  const [navSolid, setNavSolid] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#how-it-works', label: 'How it works' },
    { href: '#pricing', label: 'Pricing' },
  ]

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    publicApi.stats()
      .then(({ data }) => setStats(data.stats))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false))
  }, [])

  const hasStats = stats && (stats.projects > 0 || stats.plots > 0 || stats.brokers > 0 || stats.documents > 0)

  return (
    <div className="landing-page min-h-screen w-full overflow-x-hidden relative">
      <AnimatedBackground />

      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
          navSolid ? 'nav-scrolled' : 'nav-top'
        )}
      >
        <div className="content-container flex items-center justify-between gap-4 py-4 md:py-5">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white font-bold text-lg">L</div>
            <span className="font-bold text-xl text-text" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>LandLink</span>
          </Link>

          <div className="hidden lg:flex items-center gap-8 flex-1 justify-center">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-sm font-medium text-muted hover:text-text transition-colors">
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3 shrink-0">
            <Link to="/login" className="text-sm font-medium text-muted hover:text-text transition-colors px-3 py-2">Log in</Link>
            <Link to="/login">
              <button type="button" className="btn-primary text-sm py-2.5 px-5">Get Started</button>
            </Link>
          </div>

          <button
            type="button"
            className="md:hidden p-2 text-muted hover:text-text"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-border/40 bg-card/95 backdrop-blur-md">
            <div className="content-container py-4 flex flex-col gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="py-2.5 text-sm font-medium text-muted hover:text-text"
                  onClick={() => setMobileNavOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-3 border-t border-border/40">
                <Link to="/login" className="py-2.5 text-sm font-medium text-muted" onClick={() => setMobileNavOpen(false)}>Log in</Link>
                <Link to="/login" onClick={() => setMobileNavOpen(false)}>
                  <button type="button" className="btn-primary w-full text-sm py-2.5">Get Started</button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </motion.nav>

      {/* Hero */}
      <section className="hero-section flex items-center pt-24 pb-16">
        <div className="content-container w-full">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <motion.div variants={staggerContainer} initial="hidden" animate="visible">
              <motion.span variants={fadeUpVariant} className="inline-block px-4 py-1.5 rounded-full border border-[rgba(79,142,247,0.3)] text-[#4F8EF7] text-xs font-medium label-caption mb-6">
                Plot Management SaaS
              </motion.span>
              <motion.h1 variants={fadeUpVariant} className="text-[#E8EAF0] max-w-xl">
                Manage Every Plot. Empower Every Broker.
              </motion.h1>
              <motion.p variants={fadeUpVariant} className="mt-6 text-lg text-[#8892A4] max-w-xl leading-relaxed">
                LandLink gives real estate developers a single command center to map layouts, assign brokers, track documents, and close sales — all in real time.
              </motion.p>
              <motion.div variants={fadeUpVariant} className="mt-10 flex flex-wrap gap-4">
                <Link to="/login">
                  <button type="button" className="btn-primary flex items-center gap-2">
                    Start Free Trial <ArrowRight size={16} />
                  </button>
                </Link>
                <a href="#how-it-works">
                  <Button variant="outline" size="lg" className="btn-ghost">Watch Demo</Button>
                </a>
              </motion.div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="w-full max-w-md mx-auto lg:max-w-none scale-90 sm:scale-100"
            >
              <PlotGridMockup />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="section-wrapper border-y border-[rgba(79,142,247,0.1)]">
        <div className="section-inner">
          {statsLoading ? (
            <p className="text-center text-[#8892A4] text-sm">Loading platform stats…</p>
          ) : hasStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 text-center">
              {[
                { label: 'Projects Managed', value: stats.projects },
                { label: 'Plots Tracked', value: stats.plots },
                { label: 'Active Brokers', value: stats.brokers },
                { label: 'Documents Secured', value: stats.documents },
              ].map(({ label, value }) => (
                <RevealSection key={label}>
                  <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#4F8EF7]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    {value.toLocaleString('en-IN')}
                  </p>
                  <p className="mt-2 text-sm text-[#8892A4] label-caption">{label}</p>
                </RevealSection>
              ))}
            </div>
          ) : (
            <RevealSection className="text-center">
              <p className="text-xl text-[#E8EAF0] font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Be the first to build with LandLink
              </p>
              <p className="text-[#8892A4] mt-2">Create your first project and start mapping plots today.</p>
              <Link to="/login" className="inline-block mt-6">
                <button type="button" className="btn-primary">Get Started Free</button>
              </Link>
            </RevealSection>
          )}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="section-wrapper">
        <div className="section-inner">
          <RevealSection className="text-center mb-16">
            <h2 className="text-[#E8EAF0]">Built for developers and brokers</h2>
            <p className="text-[#8892A4] mt-4 max-w-xl mx-auto">Everything you need to manage plotted developments — not a property listing site.</p>
          </RevealSection>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 min-w-0"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {features.map(({ icon: Icon, title, desc }) => (
              <motion.div key={title} variants={cardVariant} className="glass-card p-8 card-hover">
                <div className="w-12 h-12 rounded-xl bg-[rgba(79,142,247,0.1)] flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-[#4F8EF7]" />
                </div>
                <h3 className="text-[#E8EAF0] text-xl font-semibold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{title}</h3>
                <p className="text-sm text-[#8892A4] leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="section-wrapper border-t border-[rgba(79,142,247,0.1)]">
        <div className="section-inner">
          <RevealSection className="text-center mb-16">
            <h2 className="text-[#E8EAF0]">How it works</h2>
            <p className="text-[#8892A4] mt-4">From layout upload to closed sale in four steps</p>
          </RevealSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 min-w-0">
            {steps.map(({ num, title, desc }, i) => (
              <RevealSection key={num}>
                <div className="glass-card p-6 h-full card-hover">
                  <span className="text-[#4F8EF7] text-sm font-bold label-caption">{num}</span>
                  <h3 className="text-[#E8EAF0] font-semibold mt-3 mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{title}</h3>
                  <p className="text-sm text-[#8892A4]">{desc}</p>
                  {i === 1 && <Upload size={20} className="mt-4 text-[#4F8EF7] opacity-50" />}
                  {i === 2 && <UserPlus size={20} className="mt-4 text-[#4F8EF7] opacity-50" />}
                  {i === 3 && <BarChart3 size={20} className="mt-4 text-[#4F8EF7] opacity-50" />}
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="section-wrapper border-t border-[rgba(79,142,247,0.1)]">
        <div className="section-inner">
          <RevealSection className="text-center mb-16">
            <h2 className="text-[#E8EAF0]">Membership tiers</h2>
            <p className="text-[#8892A4] mt-4">Choose the plan that fits your portfolio</p>
          </RevealSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 min-w-0">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={cn('glass-card p-8 flex flex-col card-hover', plan.highlight && 'border-[rgba(79,142,247,0.4)]')}
              >
                <h3 className="text-xl font-bold text-[#E8EAF0]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{plan.name}</h3>
                <p className="text-3xl text-[#4F8EF7] my-5 font-bold">{plan.price}</p>
                <ul className="space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[#8892A4]">
                      <Check size={14} className="text-[#10B981] shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/login" className="mt-8">
                  <Button className={cn('w-full', plan.highlight ? 'btn-primary' : 'btn-ghost')} variant={plan.highlight ? 'default' : 'outline'}>
                    Get Started
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[rgba(79,142,247,0.1)] py-12">
        <div className="content-container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white font-bold text-sm">L</div>
            <span className="text-[#E8EAF0] font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>LandLink</span>
          </div>
          <p className="text-sm text-[#8892A4]">© {new Date().getFullYear()} LandLink. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
