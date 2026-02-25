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
import PlatformIntegrationHealth from '@/pages/platform/PlatformIntegrationHealth';

const PlatformSupportConsole = lazy(() => import('@/modules/support/ui/PlatformSupportConsole'));

const SuspenseFallback = <div className="p-8 text-muted-foreground">Carregando...</div>;

/** Helper to wrap element with role-restricted PlatformGuard */
function guarded(element: React.ReactNode, roles: Parameters<typeof PlatformGuard>[0]['allowedRoles']) {
  return <PlatformGuard allowedRoles={roles}>{element}</PlatformGuard>;
}

const opsAdmin: Parameters<typeof PlatformGuard>[0]['allowedRoles'] = ['platform_super_admin', 'platform_operations'];
const securityAdmin: Parameters<typeof PlatformGuard>[0]['allowedRoles'] = ['platform_super_admin', 'platform_operations', 'platform_support_manager'];
const financeAdmin: Parameters<typeof PlatformGuard>[0]['allowedRoles'] = ['platform_super_admin', 'platform_operations', 'platform_finance', 'platform_fiscal'];
const marketingRoles: Parameters<typeof PlatformGuard>[0]['allowedRoles'] = ['platform_super_admin', 'platform_operations', 'platform_marketing', 'platform_marketing_director', 'platform_marketing_team'];
const supportRoles: Parameters<typeof PlatformGuard>[0]['allowedRoles'] = ['platform_super_admin', 'platform_operations', 'platform_support', 'platform_support_agent', 'platform_support_manager', 'platform_support_coordinator'];
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
      { path: 'tenants', element: guarded(<PlatformTenants />, opsAdmin) },
      { path: 'modules', element: guarded(<PlatformModules />, opsAdmin) },
      { path: 'users', element: guarded(<PlatformUsers />, securityAdmin) },
      { path: 'users/dashboard', element: guarded(<PlatformUsersDashboard />, securityAdmin) },
      { path: 'security', element: guarded(<PlatformSecurity />, securityAdmin) },
      { path: 'security/dashboard', element: guarded(<PlatformSecurityDashboard />, securityAdmin) },
      { path: 'security/roles', element: guarded(<PlatformSecurityRoles />, securityAdmin) },
      { path: 'security/permissions', element: guarded(<PlatformSecurityPermissions />, securityAdmin) },
      { path: 'security/access-graph', element: guarded(<PlatformSecurityAccessGraph />, securityAdmin) },
      { path: 'security/unified-graph', element: guarded(<PlatformUnifiedGraph />, securityAdmin) },
      { path: 'security/governance', element: guarded(<PlatformGovernance />, opsAdmin) },
      { path: 'security/governance-ai', element: guarded(<PlatformGovernanceAI />, opsAdmin) },
      { path: 'governance', element: guarded(<PlatformGovernanceDashboard />, opsAdmin) },
      { path: 'automation', element: guarded(<PlatformAutomation />, opsAdmin) },
      { path: 'integration-automation/*', element: guarded(<PlatformIntegrationAutomation />, opsAdmin) },
      { path: 'observability', element: guarded(<PlatformObservability />, opsAdmin) },
      { path: 'monitoring/*', element: guarded(<PlatformMonitoring />, opsAdmin) },
      { path: 'control-plane', element: guarded(<PlatformControlPlane />, opsAdmin) },
      { path: 'plans', element: guarded(<PlatformPlans />, financeAdmin) },
      { path: 'audit', element: guarded(<PlatformAudit />, opsAdmin) },
      { path: 'logs', element: guarded(<PlatformLogs />, ['platform_super_admin']) },
      { path: 'communications', element: guarded(<PlatformCommunications />, opsAdmin) },
      { path: 'billing', element: guarded(<PlatformBilling />, financeAdmin) },
      { path: 'billing/coupons', element: guarded(<PlatformCoupons />, financeAdmin) },
      { path: 'billing/control-center', element: guarded(<BillingControlCenter />, financeAdmin) },
      { path: 'revenue', element: guarded(<PlatformRevenue />, financeAdmin) },
      { path: 'revenue/intelligence', element: guarded(<PlatformRevenueIntelligence />, financeAdmin) },
      { path: 'referrals', element: guarded(<PlatformReferrals />, marketingRoles) },
      { path: 'settings/gamification', element: guarded(<SettingsGamification />, opsAdmin) },
      { path: 'iam', element: guarded(<PlatformIAM />, securityAdmin) },
      { path: 'structure/events', element: guarded(<PlatformEvents />, opsAdmin) },
      { path: 'structure/menus', element: guarded(<PlatformMenuStructure />, opsAdmin) },
      { path: 'structure/modules', element: guarded(<PlatformModulesCatalog />, opsAdmin) },
      { path: 'settings/versioning', element: guarded(<PlatformVersioning />, opsAdmin) },
      { path: 'settings/saas', element: guarded(<PlatformSaasSettings />, opsAdmin) },
      // ── Growth / Website ──
      { path: 'growth', element: guarded(<PlatformGrowthAI />, marketingRoles) },
      { path: 'growth/insights', element: guarded(<GrowthInsights />, marketingRoles) },
      { path: 'growth/landing-pages', element: guarded(<GrowthLandingPages />, marketingRoles) },
      { path: 'growth/conversions', element: guarded(<GrowthConversions />, marketingRoles) },
      { path: 'growth/fab-builder', element: guarded(<GrowthFABBuilder />, marketingRoles) },
      { path: 'growth/template-engine', element: guarded(<GrowthTemplateEngine />, marketingRoles) },
      { path: 'growth/version-publish', element: guarded(<GrowthVersionPublish />, marketingRoles) },
      { path: 'growth/submissions', element: guarded(<GrowthSubmissions />, marketingRoles) },
      { path: 'growth/approvals', element: guarded(<GrowthApprovals />, marketingRoles) },
      { path: 'website', element: guarded(<GrowthWebsiteDashboard />, marketingRoles) },
      { path: 'website/ai-designer', element: guarded(<GrowthAIDesigner />, marketingRoles) },
      { path: 'website/templates', element: guarded(<GrowthTemplateEngine />, marketingRoles) },
      { path: 'website/versions', element: guarded(<GrowthVersionPublish />, marketingRoles) },
      // ── Marketing / Landing ──
      { path: 'marketing/analytics', element: guarded(<MarketingAnalytics />, marketingRoles) },
      { path: 'landing/drafts', element: guarded(<LandingDrafts />, marketingRoles) },
      { path: 'landing/review', element: guarded(<LandingReview />, marketingRoles) },
      { path: 'landing/published', element: guarded(<LandingPublished />, marketingRoles) },
      // ── Support ──
      { path: 'support/console', element: guarded(<Suspense fallback={SuspenseFallback}><PlatformSupportConsole /></Suspense>, supportRoles) },
      { path: 'support/analytics', element: guarded(<PlatformSupportAnalytics />, supportRoles) },
      // ── APIs / Developers / Marketplace ──
      { path: 'apis/*', element: guarded(<PlatformApiManagement />, opsAdmin) },
      { path: 'developers', element: guarded(<PlatformDevelopers />, marketplaceAdmin) },
      { path: 'marketplace', element: guarded(<PlatformMarketplace />, marketplaceAdmin) },
      { path: 'apps-review', element: guarded(<PlatformAppsReview />, opsAdmin) },
      { path: 'ai-operations', element: guarded(<PlatformAIOperations />, opsAdmin) },
      { path: 'document-signature', element: guarded(<DocumentSignatureIntegrations />, opsAdmin) },
      { path: 'integration-health', element: guarded(<PlatformIntegrationHealth />, opsAdmin) },
    ],
  },
];
