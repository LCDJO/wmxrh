import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TenantProvider, useTenant } from "./contexts/TenantContext";
import { ScopeProvider } from "./contexts/ScopeContext";
import { ProtectedRoute } from "./domains/security";
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
import Compliance from "./pages/Compliance";
import Benefits from "./pages/Benefits";
import Health from "./pages/Health";
import LaborDashboard from "./pages/LaborDashboard";
import Audit from "./pages/Audit";
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
        <Route path="/" element={
          <ProtectedRoute navKey="dashboard">
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/employees" element={
          <ProtectedRoute navKey="employees">
            <Employees />
          </ProtectedRoute>
        } />
        <Route path="/employees/:id" element={
          <ProtectedRoute navKey="employees">
            <EmployeeDetail />
          </ProtectedRoute>
        } />
        <Route path="/companies" element={
          <ProtectedRoute navKey="companies">
            <Companies />
          </ProtectedRoute>
        } />
        <Route path="/groups" element={
          <ProtectedRoute navKey="groups">
            <CompanyGroups />
          </ProtectedRoute>
        } />
        <Route path="/positions" element={
          <ProtectedRoute navKey="positions">
            <Positions />
          </ProtectedRoute>
        } />
        <Route path="/compensation" element={
          <ProtectedRoute navKey="compensation">
            <Compensation />
          </ProtectedRoute>
        } />
        <Route path="/departments" element={
          <ProtectedRoute navKey="departments">
            <Departments />
          </ProtectedRoute>
        } />
        <Route path="/compliance" element={
          <ProtectedRoute navKey="compliance">
            <Compliance />
          </ProtectedRoute>
        } />
        <Route path="/benefits" element={
          <ProtectedRoute navKey="benefits">
            <Benefits />
          </ProtectedRoute>
        } />
        <Route path="/health" element={
          <ProtectedRoute navKey="health">
            <Health />
          </ProtectedRoute>
        } />
        <Route path="/labor-dashboard" element={
          <ProtectedRoute navKey="labor_dashboard">
            <LaborDashboard />
          </ProtectedRoute>
        } />
        <Route path="/audit" element={
          <ProtectedRoute navKey="audit">
            <Audit />
          </ProtectedRoute>
        } />
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
