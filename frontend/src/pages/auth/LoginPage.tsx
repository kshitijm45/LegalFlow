import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Scale, Mail, Lock, ArrowRight, Shield } from 'lucide-react'
import { useSignIn } from '@clerk/react'
import { useUser } from '@clerk/react'

function fieldErrorMessage(code: string, message: string, longMessage?: string): string {
  if (code === 'form_identifier_not_found') return 'No account found with this email.'
  if (code === 'form_password_incorrect') return 'Incorrect password.'
  if (code === 'too_many_attempts') return 'Too many attempts. Please try again later.'
  return longMessage ?? message ?? 'Sign in failed. Please try again.'
}

export function LoginPage() {
  const { signIn, errors, fetchStatus } = useSignIn()
  const { isLoaded, isSignedIn } = useUser()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (isLoaded && isSignedIn) return <Navigate to="/app/dashboard" replace />

  const loading = fetchStatus === 'fetching'

  // Derive error messages from Clerk's errors object after each attempt
  const identifierError = errors.fields.identifier
  const passwordError = errors.fields.password
  const globalError = errors.global?.[0]

  const displayError = errorMsg
    ?? (identifierError ? fieldErrorMessage(identifierError.code, identifierError.message, identifierError.longMessage) : null)
    ?? (passwordError ? fieldErrorMessage(passwordError.code, passwordError.message, passwordError.longMessage) : null)
    ?? (globalError ? (globalError.longMessage ?? globalError.message) : null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isLoaded) return

    setErrorMsg(null)

    const { error: createError } = await signIn.create({ identifier: email })
    if (createError) {
      setErrorMsg(fieldErrorMessage(createError.code, createError.message, createError.longMessage))
      return
    }

    const { error: passwordError } = await signIn.password({ password })
    if (passwordError) {
      setErrorMsg(fieldErrorMessage(passwordError.code, passwordError.message, passwordError.longMessage))
      return
    }

    const { error: finalizeError } = await signIn.finalize()
    if (finalizeError) {
      setErrorMsg(finalizeError.longMessage ?? finalizeError.message ?? 'Sign in failed. Please try again.')
      return
    }

    navigate('/app/dashboard')
  }

  const handleSSO = async (strategy: 'oauth_microsoft' | 'oauth_google') => {
    if (!isLoaded) return
    const { error } = await signIn.sso({
      strategy,
      redirectUrl: `${window.location.origin}/sso-callback`,
      redirectCallbackUrl: '/app/dashboard',
    })
    if (error) setErrorMsg(error.longMessage ?? error.message ?? 'Sign-in failed.')
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
          className="absolute top-0 right-0 w-80 h-80 opacity-20 rounded-full"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }}
        />

        {/* Logo */}
        <Link className="relative flex items-center gap-2.5" to="/">
          <div className="w-8 h-8 bg-white/20 backdrop-blur rounded-[8px] flex items-center justify-center">
            <Scale size={16} className="text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">Carta</span>
        </Link>

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

          <div className="border-l-2 border-indigo-mid/40 pl-4">
            <p className="text-[13px] text-indigo-mid italic leading-relaxed mb-2">
              "Carta cut our contract review time by 70%. The clause benchmarking alone saved us from three unfavorable deals last quarter."
            </p>
            <p className="text-xs text-white/60">Priya Iyer · Partner, Mehta & Iyer LLP</p>
          </div>
        </div>

        <div className="relative" />
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-12 bg-white overflow-y-auto">
        <div className="w-full max-w-[380px] space-y-8">
          <div>
            <h2 className="text-2xl font-semibold text-text mb-1">Welcome back</h2>
            <p className="text-sm text-text-2">
              Don't have an account?{' '}
              <Link to="/signup" className="text-indigo font-medium hover:underline">
                Get early access
              </Link>
            </p>
          </div>

          {/* SSO buttons */}
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
            <span className="text-xs text-text-3">or sign in with email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {displayError && (
              <div className="p-3 bg-danger-lt border border-danger/20 rounded-[8px] text-sm text-danger">
                {displayError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Work email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
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
                  required
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

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-border accent-indigo" />
              <span className="text-sm text-text-2">Remember me for 30 days</span>
            </label>

            <button
              type="submit"
              disabled={loading || !isLoaded}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo text-white text-sm font-semibold rounded-[8px] hover:bg-indigo-dk transition-colors disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>

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
