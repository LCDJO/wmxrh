/**
 * Platform Routes — RouteObject[] for /platform/* paths.
 */
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { PlatformGuard } from '@/domains/platform/PlatformGuard';
import PlatformLayout from '@/components/platform/PlatformLayout';
import PlatformDashboard from '@/pages/platform/PlatformDashboard';
import PlatformTenants from '@/pages/platform/PlatformTenants';
import PlatformModules from '@/pages/platform/PlatformModules';
import PlatformSecurity from '@/pages/platform/PlatformSecurity';
import PlatformCommunications from '@/pages/platform/PlatformCommunications';
import PlatformAudit from '@/pages/platform/PlatformAudit';
import PlatformUsers from '@/pages/platform/PlatformUsers';
import PlatformUsersDashboard from '@/pages/platform/PlatformUsersDashboard';
import PlatformSecurityDashboard from '@/pages/platform/PlatformSecurityDashboard';
import PlatformPlans from '@/pages/platform/PlatformPlans';
import PlatformIAM from '@/pages/platform/PlatformIAM';
import PlatformSecurityRoles from '@/pages/platform/PlatformSecurityRoles';
import PlatformSecurityPermissions from '@/pages/platform/PlatformSecurityPermissions';
import PlatformSecurityAccessGraph from '@/pages/platform/PlatformSecurityAccessGraph';
import PlatformUnifiedGraph from '@/pages/platform/PlatformUnifiedGraph';
import PlatformGovernance from '@/pages/platform/PlatformGovernance';
import PlatformAutomation from '@/pages/platform/PlatformAutomation';
import PlatformGovernanceAI from '@/pages/platform/PlatformGovernanceAI';
import PlatformGovernanceDashboard from '@/pages/platform/PlatformGovernanceDashboard';
import PlatformObservability from '@/pages/platform/PlatformObservability';
import PlatformMonitoring from '@/pages/platform/PlatformMonitoring';
import PlatformControlPlane from '@/pages/platform/PlatformControlPlane';
import PlatformBilling from '@/pages/platform/PlatformBilling';
import PlatformRevenue from '@/pages/platform/PlatformRevenue';
import PlatformCoupons from '@/pages/platform/PlatformCoupons';
import BillingControlCenter from '@/pages/platform/BillingControlCenter';
import PlatformEvents from '@/pages/platform/PlatformEvents';
import PlatformMenuStructure from '@/pages/platform/PlatformMenuStructure';
import PlatformModulesCatalog from '@/pages/platform/PlatformModulesCatalog';
import PlatformRevenueIntelligence from '@/pages/platform/PlatformRevenueIntelligence';
import PlatformReferrals from '@/pages/platform/PlatformReferrals';
import PlatformGrowthAI from '@/pages/platform/PlatformGrowthAI';
import GrowthInsights from '@/pages/platform/growth/GrowthInsights';
import GrowthLandingPages from '@/pages/platform/growth/GrowthLandingPages';
import GrowthConversions from '@/pages/platform/growth/GrowthConversions';
import GrowthFABBuilder from '@/pages/platform/growth/GrowthFABBuilder';
import GrowthTemplateEngine from '@/pages/platform/growth/GrowthTemplateEngine';
import GrowthVersionPublish from '@/pages/platform/growth/GrowthVersionPublish';
import GrowthSubmissions from '@/pages/platform/growth/GrowthSubmissions';
import GrowthApprovals from '@/pages/platform/growth/GrowthApprovals';
import GrowthWebsiteDashboard from '@/pages/platform/growth/GrowthWebsiteDashboard';
import GrowthAIDesigner from '@/pages/platform/growth/GrowthAIDesigner';
import MarketingAnalytics from '@/pages/platform/marketing/MarketingAnalytics';
import LandingDrafts from '@/pages/platform/landing/LandingDrafts';
import LandingReview from '@/pages/platform/landing/LandingReview';
import LandingPublished from '@/pages/platform/landing/LandingPublished';
import PlatformVersioning from '@/pages/platform/PlatformVersioning';
import PlatformSaasSettings from '@/pages/platform/PlatformSaasSettings';
import PlatformApiManagement from '@/pages/platform/PlatformApiManagement';
import PlatformDevelopers from '@/pages/platform/PlatformDevelopers';
import PlatformMarketplace from '@/pages/platform/PlatformMarketplace';
import PlatformAppsReview from '@/pages/platform/PlatformAppsReview';
import PlatformIntegrationAutomation from '@/pages/platform/PlatformIntegrationAutomation';
import PlatformAIOperations from '@/pages/platform/PlatformAIOperations';
import PlatformSupportAnalytics from '@/pages/platform/PlatformSupportAnalytics';
import PlatformLogs from '@/pages/platform/PlatformLogs';
import DocumentSignatureIntegrations from '@/pages/DocumentSignatureIntegrations';
import SettingsGamification from '@/pages/SettingsGamification';

const PlatformSupportConsole = lazy(() => import('@/modules/support/ui/PlatformSupportConsole'));

const SuspenseFallback = <div className="p-8 text-muted-foreground">Carregando...</div>;

/** Helper to wrap element with role-restricted PlatformGuard */
function guarded(element: React.ReactNode, roles: Parameters<typeof PlatformGuard>[0]['allowedRoles']) {
  return <PlatformGuard allowedRoles={roles}>{element}</PlatformGuard>;
}

