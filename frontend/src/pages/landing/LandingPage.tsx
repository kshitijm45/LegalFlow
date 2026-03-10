import { Link } from 'react-router-dom'
import { ArrowRight, Scale, CheckCircle, Star } from 'lucide-react'

const features = [
  {
    icon: '🔍',
    title: 'The Vault',
    description: 'Semantic search across your entire contract library. Find any clause instantly with AI-powered natural language queries.',
    preview: (
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-border rounded-[7px] text-xs text-text-3">
          <span>🔍</span> <span>"limitation of liability cap &gt; ₹1Cr"</span>
        </div>
        <div className="px-3 py-2 bg-surface rounded-[7px] border border-border">
          <p className="text-xs font-medium text-text">Tata Digital MSA 2024 · §7.2</p>
          <p className="text-[11px] text-text-3 mt-0.5 font-mono truncate">…shall not exceed total fees paid in…</p>
        </div>
      </div>
    ),
  },
  {
    icon: '📊',
    title: 'Market Analysis',
    description: 'Benchmark every clause against 2,847 comparable deals. Know instantly if your terms are favorable, market, or unfavorable.',
    preview: (
      <div className="mt-4 space-y-2">
        {[
          { name: 'Liability Cap', pct: 22, color: '#DC2626', label: 'Below' },
          { name: 'Auto-Renewal', pct: 72, color: '#4338CA', label: 'Above' },
          { name: 'Confidentiality', pct: 55, color: '#059669', label: 'Market' },
        ].map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <span className="text-[11px] text-text-2 w-24 truncate">{item.name}</span>
            <div className="flex-1 bg-border rounded-full h-1.5 relative">
              <div className="h-1.5 rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
            </div>
            <span className="text-[10px] font-medium" style={{ color: item.color }}>{item.label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: '✅',
    title: 'Clause Audit',
    description: 'Run your contract against any playbook. Instantly identify missing, partial, and present clauses with AI-suggested language.',
    preview: (
      <div className="mt-4 space-y-2">
        {[
          { name: 'Limitation of Liability', status: 'present' },
          { name: 'Work Made for Hire', status: 'missing' },
          { name: 'Data Breach Notification', status: 'partial' },
        ].map((c) => (
          <div key={c.name} className="flex items-center gap-2 py-1">
            <span className="text-sm">
              {c.status === 'present' ? '✅' : c.status === 'missing' ? '❌' : '⚠️'}
            </span>
            <span className="text-[11px] text-text-2">{c.name}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: '🔔',
    title: 'Obligations',
    description: 'AI extracts every deadline, payment, and compliance obligation from your contracts. Never miss a critical date.',
    preview: (
      <div className="mt-4 space-y-2">
        {[
          { title: 'SOC-2 Report Due', date: 'Jan 15', color: '#DC2626' },
          { title: 'Q1 Payment — Razorpay', date: 'Mar 1', color: '#D97706' },
          { title: 'Contract Renewal Window', date: 'Apr 1', color: '#4338CA' },
        ].map((ob) => (
          <div key={ob.title} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ob.color }} />
            <span className="text-[11px] text-text-2 flex-1 truncate">{ob.title}</span>
            <span className="text-[10px] text-text-3">{ob.date}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: '📅',
    title: 'Timeline',
    description: 'Visualize every contract milestone on a single timeline. Click any event to see the source clause and context.',
    preview: (
      <div className="mt-4">
        <div className="relative">
          <div className="absolute top-2 left-0 right-0 h-0.5 bg-border" />
          <div className="flex justify-between relative">
            {['Jan', 'Feb', 'Mar', 'Apr', 'May'].map((m, i) => (
              <div key={m} className="flex flex-col items-center gap-1">
                <div
                  className="w-3 h-3 rounded-full border-2 border-white"
                  style={{
                    backgroundColor: ['#DC2626', '#D97706', '#4338CA', '#059669', '#7C3AED'][i],
                  }}
                />
                <span className="text-[10px] text-text-3">{m}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: '⚡',
    title: 'Workflow Builder',
    description: 'Build no-code AI workflows. Auto-review new contracts, route by risk level, and notify the right people — all automatically.',
    preview: (
      <div className="mt-4 flex items-center gap-1.5 overflow-hidden">
        {[
          { label: 'Upload', color: '#059669', bg: '#D1FAE5' },
          { label: 'AI Audit', color: '#4338CA', bg: '#EEF2FF' },
          { label: 'Route', color: '#D97706', bg: '#FEF3C7' },
          { label: 'Notify', color: '#7C3AED', bg: '#F5F3FF' },
        ].map((node, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className="px-2 py-1 rounded-[5px] text-[10px] font-semibold flex-shrink-0"
              style={{ backgroundColor: node.bg, color: node.color }}
            >
              {node.label}
            </div>
            {i < 3 && <div className="text-border text-xs">→</div>}
          </div>
        ))}
      </div>
    ),
  },
]

const testimonials = [
  {
    name: 'Priya Iyer',
    role: 'Partner',
    firm: 'Mehta & Iyer LLP',
    quote: 'LegalFlow cut our contract review time by 70%. The clause benchmarking alone saved us from three unfavourable deals last quarter.',
    initials: 'PI',
    color: '#4338CA',
  },
  {
    name: 'Vikram Kapoor',
    role: 'VP Legal',
    firm: 'Mahindra & Mahindra Ltd',
    quote: 'The obligation tracking feature is a game-changer. We never miss a compliance deadline now. Our legal ops team loves it.',
    initials: 'VK',
    color: '#059669',
  },
  {
    name: 'Ananya Krishnan',
    role: 'Senior Associate',
    firm: 'AZB & Partners',
    quote: 'Finally, an AI legal tool that actually understands how lawyers work. The Vault search is incredible — like Ctrl+F for your entire firm.',
    initials: 'AK',
    color: '#7C3AED',
  },
]

const securityBadges = [
  { icon: '🔒', label: 'SOC 2 Type II' },
  { icon: '🛡️', label: 'AES-256 Encrypted' },
  { icon: '🗑️', label: 'Zero Data Retention' },
  { icon: '👤', label: 'RBAC & MFA' },
  { icon: '📋', label: 'Full Audit Log' },
]

export function LandingPage() {
  return (
    <div className="bg-white overflow-auto h-full">
      {/* Nav */}
      <header className="border-b border-border bg-white/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo rounded-[7px] flex items-center justify-center">
              <Scale size={14} className="text-white" />
            </div>
            <span className="font-semibold text-text text-[15px] tracking-tight">LegalFlow</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-text-2">
            <a href="#features" className="hover:text-text transition-colors">Features</a>
            <a href="#security" className="hover:text-text transition-colors">Security</a>
            <a href="#pricing" className="hover:text-text transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-text-2 hover:text-text transition-colors">
              Sign in
            </Link>
            <Link
              to="/signup"
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo text-white text-sm font-semibold rounded-[8px] hover:bg-indigo-dk transition-colors"
            >
              Get early access <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative py-24 px-6 overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(67,56,202,0.07) 0%, transparent 70%)',
        }}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle, #4338CA 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-lt border border-indigo-mid rounded-pill text-xs font-semibold text-indigo mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo animate-pulse" />
            Now in early access 
          </div>

          <h1 className="font-serif text-[68px] leading-[1.05] text-text mb-6 tracking-tight">
            The AI platform legal teams
            <em className="text-indigo not-italic"> can trust</em>
          </h1>

          <p className="text-lg text-text-2 max-w-2xl mx-auto mb-10 leading-relaxed">
            Review contracts 10× faster. Benchmark every clause against the market. Track every obligation.
            All in one platform built for how lawyers actually work.
          </p>

          <div className="flex items-center justify-center gap-4 mb-6">
            <Link
              to="/signup"
              className="flex items-center gap-2 px-6 py-3 bg-indigo text-white font-semibold rounded-[9px] hover:bg-indigo-dk transition-colors text-sm"
            >
              Start free trial <ArrowRight size={15} />
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-2 px-6 py-3 border border-border text-text font-semibold rounded-[9px] hover:bg-surface transition-colors text-sm"
            >
              Sign in
            </Link>
          </div>

          <div className="flex items-center justify-center gap-5 text-xs text-text-3">
            {['SOC 2 certified', 'AES-256 encrypted', 'Zero data retention available'].map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <CheckCircle size={12} className="text-success" />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* App mockup */}
        <div className="relative max-w-5xl mx-auto mt-16">
          <div className="bg-white border border-border rounded-[12px] shadow-[0_8px_48px_rgba(0,0,0,0.08)] overflow-hidden">
            {/* Mockup topbar */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-surface">
              <div className="w-3 h-3 rounded-full bg-danger/50" />
              <div className="w-3 h-3 rounded-full bg-warning/50" />
              <div className="w-3 h-3 rounded-full bg-success/50" />
              <span className="text-xs text-text-3 ml-3 font-mono">LegalFlow — Dashboard</span>
            </div>

            {/* Mockup content */}
            <div className="flex h-[320px]">
              {/* Mini sidebar */}
              <div className="w-[160px] bg-white border-r border-border p-3 space-y-1 flex-shrink-0">
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-[6px] bg-indigo-lt">
                  <div className="w-3 h-3 bg-indigo/30 rounded" />
                  <span className="text-[10px] font-semibold text-indigo">Dashboard</span>
                </div>
                {['The Vault', 'Market Analysis', 'Clause Audit', 'Obligations'].map((item) => (
                  <div key={item} className="flex items-center gap-1.5 px-2 py-1.5 rounded-[6px]">
                    <div className="w-3 h-3 bg-border rounded" />
                    <span className="text-[10px] text-text-3">{item}</span>
                  </div>
                ))}
              </div>

              {/* Main content */}
              <div className="flex-1 p-5 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold text-text">Good morning, Arjun 👋</p>
                    <p className="text-[10px] text-text-3">3 obligations need attention</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="px-2.5 py-1 bg-indigo text-white text-[10px] rounded-[6px] font-medium">Upload Contract</div>
                    <div className="px-2.5 py-1 bg-surface border border-border text-[10px] text-text-2 rounded-[6px]">Run Audit</div>
                  </div>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Total Contracts', value: '11', color: 'text-text' },
                    { label: 'Overdue', value: '3', color: 'text-danger' },
                    { label: 'Avg Coverage', value: '76%', color: 'text-indigo' },
                    { label: 'Added This Month', value: '4', color: 'text-success' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-surface border border-border rounded-[8px] p-3">
                      <p className="text-[10px] text-text-3 mb-1">{stat.label}</p>
                      <p className={`text-xl font-semibold ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* AI insight */}
                <div className="p-3 bg-indigo-lt border border-indigo-mid rounded-[8px] mb-3">
                  <p className="text-[10px] font-semibold text-indigo mb-0.5">⚡ AI Insight</p>
                  <p className="text-[10px] text-indigo/80">2 contracts have missing IP clauses. Review recommended before next renewal.</p>
                </div>

                {/* Recent contracts */}
                <div className="space-y-1.5">
                  {[
                    { name: 'Tata Digital — MSA 2024', type: 'MSA', coverage: 78, status: 'Review' },
                    { name: 'Razorpay SaaS Agreement', type: 'SaaS', coverage: 65, status: 'Attention' },
                    { name: 'Zepto Technologies NDA', type: 'NDA', coverage: 92, status: 'OK' },
                  ].map((doc) => (
                    <div key={doc.name} className="flex items-center gap-3 px-3 py-2 bg-white border border-border rounded-[7px]">
                      <div className="w-5 h-5 bg-indigo-lt rounded flex items-center justify-center text-[9px] font-bold text-indigo flex-shrink-0">
                        {doc.type[0]}
                      </div>
                      <span className="text-[10px] font-medium text-text flex-1 truncate">{doc.name}</span>
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1 bg-border rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-indigo" style={{ width: `${doc.coverage}%` }} />
                        </div>
                        <span className="text-[9px] text-text-3">{doc.coverage}%</span>
                      </div>
                      <span
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded-pill"
                        style={{
                          backgroundColor: doc.status === 'OK' ? '#D1FAE5' : doc.status === 'Attention' ? '#FEE2E2' : '#FEF3C7',
                          color: doc.status === 'OK' ? '#059669' : doc.status === 'Attention' ? '#DC2626' : '#D97706',
                        }}
                      >
                        {doc.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-indigo-dk py-14 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-4 gap-8 text-center">
          {[
            { num: '48k+', label: 'Contracts reviewed' },
            { num: '4.2hrs', label: 'Saved per contract review' },
            { num: '98%', label: 'Clause detection accuracy' },
            { num: '2,847', label: 'Market benchmarks' },
          ].map((stat) => (
            <div key={stat.num}>
              <p className="font-serif text-4xl text-white mb-1">
                {stat.num}
              </p>
              <p className="text-sm text-indigo-mid">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trusted by */}
      <section className="py-12 px-6 border-b border-border hidden">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs text-text-3 uppercase tracking-widest font-medium mb-6">Trusted by leading firms</p>
          <div className="flex items-center justify-center flex-wrap gap-8 text-text-3 text-sm font-medium">
            {['Mehta & Iyer LLP', 'AZB & Partners', 'Cyril Amarchand Mangaldas', 'Trilegal', 'Shardul Amarchand Mangaldas'].map((firm) => (
              <span key={firm} className="opacity-60 hover:opacity-100 transition-opacity">{firm}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-serif text-4xl text-text mb-4">Six pillars, one platform</h2>
            <p className="text-text-2 text-lg max-w-xl mx-auto">
              Everything your team needs to review, benchmark, and track contracts — built by lawyers, for lawyers.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-5">
            {features.map((feature) => (
              <div key={feature.title} className="p-6 border border-border rounded-[10px] hover:border-indigo-mid hover:shadow-[0_4px_24px_rgba(67,56,202,0.08)] transition-all">
                <div className="text-2xl mb-3">{feature.icon}</div>
                <h3 className="font-semibold text-text mb-2">{feature.title}</h3>
                <p className="text-sm text-text-2 leading-relaxed">{feature.description}</p>
                {feature.preview}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 bg-surface border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-4xl text-text mb-3">Loved by legal professionals</h2>
            <p className="text-text-2">Real results from real lawyers</p>
          </div>
          <div className="grid grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name} className="p-6 bg-white border border-border rounded-[10px]">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className="fill-warning text-warning" />
                  ))}
                </div>
                <p className="text-sm text-text-2 leading-relaxed italic mb-4">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">{t.name}</p>
                    <p className="text-xs text-text-3">{t.role} · {t.firm}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-lg font-semibold text-text mb-1">Enterprise-grade security</h2>
            <p className="text-sm text-text-2">Built for the confidentiality standards legal requires</p>
          </div>
          <div className="flex items-center justify-center flex-wrap gap-4">
            {securityBadges.map((badge) => (
              <div key={badge.label} className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border rounded-pill">
                <CheckCircle size={14} className="text-success" />
                <span className="text-sm font-medium text-text">{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-24 px-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #312E81 0%, #1e1b4b 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle, #a5b4fc 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-5xl text-white mb-4 leading-tight">
            Ready to see it<br />
            <em>in action?</em>
          </h2>
          <p className="text-indigo-mid mb-10 text-lg">
            Join 120+ firms already using LegalFlow to review contracts 10× faster.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              to="/signup"
              className="flex items-center gap-2 px-7 py-3.5 bg-white text-indigo font-semibold rounded-[9px] hover:bg-indigo-lt transition-colors"
            >
              Start free trial <ArrowRight size={15} />
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-2 px-7 py-3.5 border border-indigo-mid/50 text-white font-semibold rounded-[9px] hover:bg-white/10 transition-colors"
            >
              Sign in
            </Link>
          </div>
          <p className="text-xs text-indigo-mid/70 mt-6">No credit card required · 14-day free trial</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border bg-white">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo rounded-[6px] flex items-center justify-center">
              <Scale size={12} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-text">LegalFlow</span>
          </div>
          <p className="text-xs text-text-3">© 2024 LegalFlow · Privacy · Terms</p>
        </div>
      </footer>
    </div>
  )
}
