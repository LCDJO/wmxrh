import React, { useEffect, useMemo } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, useRoutes, Navigate, useLocation } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TenantProvider, useTenant } from "./contexts/TenantContext";
import { ScopeProvider } from "./contexts/ScopeContext";
import { PlatformShell } from "./components/platform/PlatformShell";
import { useAdaptiveUserType } from "./components/layout/AdaptiveSidebar";
import { DevConsole } from "./components/shared/DevConsole";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { pushAppError } from "./lib/app-error-store";
import { toast } from "sonner";
import { usePendingPolicies } from "./hooks/use-pending-policies";
import { useBanCheck } from "./hooks/use-ban-check";
import { MandatoryPolicyScreen } from "./components/policy/MandatoryPolicyScreen";
import { BannedAccountScreen } from "./components/enforcement/BannedAccountScreen";
import ResetPassword from "./pages/auth/ResetPassword";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import LandingPagePreview from "./pages/landing/LandingPagePreview";
import LiveDisplayTV from "./pages/LiveDisplayTV";
import PublicDocumentValidation from "./pages/PublicDocumentValidation";
import LiveDisplayPair from "./pages/LiveDisplayPair";
import StatusPage from "./pages/StatusPage";
import { authRoutes } from "./routes/auth.routes";
import { platformRoutes } from "./routes/platform.routes";
import { tenantRoutes } from "./routes/tenant.routes";

const queryClient = new QueryClient();

/** Global loading spinner */
function FullScreenLoader({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="h-8 w-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** Static public routes — no auth needed */
const publicRoutes: RouteObject[] = [
  { path: '/tv', element: <LiveDisplayTV /> },
  { path: '/display', element: <LiveDisplayTV /> },
  { path: '/live-display/pair', element: <LiveDisplayPair /> },
  { path: '/public/validate/:token', element: <PublicDocumentValidation /> },
  { path: '/status', element: <StatusPage /> },
];

function AppRoutes() {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { isPlatformUser, loading: platformLoading } = useAdaptiveUserType();
  const { pending, loading: policyLoading, hasPending, checked: policyChecked, refresh: refreshPolicies } = usePendingPolicies();
  const banCheck = useBanCheck();

  const routes = useMemo<RouteObject[]>(() => {
    if (authLoading || (user && tenantLoading) || (user && platformLoading)) {
      return [
        { path: '/', element: <Landing /> },
        ...publicRoutes,
        { path: '*', element: <FullScreenLoader label="Carregando..." /> },
      ];
    }

    if (!user) {
      return [
        { path: '/', element: <Landing /> },
        ...authRoutes,
        ...publicRoutes,
      ];
    }

    // Wait for ban + policy checks before rendering tenant routes
    if (currentTenant && (!banCheck.checked || !policyChecked)) {
      return [
        ...publicRoutes,
        { path: '*', element: <FullScreenLoader label="Verificando status da conta..." /> },
      ];
    }

    // ── BAN GATE: block all access for banned/suspended tenants ──
    if (currentTenant && banCheck.restricted && banCheck.status !== 'active') {
      return [
        ...publicRoutes,
        { path: '*', element: <BannedAccountScreen status={banCheck.status as any} enforcements={banCheck.enforcements} /> },
      ];
    }

    const hasPendingRedirect = !!sessionStorage.getItem('redirectAfterLogin');

    const sharedRoutes: RouteObject[] = [
      ...platformRoutes,
      ...publicRoutes,
      { path: '/lp/:slug', element: <LandingPagePreview /> },
      { path: '/auth/login', element: hasPendingRedirect ? <FullScreenLoader label="Redirecionando..." /> : <Navigate to="/" replace /> },
      { path: '/reset-password', element: <ResetPassword /> },
    ];

    if (!currentTenant) {
      if (isPlatformUser) {
        return [
          ...sharedRoutes,
          { path: '*', element: hasPendingRedirect ? <FullScreenLoader label="Redirecionando..." /> : <Navigate to="/platform/dashboard" replace /> },
        ];
      }
      return [
        ...sharedRoutes,
        { path: '*', element: <FullScreenLoader label="Carregando tenant..." /> },
      ];
    }

    // ── MANDATORY POLICY GATE: block all tenant access until accepted ──
    if (hasPending) {
      return [
        ...publicRoutes,
        { path: '*', element: <MandatoryPolicyScreen pending={pending} onAccepted={refreshPolicies} /> },
      ];
    }

    return [
      ...sharedRoutes,
      ...tenantRoutes,
      { path: '*', element: <NotFound /> },
    ];
  }, [user, authLoading, tenantLoading, platformLoading, currentTenant, isPlatformUser, policyChecked, hasPending, pending, refreshPolicies, banCheck]);

  // Landing page em '/' para usuários não autenticados — após todos os hooks
  if (location.pathname === '/' && (authLoading || !user)) {
    return <Landing />;
  }

  return useRoutes(routes);
}

function UnhandledRejectionGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      console.error('[UnhandledRejection]', reason);
      pushAppError({
        source: 'unhandled_rejection',
        message,
        stack: reason instanceof Error ? reason.stack : undefined,
      });
      toast.error('Ocorreu um erro inesperado. Tente novamente.');
      event.preventDefault();
    };

    const errorHandler = (event: ErrorEvent) => {
      pushAppError({
        source: 'global_error',
        message: event.message,
        stack: event.error instanceof Error ? event.error.stack : undefined,
      });
    };

    window.addEventListener('unhandledrejection', rejectionHandler);
    window.addEventListener('error', errorHandler);
    return () => {
      window.removeEventListener('unhandledrejection', rejectionHandler);
      window.removeEventListener('error', errorHandler);
    };
  }, []);
  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <DevConsole />
        <UnhandledRejectionGuard>
          <BrowserRouter>
            <AuthProvider>
              <TenantProvider>
                <ScopeProvider>
                  <PlatformShell>
                    <ErrorBoundary>
                      <AppRoutes />
                    </ErrorBoundary>
                  </PlatformShell>
                </ScopeProvider>
              </TenantProvider>
            </AuthProvider>
          </BrowserRouter>
        </UnhandledRejectionGuard>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
