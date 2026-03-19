/**
 * Tenant Routes — RouteObject[] for authenticated tenant paths.
 */
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/domains/security';
import type { NavKey } from '@/domains/security/permissions';
import { AppLayout } from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import TalentHub from '@/pages/TalentHub';
import Employees from '@/pages/Employees';
import EmployeeDetail from '@/pages/EmployeeDetail';
import Companies from '@/pages/Companies';
import CompanyGroups from '@/pages/CompanyGroups';
import Positions from '@/pages/hr/Positions';
import Compensation from '@/pages/hr/Compensation';
import Departments from '@/pages/hr/Departments';
import Compliance from '@/pages/compliance/Compliance';
import Benefits from '@/pages/hr/Benefits';
import Health from '@/pages/hr/Health';
import LaborDashboard from '@/pages/compliance/LaborDashboard';
import LaborCompliance from '@/pages/compliance/LaborCompliance';
import LaborRules from '@/pages/compliance/LaborRules';
import LegalDashboard from '@/pages/compliance/LegalDashboard';
import RegulatoryDashboard from '@/pages/compliance/RegulatoryDashboard';
import Audit from '@/pages/Audit';
import PayrollSimulation from '@/pages/hr/PayrollSimulation';
import Notifications from '@/pages/Notifications';
import WorkforceIntelligence from '@/pages/WorkforceIntelligence';
import StrategicIntelligence from '@/pages/StrategicIntelligence';
import ESocialDashboard from '@/pages/compliance/ESocialDashboard';
import AgreementManagement from '@/pages/AgreementManagement';
import TenantCommunicationCenter from '@/pages/TenantCommunicationCenter';
import TenantAnnouncements from '@/pages/TenantAnnouncements';
import OccupationalCompliance from '@/pages/compliance/OccupationalCompliance';
import NrComplianceDashboard from '@/pages/compliance/NrComplianceDashboard';
import SafetyAutomation from '@/pages/compliance/SafetyAutomation';
import LegalIntelligenceDashboard from '@/pages/compliance/LegalIntelligenceDashboard';
import AgreementComplianceDashboard from '@/pages/compliance/AgreementComplianceDashboard';
import EsocialGovernanceDashboard from '@/pages/compliance/EsocialGovernanceDashboard';
import FleetDashboard from '@/pages/fleet/FleetDashboard';
import FleetLiveView from '@/pages/fleet/FleetLiveView';
import FleetAnalyticsView from '@/pages/fleet/FleetAnalyticsView';
import FleetEmployeeBehaviorProfile from '@/pages/fleet/FleetEmployeeBehaviorProfile';
import LiveDisplayAdmin from '@/pages/LiveDisplayAdmin';
import OperationalCommandCenter from '@/pages/OperationalCommandCenter';
import DocumentValidationDashboard from '@/pages/DocumentValidationDashboard';
import EpiCatalog from '@/pages/epi/EpiCatalog';
import EpiDelivery from '@/pages/epi/EpiDelivery';
import EpiDashboard from '@/pages/epi/EpiDashboard';
import EpiAuditLog from '@/pages/epi/EpiAuditLog';
import PccsDashboard from '@/pages/PccsDashboard';
import PccsWizard from '@/pages/PccsWizard';
import SettingsUsers from '@/pages/SettingsUsers';
import SettingsRoles from '@/pages/SettingsRoles';
import WebhookSettings from '@/pages/WebhookSettings';
import TenantPlansPage from '@/pages/TenantPlansPage';
import TenantAppsIntegrations from '@/pages/TenantAppsIntegrations';
import TenantDocumentSignatureIntegration from '@/pages/TenantDocumentSignatureIntegration';
import TelegramIntegration from '@/pages/TelegramIntegration';
import TenantTraccarSettings from '@/modules/traccar/ui/TenantTraccarSettings';
import CpfIntegrationSettings from '@/pages/CpfIntegrationSettings';
import ReferralPage from '@/pages/ReferralPage';
import TenantEngagement from '@/pages/TenantEngagement';
import FleetPolicies from '@/pages/fleet/FleetPolicies';
import SupportNewTicket from '@/pages/support/SupportNewTicket';
import SupportTickets from '@/pages/support/SupportTickets';
import SupportWiki from '@/pages/support/SupportWiki';
import SupportLiveChat from '@/pages/support/SupportLiveChat';
import OffboardingDashboard from '@/pages/OffboardingDashboard';
import TerminatedEmployees from '@/pages/TerminatedEmployees';
import ReferenceLetters from '@/pages/ReferenceLetters';
import TimeTrackingPage from '@/pages/TimeTrackingPage';
import TerminationSimulatorPage from '@/pages/TerminationSimulatorPage';
import PdfLayoutSettings from '@/pages/PdfLayoutSettings';
import TenantPersonalization from '@/pages/settings/TenantPersonalization';
import ESocialSettings from '@/pages/settings/ESocialSettings';
import BrasilApiSettings from '@/pages/settings/BrasilApiSettings';
import LgpdCompliance from '@/pages/compliance/LgpdCompliance';
import ExecutiveDashboard from '@/pages/ExecutiveDashboard';
import EmployeeLiveDashboard from '@/pages/EmployeeLiveDashboard';
import SsoSettings from '@/pages/SsoSettings';
import ScimSettings from '@/pages/ScimSettings';
import MySessionsPage from '@/pages/tenant/MySessionsPage';

