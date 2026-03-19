/**
 * Platform Routes — RouteObject[] for /platform/* paths.
 *
 * Routes are grouped under nested parent routes (security/, billing/, growth/, etc.)
 * so that each group shares a single PlatformGuard at the parent level.
 * This avoids repeating the same guard on every child and enables future
 * shared layouts per section via Outlet.
 */
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate, Outlet } from 'react-router-dom';
import { PlatformGuard } from '@/domains/platform/PlatformGuard';
import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';
import PlatformLayout from '@/components/platform/PlatformLayout';
import PlatformDashboard from '@/pages/platform/PlatformDashboard';
import PlatformTenants from '@/pages/platform/tenants/PlatformTenants';
import PlatformModules from '@/pages/platform/tenants/PlatformModules';
import PlatformSecurity from '@/pages/platform/security/PlatformSecurity';
import PlatformCommunications from '@/pages/platform/comms/PlatformCommunications';
import PlatformUsers from '@/pages/platform/users/PlatformUsers';
import PlatformUsersDashboard from '@/pages/platform/users/PlatformUsersDashboard';
import PlatformSecurityDashboard from '@/pages/platform/security/PlatformSecurityDashboard';
import PlatformPlans from '@/pages/platform/billing/PlatformPlans';
import PlatformIAM from '@/pages/platform/security/PlatformIAM';
import PlatformSecurityRoles from '@/pages/platform/security/PlatformSecurityRoles';
import PlatformSecurityPermissions from '@/pages/platform/security/PlatformSecurityPermissions';
import PlatformSecurityAccessGraph from '@/pages/platform/security/PlatformSecurityAccessGraph';
import PlatformUnifiedGraph from '@/pages/platform/security/PlatformUnifiedGraph';
import PlatformGovernance from '@/pages/platform/governance/PlatformGovernance';
import PlatformAutomation from '@/pages/platform/infra/PlatformAutomation';
import PlatformGovernanceAI from '@/pages/platform/governance/PlatformGovernanceAI';
import PlatformGovernanceDashboard from '@/pages/platform/governance/PlatformGovernanceDashboard';
import PlatformObservability from '@/pages/platform/observability/PlatformObservability';
import PlatformMonitoring from '@/pages/platform/observability/PlatformMonitoring';
import PlatformUserActivityIntelligence from '@/pages/platform/users/PlatformUserActivityIntelligence';
import PlatformSecurityCenter from '@/pages/platform/security/PlatformSecurityCenter';
import PlatformControlPlane from '@/pages/platform/infra/PlatformControlPlane';
import PlatformTenantBranding from '@/pages/platform/tenants/PlatformTenantBranding';
import PlatformDRTests from '@/pages/platform/observability/PlatformDRTests';
import PlatformChaosEngineering from '@/pages/platform/observability/PlatformChaosEngineering';
import ChaosLayout from '@/pages/platform/chaos/ChaosLayout';
import ChaosScenarios from '@/pages/platform/chaos/ChaosScenarios';
import ChaosExecutionLogs from '@/pages/platform/chaos/ChaosExecutionLogs';
import ChaosReports from '@/pages/platform/chaos/ChaosReports';
import PlatformBilling from '@/pages/platform/billing/PlatformBilling';
import PlatformRevenue from '@/pages/platform/billing/PlatformRevenue';
import PlatformCoupons from '@/pages/platform/billing/PlatformCoupons';
import BillingControlCenter from '@/pages/platform/billing/BillingControlCenter';
import PlatformEvents from '@/pages/platform/config/PlatformEvents';
import PlatformModulesCatalog from '@/pages/platform/tenants/PlatformModulesCatalog';
import PlatformRevenueIntelligence from '@/pages/platform/billing/PlatformRevenueIntelligence';
import PlatformReferrals from '@/pages/platform/comms/PlatformReferrals';
import PlatformGamification from '@/pages/platform/config/PlatformGamification';
import PlatformGrowthAI from '@/pages/platform/ai/PlatformGrowthAI';
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
import LandingHomeEditor from '@/pages/platform/landing/LandingHomeEditor';
import PlatformVersioning from '@/pages/platform/config/PlatformVersioning';
import PlatformNavigationRefactor from '@/pages/platform/governance/PlatformNavigationRefactor';
import PlatformSaasSettings from '@/pages/platform/config/PlatformSaasSettings';
import PlatformFooterDefaults from '@/pages/platform/config/PlatformFooterDefaults';
import PlatformApiManagement from '@/pages/platform/integrations/PlatformApiManagement';
import PlatformDevelopers from '@/pages/platform/infra/PlatformDevelopers';
import PlatformMarketplace from '@/pages/platform/integrations/PlatformMarketplace';
import PlatformAppsReview from '@/pages/platform/integrations/PlatformAppsReview';
import PlatformIntegrationAutomation from '@/pages/platform/integrations/PlatformIntegrationAutomation';
import PlatformAdsManagement from '@/pages/platform/comms/PlatformAdsManagement';
import PlatformAIOperations from '@/pages/platform/ai/PlatformAIOperations';
import PlatformSupportAnalytics from '@/pages/platform/comms/PlatformSupportAnalytics';
import PlatformWorkTime from '@/pages/platform/config/PlatformWorkTime';
import PlatformBiometrics from '@/pages/platform/config/PlatformBiometrics';
import PlatformBehaviorAI from '@/pages/platform/users/PlatformBehaviorAI';
import PlatformInspectionExport from '@/pages/platform/config/PlatformInspectionExport';
import PlatformLogs from '@/pages/platform/observability/PlatformLogs';
import DocumentSignatureIntegrations from '@/pages/platform/integrations/PlatformDocumentSignature';
import SettingsGamification from '@/pages/platform/config/PlatformSettingsGamification';
import PlatformIntegrationHealth from '@/pages/platform/integrations/PlatformIntegrationHealth';
import PlatformFederation from '@/pages/platform/federation/PlatformFederation';
import FederationIdentityProviders from '@/pages/platform/federation/FederationIdentityProviders';
import FederationSAMLConfig from '@/pages/platform/federation/FederationSAMLConfig';
import FederationOAuthClients from '@/pages/platform/federation/FederationOAuthClients';
import FederationTokenSettings from '@/pages/platform/federation/FederationTokenSettings';
import FederationAuditLogs from '@/pages/platform/federation/FederationAuditLogs';
import PlatformScim from '@/pages/platform/security/PlatformScim';
import ArchitectureLayout from '@/pages/platform/architecture/ArchitectureLayout';
import ArchitectureSaasCore from '@/pages/platform/architecture/ArchitectureSaasCore';
import ArchitectureTenantModules from '@/pages/platform/architecture/ArchitectureTenantModules';
import DependencyGraphVisualizer from '@/pages/platform/architecture/DependencyGraphVisualizer';
import ModuleHealthMonitor from '@/pages/platform/architecture/ModuleHealthMonitor';
import DocumentationManager from '@/pages/platform/architecture/DocumentationManager';
import ArchitectureDashboard from '@/pages/platform/architecture/ArchitectureDashboard';
import ArchitectureRiskDashboard from '@/pages/platform/architecture/ArchitectureRiskDashboard';
import SystemAtlasLayout from '@/pages/platform/atlas/SystemAtlasLayout';
import AtlasModuleView from '@/pages/platform/atlas/AtlasModuleView';
import AtlasDatabaseExplorer from '@/pages/platform/atlas/AtlasDatabaseExplorer';
import AtlasRelationsGraph from '@/pages/platform/atlas/AtlasRelationsGraph';
import AtlasImpactAnalysis from '@/pages/platform/atlas/AtlasImpactAnalysis';
import AtlasSearch from '@/pages/platform/atlas/AtlasSearch';

