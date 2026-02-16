import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TenantProvider, useTenant } from "./contexts/TenantContext";
import { ScopeProvider } from "./contexts/ScopeContext";
import { AppLayout } from "./components/layout/AppLayout";
import Auth from "./pages/Auth";
import TenantOnboarding from "./pages/TenantOnboarding";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import EmployeeDetail from "./pages/EmployeeDetail";
import Companies from "./pages/Companies";
import CompanyGroups from "./pages/CompanyGroups";
import Positions from "./pages/Positions";
import Compensation from "./pages/Compensation";
import Departments from "./pages/Departments";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();

  if (authLoading || (user && tenantLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Auth />;
  if (!currentTenant) return <TenantOnboarding />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/employees/:id" element={<EmployeeDetail />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/groups" element={<CompanyGroups />} />
        <Route path="/positions" element={<Positions />} />
        <Route path="/compensation" element={<Compensation />} />
        <Route path="/departments" element={<Departments />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
            <ScopeProvider>
              <AppRoutes />
            </ScopeProvider>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