const TenantOnboarding = lazy(() => import('@/pages/TenantOnboarding'));
const SuspenseFallback = <div className="p-8 text-muted-foreground">Carregando...</div>;

function pr(navKey: NavKey, element: React.ReactNode) {
  return <ProtectedRoute navKey={navKey}>{element}</ProtectedRoute>;
}

export const tenantRoutes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: pr('dashboard', <Dashboard />) },
      { path: '/onboarding', element: <Suspense fallback={SuspenseFallback}><TenantOnboarding /></Suspense> },
      { path: '/employees', element: pr('employees', <Employees />) },
      { path: '/employees/:id', element: pr('employees', <EmployeeDetail />) },
      { path: '/employees/:id/live', element: pr('employees', <EmployeeLiveDashboard />) },
      { path: '/offboarding', element: pr('employees', <OffboardingDashboard />) },
      { path: '/terminated-employees', element: pr('employees', <TerminatedEmployees />) },
      { path: '/reference-letters', element: pr('employees', <ReferenceLetters />) },
      { path: '/termination-simulator', element: pr('employees', <TerminationSimulatorPage />) },
      { path: '/time-tracking', element: pr('employees', <TimeTrackingPage />) },
      { path: '/lgpd', element: pr('compliance', <LgpdCompliance />) },
      { path: '/companies', element: pr('companies', <Companies />) },
      { path: '/groups', element: pr('groups', <CompanyGroups />) },
      { path: '/positions', element: pr('positions', <Positions />) },
      { path: '/compensation', element: pr('compensation', <Compensation />) },
      { path: '/departments', element: pr('departments', <Departments />) },
      { path: '/compliance', element: pr('compliance', <Compliance />) },
      { path: '/benefits', element: pr('benefits', <Benefits />) },
      { path: '/health', element: pr('health', <Health />) },
      { path: '/labor-dashboard', element: pr('labor_dashboard', <LaborDashboard />) },
      { path: '/labor-compliance', element: pr('labor_compliance', <LaborCompliance />) },
      { path: '/labor-rules', element: pr('labor_rules', <LaborRules />) },
      { path: '/legal-dashboard', element: pr('legal_dashboard', <LegalDashboard />) },
      { path: '/regulatory-dashboard', element: pr('legal_dashboard', <RegulatoryDashboard />) },
      { path: '/legal-intelligence', element: pr('legal_dashboard', <LegalIntelligenceDashboard />) },
      { path: '/agreement-compliance', element: pr('legal_dashboard', <AgreementComplianceDashboard />) },
      { path: '/esocial', element: pr('esocial', <ESocialDashboard />) },
      { path: '/esocial-governance', element: pr('esocial', <EsocialGovernanceDashboard />) },
      { path: '/payroll-simulation', element: pr('payroll', <PayrollSimulation />) },
      { path: '/workforce-intelligence', element: pr('intelligence', <WorkforceIntelligence />) },
      { path: '/strategic-intelligence', element: pr('intelligence', <StrategicIntelligence />) },
      { path: '/executive-dashboard', element: pr('intelligence', <ExecutiveDashboard />) },
      { path: '/talent-hub', element: pr('intelligence', <TalentHub />) },
      { path: '/occupational-compliance', element: pr('health', <OccupationalCompliance />) },
      { path: '/nr-compliance', element: pr('health', <NrComplianceDashboard />) },
      { path: '/safety-automation', element: pr('health', <SafetyAutomation />) },
      { path: '/epi-catalog', element: pr('health', <EpiCatalog />) },
      { path: '/epi-delivery', element: pr('health', <EpiDelivery />) },
      { path: '/epi-dashboard', element: pr('health', <EpiDashboard />) },
      { path: '/epi-audit', element: pr('health', <EpiAuditLog />) },
      { path: '/pccs-dashboard', element: pr('positions', <PccsDashboard />) },
      { path: '/pccs-wizard', element: pr('positions', <PccsWizard />) },
      { path: '/fleet-dashboard', element: pr('fleet', <FleetDashboard />) },
      { path: '/fleet-live', element: pr('fleet', <FleetLiveView />) },
      { path: '/fleet-analytics', element: pr('fleet', <FleetAnalyticsView />) },
      { path: '/fleet-behavior-profile', element: pr('fleet', <FleetEmployeeBehaviorProfile />) },
      { path: '/live-display', element: pr('live_display', <LiveDisplayAdmin />) },
      { path: '/command-center', element: pr('operations', <OperationalCommandCenter />) },
      { path: '/agreements', element: pr('employees', <AgreementManagement />) },
      { path: '/document-validation', element: pr('audit', <DocumentValidationDashboard />) },
      { path: '/communication-center', element: pr('dashboard', <TenantCommunicationCenter />) },
      { path: '/announcements', element: pr('dashboard', <TenantAnnouncements />) },
      { path: '/apps', element: pr('iam_users', <TenantAppsIntegrations />) },
      { path: '/integrations/telegram', element: <ProtectedRoute navKey="integrations" moduleKey="telegram"><TelegramIntegration /></ProtectedRoute> },
      { path: '/integrations/traccar', element: <ProtectedRoute navKey="integrations" moduleKey="fleet"><TenantTraccarSettings /></ProtectedRoute> },
      { path: '/integrations/document-signature', element: <ProtectedRoute navKey="integrations" moduleKey="agreements"><TenantDocumentSignatureIntegration /></ProtectedRoute> },
      { path: '/integrations/cpf', element: <ProtectedRoute navKey="integrations" moduleKey="cpf_lookup_cpfhub"><CpfIntegrationSettings /></ProtectedRoute> },
      { path: '/fleet-policies', element: pr('fleet', <FleetPolicies />) },
      { path: '/plans', element: pr('iam_users', <TenantPlansPage />) },
      { path: '/notifications', element: pr('dashboard', <Notifications />) },
      { path: '/audit', element: pr('audit', <Audit />) },
      { path: '/settings/personalization', element: pr('iam_users', <TenantPersonalization />) },
      { path: '/settings/pdf-layout', element: pr('iam_users', <PdfLayoutSettings />) },
      { path: '/settings/esocial', element: pr('esocial', <ESocialSettings />) },
      { path: '/settings/brasilapi', element: pr('iam_users', <BrasilApiSettings />) },
      { path: '/iam', element: <Navigate to="/settings/users" replace /> },
      { path: '/settings/users', element: pr('iam_users', <SettingsUsers />) },
      { path: '/settings/roles', element: pr('iam_roles', <SettingsRoles />) },
      { path: '/settings/webhooks', element: pr('iam_users', <WebhookSettings />) },
      { path: '/settings/sso', element: pr('iam_users', <SsoSettings />) },
      { path: '/settings/scim', element: pr('iam_users', <ScimSettings />) },
      { path: '/settings/sessions', element: <MySessionsPage /> },
      { path: '/referral', element: pr('referral', <ReferralPage />) },
      { path: '/engajamento', element: pr('referral', <TenantEngagement />) },
      { path: '/support/chat', element: pr('support', <SupportLiveChat />) },
      { path: '/support/new', element: pr('support', <SupportNewTicket />) },
      { path: '/support/tickets', element: pr('support', <SupportTickets />) },
      { path: '/support/wiki', element: pr('support', <SupportWiki />) },
    ],
  },
];