const IncidentManagementDashboard = lazy(() => import('@/modules/incident-management/ui/IncidentManagementDashboard'));
const GovernancePolicies = lazy(() => import('@/pages/platform/governance/GovernancePolicies'));
const GovernanceEnforcement = lazy(() => import('@/pages/platform/governance/GovernanceEnforcement'));
const GovernanceAppeals = lazy(() => import('@/pages/platform/governance/GovernanceAppeals'));

const PlatformSupportConsole = lazy(() => import('@/modules/support/ui/PlatformSupportConsole'));

const SuspenseFallback = <div className="p-8 text-muted-foreground">Carregando...</div>;

// ── Role groups ──────────────────────────────────────────────────────────────
const opsAdmin: PlatformRoleType[] = ['platform_super_admin', 'platform_operations'];
const securityAdmin: PlatformRoleType[] = ['platform_super_admin', 'platform_operations', 'platform_support_manager'];
const financeAdmin: PlatformRoleType[] = ['platform_super_admin', 'platform_operations', 'platform_finance', 'platform_fiscal'];
const marketingRoles: PlatformRoleType[] = ['platform_super_admin', 'platform_operations', 'platform_marketing', 'platform_marketing_director', 'platform_marketing_team'];
const supportRoles: PlatformRoleType[] = ['platform_super_admin', 'platform_operations', 'platform_support', 'platform_support_agent', 'platform_support_manager', 'platform_support_coordinator'];
const marketplaceAdmin: PlatformRoleType[] = ['platform_super_admin', 'platform_operations', 'platform_marketplace_admin'];
const architectureAdmin: PlatformRoleType[] = ['platform_super_admin', 'platform_operations', 'platform_architect'];

