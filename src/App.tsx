import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TenantProvider, useTenant } from "./contexts/TenantContext";
import { ScopeProvider } from "./contexts/ScopeContext";
import { ProtectedRoute } from "./domains/security";
import { PlatformGuard } from "./domains/platform/PlatformGuard";
import { PlatformShell } from "./components/platform/PlatformShell";
import { useAdaptiveUserType } from "./components/layout/AdaptiveSidebar";
import { AppLayout } from "./components/layout/AppLayout";
import PlatformLayout from "./components/platform/PlatformLayout";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import AdaptiveOnboardingWizard from "./pages/AdaptiveOnboardingWizard";
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
import LaborCompliance from "./pages/LaborCompliance";
import LaborRules from "./pages/LaborRules";
import LegalDashboard from "./pages/LegalDashboard";
import Audit from "./pages/Audit";
import PayrollSimulation from "./pages/PayrollSimulation";
import NotFound from "./pages/NotFound";
import WorkforceIntelligence from "./pages/WorkforceIntelligence";
import StrategicIntelligence from "./pages/StrategicIntelligence";
import ESocialDashboard from "./pages/ESocialDashboard";
import AgreementManagement from "./pages/AgreementManagement";
import DocumentSignatureIntegrations from "./pages/DocumentSignatureIntegrations";
import OccupationalCompliance from "./pages/OccupationalCompliance";
import NrComplianceDashboard from "./pages/NrComplianceDashboard";
import IAMManagement from "./pages/IAMManagement";
import SettingsUsers from "./pages/SettingsUsers";
import SettingsRoles from "./pages/SettingsRoles";
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import PlatformTenants from "./pages/platform/PlatformTenants";
import PlatformModules from "./pages/platform/PlatformModules";
import PlatformSecurity from "./pages/platform/PlatformSecurity";
import PlatformAudit from "./pages/platform/PlatformAudit";
import PlatformUsers from "./pages/platform/PlatformUsers";
import PlatformPlans from "./pages/platform/PlatformPlans";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { userType, isPlatformUser, loading: platformLoading } = useAdaptiveUserType();

  if (authLoading || (user && tenantLoading) || (user && platformLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated → login
  if (!user) {
    return (
      <Routes>
        <Route path="/auth/login" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/auth/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* ═══ PLATFORM ROUTES — always mounted, guarded internally ═══ */}
      <Route
        path="/platform"
        element={
          <PlatformGuard>
            <PlatformLayout />
          </PlatformGuard>
        }
      >
        <Route index element={<Navigate to="/platform/dashboard" replace />} />
        <Route path="dashboard" element={<PlatformDashboard />} />
        <Route path="tenants" element={<PlatformTenants />} />
        <Route path="modules" element={<PlatformModules />} />
        <Route path="users" element={<PlatformUsers />} />
        <Route path="security" element={<PlatformSecurity />} />
        <Route path="plans" element={<PlatformPlans />} />
        <Route path="audit" element={<PlatformAudit />} />
      </Route>

      <Route path="/auth/login" element={<Navigate to="/" replace />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* ═══ TENANT ROUTES ═══ */}
      {!currentTenant ? (
        isPlatformUser ? (
          /* Platform user with no tenant → redirect to platform */
          <Route path="*" element={<Navigate to="/platform/dashboard" replace />} />
        ) : (
          <Route path="*" element={
            <AdaptiveOnboardingWizard
              planTier="free"
              onComplete={() => window.location.reload()}
            />
          } />
        )
      ) : (
        <Route element={<AppLayout />}>
          <Route path="/" element={
            <ProtectedRoute navKey="dashboard"><Dashboard /></ProtectedRoute>
          } />
          <Route path="/employees" element={
            <ProtectedRoute navKey="employees"><Employees /></ProtectedRoute>
          } />
          <Route path="/employees/:id" element={
            <ProtectedRoute navKey="employees"><EmployeeDetail /></ProtectedRoute>
          } />
          <Route path="/companies" element={
            <ProtectedRoute navKey="companies"><Companies /></ProtectedRoute>
          } />
          <Route path="/groups" element={
            <ProtectedRoute navKey="groups"><CompanyGroups /></ProtectedRoute>
          } />
          <Route path="/positions" element={
            <ProtectedRoute navKey="positions"><Positions /></ProtectedRoute>
          } />
          <Route path="/compensation" element={
            <ProtectedRoute navKey="compensation"><Compensation /></ProtectedRoute>
          } />
          <Route path="/departments" element={
            <ProtectedRoute navKey="departments"><Departments /></ProtectedRoute>
          } />
          <Route path="/compliance" element={
            <ProtectedRoute navKey="compliance"><Compliance /></ProtectedRoute>
          } />
          <Route path="/benefits" element={
            <ProtectedRoute navKey="benefits"><Benefits /></ProtectedRoute>
          } />
          <Route path="/health" element={
            <ProtectedRoute navKey="health"><Health /></ProtectedRoute>
          } />
          <Route path="/labor-dashboard" element={
            <ProtectedRoute navKey="labor_dashboard"><LaborDashboard /></ProtectedRoute>
          } />
          <Route path="/audit" element={
            <ProtectedRoute navKey="audit"><Audit /></ProtectedRoute>
          } />
          <Route path="/labor-compliance" element={
            <ProtectedRoute navKey="labor_compliance"><LaborCompliance /></ProtectedRoute>
          } />
          <Route path="/labor-rules" element={
            <ProtectedRoute navKey="labor_rules"><LaborRules /></ProtectedRoute>
          } />
          <Route path="/legal-dashboard" element={
            <ProtectedRoute navKey="legal_dashboard"><LegalDashboard /></ProtectedRoute>
          } />
          <Route path="/payroll-simulation" element={
            <ProtectedRoute navKey="compensation"><PayrollSimulation /></ProtectedRoute>
          } />
          <Route path="/workforce-intelligence" element={
            <ProtectedRoute navKey="dashboard"><WorkforceIntelligence /></ProtectedRoute>
          } />
          <Route path="/strategic-intelligence" element={
            <ProtectedRoute navKey="dashboard"><StrategicIntelligence /></ProtectedRoute>
          } />
          <Route path="/esocial" element={
            <ProtectedRoute navKey="esocial"><ESocialDashboard /></ProtectedRoute>
          } />
          <Route path="/agreements" element={
            <ProtectedRoute navKey="employees"><AgreementManagement /></ProtectedRoute>
          } />
          <Route path="/document-signature" element={
            <ProtectedRoute navKey="esocial"><DocumentSignatureIntegrations /></ProtectedRoute>
          } />
          <Route path="/occupational-compliance" element={
            <ProtectedRoute navKey="health"><OccupationalCompliance /></ProtectedRoute>
          } />
          <Route path="/nr-compliance" element={
            <ProtectedRoute navKey="health"><NrComplianceDashboard /></ProtectedRoute>
          } />
          <Route path="/iam" element={<Navigate to="/settings/users" replace />} />
          <Route path="/settings/users" element={
            <ProtectedRoute navKey="iam_users"><SettingsUsers /></ProtectedRoute>
          } />
          <Route path="/settings/roles" element={
            <ProtectedRoute navKey="iam_roles"><SettingsRoles /></ProtectedRoute>
          } />
        </Route>
      )}
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
              <PlatformShell>
                <AppRoutes />
              </PlatformShell>
            </ScopeProvider>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
