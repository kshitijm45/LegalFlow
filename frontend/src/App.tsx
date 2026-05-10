import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useClerk } from '@clerk/react'
import { useEffect } from 'react'

function SSOCallback() {
  const { handleRedirectCallback } = useClerk()
  const navigate = useNavigate()

  useEffect(() => {
    handleRedirectCallback({
      signInForceRedirectUrl: '/app/dashboard',
      signUpForceRedirectUrl: '/app/dashboard',
      signInUrl: '/login',
      signUpUrl: '/signup',
      continueSignUpUrl: '/signup',
      transferable: true,
    }).catch(() => navigate('/login', { replace: true }))
  }, [])

  return (
    <div className="h-full flex items-center justify-center bg-white">
      <div className="w-5 h-5 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

import { AppLayout } from '@/components/layout/AppLayout'
import { LandingPage } from '@/pages/landing/LandingPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignupPage } from '@/pages/auth/SignupPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { VaultPage } from '@/pages/vault/VaultPage'
import { MarketAnalysisPage } from '@/pages/market-analysis/MarketAnalysisPage'
import { ClauseAuditPage } from '@/pages/clause-audit/ClauseAuditPage'
import { ObligationsPage } from '@/pages/obligations/ObligationsPage'
import { TimelinePage } from '@/pages/timeline/TimelinePage'
import { WorkflowBuilderPage } from '@/pages/workflow-builder/WorkflowBuilderPage'
import { UserManagementPage } from '@/pages/settings/UserManagementPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* OAuth SSO callback — Clerk handles the redirect exchange here */}
          <Route path="/sso-callback" element={<SSOCallback />} />

          {/* Protected app */}
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="vault" element={<VaultPage />} />
            <Route path="market-analysis" element={<MarketAnalysisPage />} />
            <Route path="clause-audit" element={<ClauseAuditPage />} />
            <Route path="obligations" element={<ObligationsPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="workflow-builder" element={<WorkflowBuilderPage />} />
            <Route path="settings/users" element={<UserManagementPage />} />
            <Route path="settings/security" element={<Navigate to="/app/settings/users" replace />} />
            <Route path="settings/billing" element={<Navigate to="/app/settings/users" replace />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
