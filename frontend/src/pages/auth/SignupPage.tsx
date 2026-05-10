import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Scale, Mail, Lock, User, ArrowRight, Shield, CheckCircle } from 'lucide-react'
import { useSignUp } from '@clerk/react'
import { useUser } from '@clerk/react'

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

const STEPS = [
  { n: 1, label: 'Your details' },
  { n: 2, label: 'Verify email' },
  { n: 3, label: 'Access granted' },
]

export function SignupPage() {
  const { signUp, errors, fetchStatus } = useSignUp()
  const { isLoaded, isSignedIn } = useUser()
  const navigate = useNavigate()

  // Step 1 fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Senior Associate')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Step 2 fields
  const [code, setCode] = useState('')

  const [step, setStep] = useState(1)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pendingFinalize, setPendingFinalize] = useState(false)

  // Call finalize() after re-render so signUp signal is fresh (has createdSessionId)
  useEffect(() => {
    if (!pendingFinalize) return
    setPendingFinalize(false)
    signUp.finalize().then(({ error }) => {
      if (error) setErrorMsg(error.longMessage ?? error.message ?? 'Account creation failed.')
      else navigate('/app/dashboard')
    })
  }, [pendingFinalize, signUp, navigate])

  if (isLoaded && isSignedIn) return <Navigate to="/app/dashboard" replace />

  const loading = fetchStatus === 'fetching'
  const strength = passwordStrength(password)

  // Derive display error from Clerk errors or local override
  const clerkFieldError =
    errors.fields.emailAddress ?? errors.fields.password ?? errors.fields.code ?? null
  const clerkGlobalError = errors.global?.[0] ?? null
  const displayError = errorMsg
    ?? (clerkFieldError ? (clerkFieldError.longMessage ?? clerkFieldError.message) : null)
    ?? (clerkGlobalError ? (clerkGlobalError.longMessage ?? clerkGlobalError.message) : null)

  const handleDetailsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isLoaded) return
    setErrorMsg(null)

    const { error } = await signUp.password({
      emailAddress: email,
      password,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      unsafeMetadata: { role },
    })

    if (error) {
      setErrorMsg(error.longMessage ?? error.message ?? 'Sign up failed. Please try again.')
      return
    }

    // Send email verification code
    const { error: sendError } = await signUp.verifications.sendEmailCode()
    if (sendError) {
      setErrorMsg(sendError.longMessage ?? sendError.message ?? 'Failed to send verification email.')
      return
    }

    setStep(2)
  }

  const handleVerifySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isLoaded) return
    setErrorMsg(null)

    const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code })
    if (verifyError) {
      setErrorMsg(verifyError.longMessage ?? verifyError.message ?? 'Invalid code. Please try again.')
      return
    }

    // Trigger finalize via useEffect so it runs with a fresh signUp signal
    setPendingFinalize(true)
  }

  const handleSSO = async (strategy: 'oauth_microsoft' | 'oauth_google') => {
    if (!isLoaded || !signUp) return
    const { error } = await signUp.sso({
      strategy,
      redirectUrl: `${window.location.origin}/sso-callback`,
      redirectCallbackUrl: '/app/dashboard',
    })
    if (error) setErrorMsg(error.longMessage ?? error.message ?? 'Sign-up failed.')
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
        <Link className="relative flex items-center gap-2.5" to="/">
          <div className="w-8 h-8 bg-white/20 rounded-[8px] flex items-center justify-center">
            <Scale size={16} className="text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">Carta</span>
        </Link>

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
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                  s.n < step ? 'bg-success text-white' : s.n === step ? 'bg-indigo text-white' : 'bg-border text-text-3'
                }`}>
                  {s.n < step ? <CheckCircle size={14} /> : s.n}
                </div>
                <span className={`text-xs ${s.n === step ? 'text-text font-medium' : 'text-text-3'}`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <div className="w-8 h-px bg-border mx-1" />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <>
              {/* SSO */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSSO('oauth_google')}
                  disabled={loading || !isLoaded}
                  className="flex items-center justify-center gap-2.5 px-4 py-2.5 border border-border rounded-[8px] text-sm font-medium text-text hover:bg-surface transition-colors disabled:opacity-60"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => handleSSO('oauth_microsoft')}
                  disabled={loading || !isLoaded}
                  className="flex items-center justify-center gap-2.5 px-4 py-2.5 border border-border rounded-[8px] text-sm font-medium text-text hover:bg-surface transition-colors disabled:opacity-60"
                >
                  <svg width="16" height="16" viewBox="0 0 21 21" fill="none">
                    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                  </svg>
                  Microsoft
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-text-3">or create with email</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={handleDetailsSubmit} className="space-y-4">
                {displayError && (
                  <div className="p-3 bg-danger-lt border border-danger/20 rounded-[8px] text-sm text-danger">
                    {displayError}
                  </div>
                )}

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

                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Work email</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="arjun@mehtaiyer.com"
                      required
                      className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-[8px] bg-white text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Your role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-[8px] bg-white text-text focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors appearance-none"
                  >
                    <option>Senior Associate</option>
                    <option>Associate</option>
                    <option>Partner</option>
                    <option>Paralegal</option>
                    <option>In-house Counsel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      required
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

                {/* Required anchor for Clerk's CAPTCHA bot-protection widget */}
                <div id="clerk-captcha" />

                <button
                  type="submit"
                  disabled={loading || !isLoaded}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo text-white text-sm font-semibold rounded-[8px] hover:bg-indigo-dk transition-colors disabled:opacity-60"
                >
                  {loading ? 'Creating account…' : 'Continue'}
                  {!loading && <ArrowRight size={15} />}
                </button>
              </form>
            </>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifySubmit} className="space-y-5">
              <div className="p-4 bg-indigo-lt rounded-[8px]">
                <p className="text-sm text-text">
                  We've sent a 6-digit code to <span className="font-medium">{email}</span>.
                  Enter it below to verify your account.
                </p>
              </div>

              {displayError && (
                <div className="p-3 bg-danger-lt border border-danger/20 rounded-[8px] text-sm text-danger">
                  {displayError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text mb-1.5">Verification code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  className="w-full px-4 py-3 text-center text-2xl tracking-[0.4em] font-mono border border-border rounded-[8px] bg-white text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-indigo/30 focus:border-indigo transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo text-white text-sm font-semibold rounded-[8px] hover:bg-indigo-dk transition-colors disabled:opacity-60"
              >
                {loading ? 'Verifying…' : 'Verify & create account'}
                {!loading && <ArrowRight size={15} />}
              </button>

              <button
                type="button"
                onClick={() => signUp.verifications.sendEmailCode()}
                className="w-full text-sm text-indigo hover:underline"
              >
                Resend code
              </button>
            </form>
          )}

          <div className="flex items-center gap-2">
            <Shield size={12} className="text-text-3 flex-shrink-0" />
            <p className="text-xs text-text-3">SOC 2 Type II certified · AES-256 · DPDP Act compliant</p>
          </div>
        </div>
      </div>
    </div>
  )
}