const opsAdmin: Parameters<typeof PlatformGuard>[0]['allowedRoles'] = ['platform_super_admin', 'platform_operations'];
const marketplaceAdmin: Parameters<typeof PlatformGuard>[0]['allowedRoles'] = ['platform_super_admin', 'platform_operations', 'platform_marketplace_admin'];

export const platformRoutes: RouteObject[] = [
  {
    path: '/platform',
    element: (
      <PlatformGuard>
        <PlatformLayout />
      </PlatformGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/platform/dashboard" replace /> },
      { path: 'dashboard', element: <PlatformDashboard /> },
      { path: 'tenants', element: <PlatformTenants /> },
      { path: 'modules', element: <PlatformModules /> },
      { path: 'users', element: <PlatformUsers /> },
      { path: 'users/dashboard', element: <PlatformUsersDashboard /> },
      { path: 'security', element: <PlatformSecurity /> },
      { path: 'security/dashboard', element: <PlatformSecurityDashboard /> },
      { path: 'security/roles', element: <PlatformSecurityRoles /> },
      { path: 'security/permissions', element: <PlatformSecurityPermissions /> },
      { path: 'security/access-graph', element: <PlatformSecurityAccessGraph /> },
      { path: 'security/unified-graph', element: <PlatformUnifiedGraph /> },
      { path: 'security/governance', element: <Navigate to="/platform/governance" replace /> },
      { path: 'security/governance-ai', element: <PlatformGovernanceAI /> },
      { path: 'governance', element: <PlatformGovernanceDashboard /> },
      { path: 'automation', element: <PlatformAutomation /> },
      { path: 'integration-automation/*', element: <PlatformIntegrationAutomation /> },
      { path: 'observability', element: <PlatformObservability /> },
      { path: 'monitoring/*', element: guarded(<PlatformMonitoring />, opsAdmin) },
      { path: 'control-plane', element: guarded(<PlatformControlPlane />, opsAdmin) },
      { path: 'plans', element: <PlatformPlans /> },
      { path: 'audit', element: <PlatformAudit /> },
      { path: 'logs', element: guarded(<PlatformLogs />, ['platform_super_admin']) },
      { path: 'communications', element: <PlatformCommunications /> },
      { path: 'billing', element: <PlatformBilling /> },
      { path: 'billing/coupons', element: <PlatformCoupons /> },
      { path: 'billing/control-center', element: <BillingControlCenter /> },
      { path: 'revenue', element: <PlatformRevenue /> },
      { path: 'revenue/intelligence', element: <PlatformRevenueIntelligence /> },
      { path: 'referrals', element: <PlatformReferrals /> },
      { path: 'settings/gamification', element: <SettingsGamification /> },
      { path: 'iam', element: <PlatformIAM /> },
      { path: 'structure/events', element: <PlatformEvents /> },
      { path: 'structure/menus', element: <PlatformMenuStructure /> },
      { path: 'structure/modules', element: <PlatformModulesCatalog /> },
      { path: 'settings/versioning', element: guarded(<PlatformVersioning />, opsAdmin) },
      { path: 'settings/saas', element: guarded(<PlatformSaasSettings />, opsAdmin) },
      // ── Growth / Website ──
      { path: 'growth', element: <PlatformGrowthAI /> },
      { path: 'growth/insights', element: <GrowthInsights /> },
      { path: 'growth/landing-pages', element: <GrowthLandingPages /> },
      { path: 'growth/conversions', element: <GrowthConversions /> },
      { path: 'growth/fab-builder', element: <GrowthFABBuilder /> },
      { path: 'growth/template-engine', element: <GrowthTemplateEngine /> },
      { path: 'growth/version-publish', element: <GrowthVersionPublish /> },
      { path: 'growth/submissions', element: <GrowthSubmissions /> },
      { path: 'growth/approvals', element: <GrowthApprovals /> },
      { path: 'website', element: <GrowthWebsiteDashboard /> },
      { path: 'website/ai-designer', element: <GrowthAIDesigner /> },
      { path: 'website/templates', element: <GrowthTemplateEngine /> },
      { path: 'website/versions', element: <GrowthVersionPublish /> },
      // ── Marketing / Landing ──
      { path: 'marketing/analytics', element: <MarketingAnalytics /> },
      { path: 'landing/drafts', element: <LandingDrafts /> },
      { path: 'landing/review', element: <LandingReview /> },
      { path: 'landing/published', element: <LandingPublished /> },
      // ── Support ──
      { path: 'support/console', element: <Suspense fallback={SuspenseFallback}><PlatformSupportConsole /></Suspense> },
      { path: 'support/analytics', element: <PlatformSupportAnalytics /> },
      // ── APIs / Developers / Marketplace ──
      { path: 'apis/*', element: guarded(<PlatformApiManagement />, opsAdmin) },
      { path: 'developers', element: guarded(<PlatformDevelopers />, marketplaceAdmin) },
      { path: 'marketplace', element: guarded(<PlatformMarketplace />, marketplaceAdmin) },
      { path: 'apps-review', element: guarded(<PlatformAppsReview />, opsAdmin) },
      { path: 'ai-operations', element: guarded(<PlatformAIOperations />, opsAdmin) },
      { path: 'document-signature', element: guarded(<DocumentSignatureIntegrations />, opsAdmin) },
    ],
  },
];
