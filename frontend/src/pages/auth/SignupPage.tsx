import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Scale, Mail, Lock, User, ArrowRight, Shield } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const passwordStrength = (pwd: string): number => {
  let score = 0
  if (pwd.length >= 8) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  return score
}

const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong']
const strengthColor = ['', '#DC2626', '#D97706', '#059669', '#059669']

export function SignupPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const strength = passwordStrength(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
        style={{ background: 'linear-gradient(160deg, #312E81 0%, #1e1b4b 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: 'radial-gradient(circle, #a5b4fc 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-80 h-80 opacity-20 rounded-full"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/20 rounded-[8px] flex items-center justify-center">
            <Scale size={16} className="text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">LegalFlow</span>
        </div>

        {/* Middle content */}
        <div className="relative space-y-8">
          <div>
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-indigo-mid mb-3">
              Early Access Program
            </span>
            <h1 className="font-serif text-[34px] leading-tight text-white">
              Join the legal teams working smarter with AI
            </h1>
          </div>

          <div className="space-y-4">
            {[
              { num: '48k+', label: 'Contracts reviewed' },
              { num: '4.2hrs', label: 'Saved per contract' },
              { num: '98%', label: 'Accuracy rate' },
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-4">
                <span className="font-serif text-3xl text-white leading-none">{s.num}</span>
                <span className="text-sm text-indigo-mid">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Firm logos placeholder */}
          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-widest">Trusted by</p>
            <div className="flex flex-wrap gap-3">
              {['Mehta & Iyer LLP', 'AZB & Partners', 'Cyril Amarchand Mangaldas', 'Trilegal'].map((f) => (
                <span key={f} className="text-xs text-white/50 bg-white/10 px-2.5 py-1 rounded-pill">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="relative" />
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-12 bg-white overflow-y-auto">
        <div className="w-full max-w-[400px] space-y-7">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-semibold text-text mb-1">Create your account</h2>
            <p className="text-sm text-text-2">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2">
            {[
              { n: 1, label: 'Your details', active: true },
              { n: 2, label: 'Your firm', active: false },
              { n: 3, label: 'Access granted', active: false },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${step.active ? 'bg-indigo text-white' : 'bg-border text-text-3'}`}>
                  {step.active ? step.n : step.n}
                </div>
                <span className={`text-xs ${step.active ? 'text-text font-medium' : 'text-text-3'}`}>
                  {step.label}
                </span>
                {i < 2 && <div className="w-8 h-px bg-border mx-1" />}
              </div>
            ))}
          </div>

          {/* SSO */}
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
            <span className="text-xs text-text-3">or create with email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">First name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Arjun"
                    className="w-full pl-8 pr-3 py-2.5 text-sm border border-border rounded-[8px] bg-white text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">Last name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Mehta"
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-[8px] bg-white text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Work email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="arjun@mehtaiyer.com"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-[8px] bg-white text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors"
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Your role</label>
              <select className="w-full px-3 py-2.5 text-sm border border-border rounded-[8px] bg-white text-text focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors appearance-none">
                <option>Senior Associate</option>
                <option>Associate</option>
                <option>Partner</option>
                <option>Paralegal</option>
                <option>In-house Counsel</option>
              </select>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full pl-9 pr-10 py-2.5 text-sm border border-border rounded-[8px] bg-white text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {password && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="flex-1 h-1 rounded-full transition-colors"
                        style={{ backgroundColor: i <= strength ? strengthColor[strength] : '#E2E8F0' }}
                      />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: strengthColor[strength] }}>
                    {strengthLabel[strength]} password
                  </p>
                </div>
              )}
            </div>

            {/* Terms */}
            <div className="p-3 bg-surface rounded-[8px]">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" required className="w-4 h-4 mt-0.5 rounded border-border accent-indigo flex-shrink-0" />
                <span className="text-xs text-text-2 leading-relaxed">
                  I agree to the{' '}
                  <span className="text-indigo hover:underline cursor-pointer">Terms of Service</span>
                  {' '}and{' '}
                  <span className="text-indigo hover:underline cursor-pointer">Privacy Policy</span>.
                  Your data is encrypted and never sold.
                </span>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo text-white text-sm font-semibold rounded-[8px] hover:bg-indigo-dk transition-colors disabled:opacity-60"
            >
              {loading ? 'Creating account…' : 'Continue to firm details'}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>

          {/* Security note */}
          <div className="flex items-center gap-2">
            <Shield size={12} className="text-text-3 flex-shrink-0" />
            <p className="text-xs text-text-3">SOC 2 Type II certified · AES-256 · DPDP Act compliant</p>
          </div>
        </div>
      </div>
    </div>
  )
}

