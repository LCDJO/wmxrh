import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, useRoutes, Navigate } from "react-router-dom";
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
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import LandingPagePreview from "./pages/landing/LandingPagePreview";
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

function AppRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { isPlatformUser, loading: platformLoading } = useAdaptiveUserType();

  // ── Loading states ──
  if (authLoading || (user && tenantLoading) || (user && platformLoading)) {
    return <FullScreenLoader label="Carregando..." />;
  }

  // ── Unauthenticated ──
  if (!user) {
    return useRoutes(authRoutes);
  }

  // ── Build authenticated route set ──
  const sharedRoutes: RouteObject[] = [
    ...platformRoutes,
    { path: '/lp/:slug', element: <LandingPagePreview /> },
    { path: '/auth/login', element: <Navigate to="/" replace /> },
    { path: '/reset-password', element: <ResetPassword /> },
  ];

  let routes: RouteObject[];

  if (!currentTenant) {
    if (isPlatformUser) {
      routes = [
        ...sharedRoutes,
        { path: '*', element: <Navigate to="/platform/dashboard" replace /> },
      ];
    } else {
      routes = [
        ...sharedRoutes,
        { path: '*', element: <FullScreenLoader label="Carregando tenant..." /> },
      ];
    }
  } else {
    routes = [
      ...sharedRoutes,
      ...tenantRoutes,
      { path: '*', element: <NotFound /> },
    ];
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