/**
 * Creates a parent route that applies a shared PlatformGuard for all children.
 * Children render inside an <Outlet /> so a section-level layout can be added later.
 */
function sectionGuard(path: string, roles: PlatformRoleType[], children: RouteObject[]): RouteObject {
  return {
    path,
    element: <PlatformGuard allowedRoles={roles}><Outlet /></PlatformGuard>,
    children,
  };
}

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
      // Dashboard — accessible to any platform user
      { path: 'dashboard', element: <PlatformDashboard /> },

      // ── Security section ── (shared securityAdmin guard)
      sectionGuard('security', securityAdmin, [
        { index: true, element: <Navigate to="/platform/security/dashboard" replace /> },
        { path: 'dashboard', element: <PlatformSecurityDashboard /> },
        { path: 'roles', element: <PlatformSecurityRoles /> },
        { path: 'permissions', element: <PlatformSecurityPermissions /> },
        { path: 'access-graph', element: <PlatformSecurityAccessGraph /> },
        { path: 'unified-graph', element: <PlatformUnifiedGraph /> },
        // Governance sub-routes require opsAdmin — nested guard
        { path: 'governance', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformGovernance /></PlatformGuard> },
        { path: 'governance-ai', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformGovernanceAI /></PlatformGuard> },
        // Federation sub-routes
        { path: 'federation', element: <PlatformFederation /> },
        { path: 'federation/identity-providers', element: <FederationIdentityProviders /> },
        { path: 'federation/saml-config', element: <FederationSAMLConfig /> },
        { path: 'federation/oauth-clients', element: <FederationOAuthClients /> },
        { path: 'federation/token-settings', element: <FederationTokenSettings /> },
        { path: 'federation/audit-logs', element: <FederationAuditLogs /> },
        // SCIM sub-routes
        { path: 'scim', element: <PlatformScim /> },
      ]),

      // ── Users section ── (shared securityAdmin guard)
      sectionGuard('users', securityAdmin, [
        { index: true, element: <PlatformUsers /> },
        { path: 'dashboard', element: <PlatformUsersDashboard /> },
      ]),

      // ── Billing / Revenue section ── (shared financeAdmin guard)
      sectionGuard('billing', financeAdmin, [
        { index: true, element: <PlatformBilling /> },
        { path: 'coupons', element: <PlatformCoupons /> },
        { path: 'control-center', element: <BillingControlCenter /> },
      ]),
      sectionGuard('revenue', financeAdmin, [
        { index: true, element: <PlatformRevenue /> },
        { path: 'intelligence', element: <PlatformRevenueIntelligence /> },
      ]),

      // ── Growth / Website ── (shared marketingRoles guard)
      sectionGuard('growth', marketingRoles, [
        { index: true, element: <PlatformGrowthAI /> },
        { path: 'insights', element: <GrowthInsights /> },
        { path: 'landing-pages', element: <GrowthLandingPages /> },
        { path: 'conversions', element: <GrowthConversions /> },
        { path: 'fab-builder', element: <GrowthFABBuilder /> },
        { path: 'template-engine', element: <GrowthTemplateEngine /> },
        { path: 'version-publish', element: <GrowthVersionPublish /> },
        { path: 'submissions', element: <GrowthSubmissions /> },
        { path: 'approvals', element: <GrowthApprovals /> },
      ]),
      sectionGuard('website', marketingRoles, [
        { index: true, element: <GrowthWebsiteDashboard /> },
        { path: 'ai-designer', element: <GrowthAIDesigner /> },
        // Aliases — redirect to canonical growth/* paths
        { path: 'templates', element: <Navigate to="/platform/growth/template-engine" replace /> },
        { path: 'versions', element: <Navigate to="/platform/growth/version-publish" replace /> },
      ]),

      // ── Marketing / Landing ── (shared marketingRoles guard)
      sectionGuard('marketing', marketingRoles, [
        { path: 'analytics', element: <MarketingAnalytics /> },
        { path: 'ads', element: <PlatformAdsManagement /> },
      ]),
      sectionGuard('landing', marketingRoles, [
        { path: 'home-editor', element: <LandingHomeEditor /> },
        { path: 'drafts', element: <LandingDrafts /> },
        { path: 'review', element: <LandingReview /> },
        { path: 'published', element: <LandingPublished /> },
      ]),

      // ── Support ── (shared supportRoles guard)
      sectionGuard('support', supportRoles, [
        { path: 'console', element: <Suspense fallback={SuspenseFallback}><PlatformSupportConsole /></Suspense> },
        { path: 'analytics', element: <PlatformSupportAnalytics /> },
      ]),

      // ── Structure ── (shared opsAdmin guard)
      sectionGuard('structure', opsAdmin, [
        { path: 'events', element: <PlatformEvents /> },
        { path: 'modules', element: <PlatformModulesCatalog /> },
        {
          path: 'architecture',
          element: <PlatformGuard allowedRoles={architectureAdmin}><ArchitectureLayout /></PlatformGuard>,
          children: [
            { index: true, element: <Navigate to="/platform/structure/architecture/dashboard" replace /> },
            { path: 'dashboard', element: <ArchitectureDashboard /> },
            { path: 'risk-analyzer', element: <ArchitectureRiskDashboard /> },
            { path: 'saas-core', element: <ArchitectureSaasCore /> },
            { path: 'tenant-modules', element: <ArchitectureTenantModules /> },
            { path: 'dependency-graph', element: <DependencyGraphVisualizer /> },
            { path: 'health-monitor', element: <ModuleHealthMonitor /> },
            { path: 'documentation', element: <DocumentationManager /> },
          ],
        },
        {
          path: 'atlas',
          element: <PlatformGuard allowedRoles={architectureAdmin}><SystemAtlasLayout /></PlatformGuard>,
          children: [
            { index: true, element: <Navigate to="/platform/structure/atlas/modules" replace /> },
            { path: 'modules', element: <AtlasModuleView /> },
            { path: 'database', element: <AtlasDatabaseExplorer /> },
            { path: 'relations', element: <AtlasRelationsGraph /> },
            { path: 'impact', element: <AtlasImpactAnalysis /> },
            { path: 'search', element: <AtlasSearch /> },
          ],
        },
      ]),

      // ── Settings ── (shared opsAdmin guard)
      sectionGuard('settings', opsAdmin, [
        { path: 'versioning', element: <PlatformVersioning /> },
        { path: 'saas', element: <PlatformSaasSettings /> },
        { path: 'gamification', element: <SettingsGamification /> },
        { path: 'footer', element: <PlatformGuard allowedRoles={['platform_super_admin']}><PlatformFooterDefaults /></PlatformGuard> },
      ]),

      // ── Navigation Refactor ──
      sectionGuard('navigation', opsAdmin, [
        { path: 'refactor', element: <PlatformNavigationRefactor /> },
      ]),

      // ── Standalone guarded routes ──
      { path: 'tenants', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformTenants /></PlatformGuard> },
      { path: 'tenants/:tenantId/branding', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformTenantBranding /></PlatformGuard> },
      { path: 'modules', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformModules /></PlatformGuard> },
      { path: 'plans', element: <PlatformGuard allowedRoles={financeAdmin}><PlatformPlans /></PlatformGuard> },
      { path: 'logs', element: <PlatformGuard allowedRoles={['platform_super_admin']}><PlatformLogs /></PlatformGuard> },
      { path: 'communications', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformCommunications /></PlatformGuard> },
      // ── Governance Control Plane ──
      sectionGuard('governance', opsAdmin, [
        { index: true, element: <PlatformGovernanceDashboard /> },
        { path: 'policies', element: <Suspense fallback={SuspenseFallback}><GovernancePolicies /></Suspense> },
        { path: 'enforcement', element: <Suspense fallback={SuspenseFallback}><GovernanceEnforcement /></Suspense> },
        { path: 'appeals', element: <Suspense fallback={SuspenseFallback}><GovernanceAppeals /></Suspense> },
      ]),
      { path: 'automation', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformAutomation /></PlatformGuard> },
      { path: 'integration-automation/*', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformIntegrationAutomation /></PlatformGuard> },
      { path: 'observability', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformObservability /></PlatformGuard> },
      { path: 'monitoring/*', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformMonitoring /></PlatformGuard> },
      { path: 'monitoring/user-activity', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformUserActivityIntelligence /></PlatformGuard> },
      { path: 'monitoring/security-center', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformSecurityCenter /></PlatformGuard> },
      { path: 'control-plane', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformControlPlane /></PlatformGuard> },
      { path: 'control-plane/dr-tests', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformDRTests /></PlatformGuard> },
      { path: 'chaos-engineering', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformChaosEngineering /></PlatformGuard> },
      {
        path: 'control-plane/chaos',
        element: <PlatformGuard allowedRoles={opsAdmin}><ChaosLayout /></PlatformGuard>,
        children: [
          { index: true, element: <ChaosScenarios /> },
          { path: 'executions', element: <ChaosExecutionLogs /> },
          { path: 'reports', element: <ChaosReports /> },
        ],
      },
      { path: 'iam', element: <PlatformGuard allowedRoles={securityAdmin}><PlatformIAM /></PlatformGuard> },
      { path: 'referrals', element: <PlatformGuard allowedRoles={marketingRoles}><PlatformReferrals /></PlatformGuard> },
      { path: 'gamification', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformGamification /></PlatformGuard> },
      // ── APIs / Developers / Marketplace ──
      { path: 'apis/*', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformApiManagement /></PlatformGuard> },
      { path: 'developers', element: <PlatformGuard allowedRoles={marketplaceAdmin}><PlatformDevelopers /></PlatformGuard> },
      { path: 'marketplace', element: <PlatformGuard allowedRoles={marketplaceAdmin}><PlatformMarketplace /></PlatformGuard> },
      { path: 'apps-review', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformAppsReview /></PlatformGuard> },
      { path: 'ai-operations', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformAIOperations /></PlatformGuard> },
      { path: 'document-signature', element: <PlatformGuard allowedRoles={opsAdmin}><DocumentSignatureIntegrations /></PlatformGuard> },
      { path: 'integration-health', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformIntegrationHealth /></PlatformGuard> },
      { path: 'incidents/*', element: <PlatformGuard allowedRoles={opsAdmin}><Suspense fallback={SuspenseFallback}><IncidentManagementDashboard /></Suspense></PlatformGuard> },
      { path: 'worktime', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformWorkTime /></PlatformGuard> },
      { path: 'worktime/biometrics', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformBiometrics /></PlatformGuard> },
      { path: 'worktime/behavior-ai', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformBehaviorAI /></PlatformGuard> },
      { path: 'worktime/inspection', element: <PlatformGuard allowedRoles={opsAdmin}><PlatformInspectionExport /></PlatformGuard> },
    ],
  },
];
