import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Scale, Mail, Lock, ArrowRight, Shield } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError(true)
      return
    }
    setError(false)
    setLoading(true)
    await login(email, password)
    setLoading(false)
    navigate('/app/dashboard')
  }

  return (
    <div className="h-full flex">
      {/* Left panel */}
      <div
        className="w-[480px] flex-shrink-0 relative flex flex-col justify-between p-12 overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #312E81 0%, #1e1b4b 100%)',
        }}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: 'radial-gradient(circle, #a5b4fc 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Glow */}
        <div
          className="absolute top-0 right-0 w-80 h-80 opacity-20 rounded-full"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/20 backdrop-blur rounded-[8px] flex items-center justify-center">
            <Scale size={16} className="text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">LegalFlow</span>
        </div>

        {/* Middle content */}
        <div className="relative space-y-8">
          <div>
            <h1 className="font-serif text-[36px] leading-tight text-white mb-3">
              Legal intelligence,<br />
              <em>finally built right.</em>
            </h1>
            <p className="text-indigo-mid text-sm leading-relaxed">
              Trusted by 120+ law firms to review contracts, benchmark clauses, and track obligations.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: '🔍', text: 'Semantic contract search across your entire library' },
              { icon: '📊', text: 'Benchmark clauses against 2,847 market deals' },
              { icon: '🔔', text: 'Never miss a deadline with smart obligation tracking' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-base">{item.icon}</span>
                <p className="text-[13px] text-indigo-mid leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="border-l-2 border-indigo-mid/40 pl-4">
            <p className="text-[13px] text-indigo-mid italic leading-relaxed mb-2">
              "LegalFlow cut our contract review time by 70%. The clause benchmarking alone saved us from three unfavorable deals last quarter."
            </p>
            <p className="text-xs text-white/60">Priya Iyer · Partner, Mehta & Iyer LLP</p>
          </div>
        </div>

        <div className="relative" />
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-12 bg-white overflow-y-auto">
        <div className="w-full max-w-[380px] space-y-8">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-semibold text-text mb-1">Welcome back</h2>
            <p className="text-sm text-text-2">
              Don't have an account?{' '}
              <Link to="/signup" className="text-indigo font-medium hover:underline">
                Get early access
              </Link>
            </p>
          </div>

          {/* SSO button */}
          <button className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-border rounded-[8px] text-sm font-medium text-text hover:bg-surface transition-colors">
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            Continue with Microsoft
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-3">or sign in with email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error banner */}
            {error && (
              <div className="p-3 bg-danger-lt border border-danger/20 rounded-[8px] text-sm text-danger">
                Please enter your email and password.
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Work email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="arjun@mehtaiyer.com"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-[8px] bg-white text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-text">Password</label>
                <button type="button" className="text-xs text-indigo hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 text-sm border border-border rounded-[8px] bg-white text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-border accent-indigo" />
              <span className="text-sm text-text-2">Remember me for 30 days</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo text-white text-sm font-semibold rounded-[8px] hover:bg-indigo-dk transition-colors disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>

          {/* Security note */}
          <div className="flex items-center gap-2 p-3 bg-surface rounded-[8px]">
            <Shield size={14} className="text-text-3 flex-shrink-0" />
            <p className="text-xs text-text-3">
              SOC 2 certified · AES-256 encryption · Zero data retention available
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
