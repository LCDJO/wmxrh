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
import Notifications from "./pages/Notifications";
import WorkforceIntelligence from "./pages/WorkforceIntelligence";
import StrategicIntelligence from "./pages/StrategicIntelligence";
import ESocialDashboard from "./pages/ESocialDashboard";
import AgreementManagement from "./pages/AgreementManagement";
import TenantCommunicationCenter from "./pages/TenantCommunicationCenter";
import TenantAnnouncements from "./pages/TenantAnnouncements";
import DocumentSignatureIntegrations from "./pages/DocumentSignatureIntegrations";
import OccupationalCompliance from "./pages/OccupationalCompliance";
import NrComplianceDashboard from "./pages/NrComplianceDashboard";
import IAMManagement from "./pages/IAMManagement";
import SettingsUsers from "./pages/SettingsUsers";
import SettingsRoles from "./pages/SettingsRoles";
import SettingsGamification from "./pages/SettingsGamification";
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import PlatformTenants from "./pages/platform/PlatformTenants";
import PlatformModules from "./pages/platform/PlatformModules";
import PlatformSecurity from "./pages/platform/PlatformSecurity";
import PlatformCommunications from "./pages/platform/PlatformCommunications";
import PlatformAudit from "./pages/platform/PlatformAudit";
import PlatformUsers from "./pages/platform/PlatformUsers";
import PlatformPlans from "./pages/platform/PlatformPlans";
import PlatformIAM from "./pages/platform/PlatformIAM";
import PlatformSecurityRoles from "./pages/platform/PlatformSecurityRoles";
import PlatformSecurityPermissions from "./pages/platform/PlatformSecurityPermissions";
import PlatformSecurityAccessGraph from "./pages/platform/PlatformSecurityAccessGraph";
import PlatformUnifiedGraph from "./pages/platform/PlatformUnifiedGraph";
import PlatformGovernance from "./pages/platform/PlatformGovernance";
import PlatformAutomation from "./pages/platform/PlatformAutomation";
import PlatformGovernanceAI from "./pages/platform/PlatformGovernanceAI";
import PlatformGovernanceDashboard from "./pages/platform/PlatformGovernanceDashboard";
import PlatformObservability from "./pages/platform/PlatformObservability";
import PlatformMonitoring from "./pages/platform/PlatformMonitoring";
import PlatformControlPlane from "./pages/platform/PlatformControlPlane";
import PlatformBilling from "./pages/platform/PlatformBilling";
import PlatformRevenue from "./pages/platform/PlatformRevenue";
import PlatformCoupons from "./pages/platform/PlatformCoupons";
import BillingControlCenter from "./pages/platform/BillingControlCenter";
import PlatformEvents from "./pages/platform/PlatformEvents";
import PlatformMenuStructure from "./pages/platform/PlatformMenuStructure";
import PlatformModulesCatalog from "./pages/platform/PlatformModulesCatalog";
import PlatformRevenueIntelligence from "./pages/platform/PlatformRevenueIntelligence";
import PlatformReferrals from "./pages/platform/PlatformReferrals";
import PlatformGamification from "./pages/platform/PlatformGamification";
import PlatformGrowthAI from "./pages/platform/PlatformGrowthAI";
import GrowthInsights from "./pages/platform/growth/GrowthInsights";
import GrowthLandingPages from "./pages/platform/growth/GrowthLandingPages";
import GrowthConversions from "./pages/platform/growth/GrowthConversions";
import GrowthFABBuilder from "./pages/platform/growth/GrowthFABBuilder";
import GrowthTemplateEngine from "./pages/platform/growth/GrowthTemplateEngine";
import GrowthVersionPublish from "./pages/platform/growth/GrowthVersionPublish";
import GrowthSubmissions from "./pages/platform/growth/GrowthSubmissions";
import GrowthApprovals from "./pages/platform/growth/GrowthApprovals";
import GrowthWebsiteDashboard from "./pages/platform/growth/GrowthWebsiteDashboard";
import GrowthAIDesigner from "./pages/platform/growth/GrowthAIDesigner";
import MarketingAnalytics from "./pages/platform/marketing/MarketingAnalytics";
import MarketingInsights from "./pages/platform/marketing/MarketingInsights";
import MarketingRollbackDashboard from "./pages/platform/marketing/MarketingRollbackDashboard";
import MarketingFunnels from "./pages/platform/marketing/MarketingFunnels";
import MarketingCampaigns from "./pages/platform/marketing/MarketingCampaigns";
import MarketingPipeline from "./pages/platform/marketing/MarketingPipeline";
import MarketingDashboard from "./pages/platform/marketing/MarketingDashboard";
import LandingDrafts from "./pages/platform/landing/LandingDrafts";
import LandingReview from "./pages/platform/landing/LandingReview";
import LandingPublished from "./pages/platform/landing/LandingPublished";
import ReferralPage from "./pages/ReferralPage";
import LandingPagePreview from "./pages/landing/LandingPagePreview";
import WebsitePages from "./pages/platform/website/WebsitePages";
import WebsiteStructure from "./pages/platform/website/WebsiteStructure";
import WebsiteSEO from "./pages/platform/website/WebsiteSEO";
import WebsiteApprovals from "./pages/platform/website/WebsiteApprovals";

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
        <Route path="security/roles" element={<PlatformSecurityRoles />} />
        <Route path="security/permissions" element={<PlatformSecurityPermissions />} />
        <Route path="security/access-graph" element={<PlatformSecurityAccessGraph />} />
        <Route path="security/unified-graph" element={<PlatformUnifiedGraph />} />
        <Route path="security/governance" element={<PlatformGovernance />} />
        <Route path="security/governance-ai" element={<PlatformGovernanceAI />} />
        <Route path="governance" element={<PlatformGovernanceDashboard />} />
        <Route path="automation" element={<PlatformAutomation />} />
        <Route path="observability" element={<PlatformObservability />} />
        <Route path="monitoring/*" element={<PlatformGuard allowedRoles={['platform_super_admin', 'platform_operations']}><PlatformMonitoring /></PlatformGuard>} />
        <Route path="control-plane" element={<PlatformGuard allowedRoles={['platform_super_admin', 'platform_operations']}><PlatformControlPlane /></PlatformGuard>} />
        <Route path="plans" element={<PlatformPlans />} />
        <Route path="audit" element={<PlatformAudit />} />
        <Route path="communications" element={<PlatformCommunications />} />
        <Route path="billing" element={<PlatformBilling />} />
        <Route path="billing/coupons" element={<PlatformCoupons />} />
        <Route path="billing/control-center" element={<BillingControlCenter />} />
        <Route path="revenue" element={<PlatformRevenue />} />
        <Route path="revenue/intelligence" element={<PlatformRevenueIntelligence />} />
        <Route path="referrals" element={<PlatformReferrals />} />
        <Route path="gamification" element={<PlatformGamification />} />
        <Route path="iam" element={<PlatformIAM />} />
        <Route path="structure/events" element={<PlatformEvents />} />
        <Route path="structure/menus" element={<PlatformMenuStructure />} />
        <Route path="structure/modules" element={<PlatformModulesCatalog />} />
        <Route path="growth" element={<PlatformGrowthAI />} />
        <Route path="growth/insights" element={<GrowthInsights />} />
        <Route path="growth/landing-pages" element={<GrowthLandingPages />} />
        <Route path="growth/conversions" element={<GrowthConversions />} />
        <Route path="growth/fab-builder" element={<GrowthFABBuilder />} />
        <Route path="growth/template-engine" element={<GrowthTemplateEngine />} />
        <Route path="growth/version-publish" element={<GrowthVersionPublish />} />
        <Route path="growth/submissions" element={<GrowthSubmissions />} />
        <Route path="growth/approvals" element={<GrowthApprovals />} />
        <Route path="website" element={<GrowthWebsiteDashboard />} />
        <Route path="website/pages" element={<WebsitePages />} />
        <Route path="website/structure" element={<WebsiteStructure />} />
        <Route path="website/seo" element={<WebsiteSEO />} />
        <Route path="website/ai-designer" element={<GrowthAIDesigner />} />
        <Route path="website/templates" element={<GrowthTemplateEngine />} />
        <Route path="website/versions" element={<GrowthVersionPublish />} />
        <Route path="website/approvals" element={<WebsiteApprovals />} />
        <Route path="marketing/analytics" element={<MarketingAnalytics />} />
        <Route path="marketing/insights" element={<MarketingInsights />} />
        <Route path="marketing/dashboard" element={<MarketingDashboard />} />
                <Route path="marketing/rollback" element={<MarketingRollbackDashboard />} />
                <Route path="marketing/funnels" element={<MarketingFunnels />} />
                <Route path="marketing/campaigns" element={<MarketingCampaigns />} />
                <Route path="marketing/pipeline" element={<MarketingPipeline />} />
        <Route path="landing/drafts" element={<LandingDrafts />} />
        <Route path="landing/review" element={<LandingReview />} />
        <Route path="landing/published" element={<LandingPublished />} />
      </Route>

      {/* ═══ LANDING PAGE RENDERER ═══ */}
      <Route path="/lp/:slug" element={<LandingPagePreview />} />

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
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/announcements" element={<TenantAnnouncements />} />
          <Route path="/communication-center" element={<TenantCommunicationCenter />} />
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
          <Route path="/settings/gamification" element={
            <ProtectedRoute navKey="iam_roles"><SettingsGamification /></ProtectedRoute>
          } />
          <Route path="/referral" element={
            <ProtectedRoute navKey="dashboard"><ReferralPage /></ProtectedRoute>
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
