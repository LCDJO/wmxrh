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
import Employees from '@/pages/Employees';
import EmployeeDetail from '@/pages/EmployeeDetail';
import Companies from '@/pages/Companies';
import CompanyGroups from '@/pages/CompanyGroups';
import Positions from '@/pages/Positions';
import Compensation from '@/pages/Compensation';
import Departments from '@/pages/Departments';
import Compliance from '@/pages/Compliance';
import Benefits from '@/pages/Benefits';
import Health from '@/pages/Health';
import LaborDashboard from '@/pages/LaborDashboard';
import LaborCompliance from '@/pages/LaborCompliance';
import LaborRules from '@/pages/LaborRules';
import LegalDashboard from '@/pages/LegalDashboard';
import RegulatoryDashboard from '@/pages/RegulatoryDashboard';
import Audit from '@/pages/Audit';
import PayrollSimulation from '@/pages/PayrollSimulation';
import Notifications from '@/pages/Notifications';
import WorkforceIntelligence from '@/pages/WorkforceIntelligence';
import StrategicIntelligence from '@/pages/StrategicIntelligence';
import ESocialDashboard from '@/pages/ESocialDashboard';
import AgreementManagement from '@/pages/AgreementManagement';
import TenantCommunicationCenter from '@/pages/TenantCommunicationCenter';
import TenantAnnouncements from '@/pages/TenantAnnouncements';
import OccupationalCompliance from '@/pages/OccupationalCompliance';
import NrComplianceDashboard from '@/pages/NrComplianceDashboard';
import SafetyAutomation from '@/pages/SafetyAutomation';
import LegalIntelligenceDashboard from '@/pages/LegalIntelligenceDashboard';
import EsocialGovernanceDashboard from '@/pages/EsocialGovernanceDashboard';
import FleetDashboard from '@/pages/FleetDashboard';
import LiveDisplayAdmin from '@/pages/LiveDisplayAdmin';
import OperationalCommandCenter from '@/pages/OperationalCommandCenter';
import EpiCatalog from '@/pages/EpiCatalog';
import EpiDelivery from '@/pages/EpiDelivery';
import EpiDashboard from '@/pages/EpiDashboard';
import EpiAuditLog from '@/pages/EpiAuditLog';
import PccsDashboard from '@/pages/PccsDashboard';
import PccsWizard from '@/pages/PccsWizard';
import SettingsUsers from '@/pages/SettingsUsers';
import SettingsRoles from '@/pages/SettingsRoles';
import WebhookSettings from '@/pages/WebhookSettings';
import TenantPlansPage from '@/pages/TenantPlansPage';
import TenantAppsIntegrations from '@/pages/TenantAppsIntegrations';
import ReferralPage from '@/pages/ReferralPage';
import SupportNewTicket from '@/pages/support/SupportNewTicket';
import SupportTickets from '@/pages/support/SupportTickets';
import SupportWiki from '@/pages/support/SupportWiki';
import SupportLiveChat from '@/pages/support/SupportLiveChat';

const TenantOnboarding = lazy(() => import('@/pages/TenantOnboarding'));
const SuspenseFallback = <div className="p-8 text-muted-foreground">Carregando...</div>;

/** Helper to wrap with ProtectedRoute */
function pr(navKey: NavKey, element: React.ReactNode) {
  return <ProtectedRoute navKey={navKey}>{element}</ProtectedRoute>;
}

export const tenantRoutes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: pr('dashboard', <Dashboard />) },
      { path: '/onboarding', element: <Suspense fallback={SuspenseFallback}><TenantOnboarding /></Suspense> },
      // ── People ──
      { path: '/employees', element: pr('employees', <Employees />) },
      { path: '/employees/:id', element: pr('employees', <EmployeeDetail />) },
      { path: '/companies', element: pr('companies', <Companies />) },
      { path: '/groups', element: pr('groups', <CompanyGroups />) },
      { path: '/positions', element: pr('positions', <Positions />) },
      { path: '/compensation', element: pr('compensation', <Compensation />) },
      { path: '/departments', element: pr('departments', <Departments />) },
      // ── Compliance & Benefits ──
      { path: '/compliance', element: pr('compliance', <Compliance />) },
      { path: '/benefits', element: pr('benefits', <Benefits />) },
      { path: '/health', element: pr('health', <Health />) },
      // ── Labor ──
      { path: '/labor-dashboard', element: pr('labor_dashboard', <LaborDashboard />) },
      { path: '/labor-compliance', element: pr('labor_compliance', <LaborCompliance />) },
      { path: '/labor-rules', element: pr('labor_rules', <LaborRules />) },
      // ── Legal ──
      { path: '/legal-dashboard', element: pr('legal_dashboard', <LegalDashboard />) },
      { path: '/regulatory-dashboard', element: pr('legal_dashboard', <RegulatoryDashboard />) },
      { path: '/legal-intelligence', element: pr('legal_dashboard', <LegalIntelligenceDashboard />) },
      // ── eSocial ──
      { path: '/esocial', element: pr('esocial', <ESocialDashboard />) },
      { path: '/esocial-governance', element: pr('esocial', <EsocialGovernanceDashboard />) },
      // ── Payroll / Intelligence ──
      { path: '/payroll-simulation', element: pr('compensation', <PayrollSimulation />) },
      { path: '/workforce-intelligence', element: pr('dashboard', <WorkforceIntelligence />) },
      { path: '/strategic-intelligence', element: pr('dashboard', <StrategicIntelligence />) },
      // ── Occupational Safety ──
      { path: '/occupational-compliance', element: pr('health', <OccupationalCompliance />) },
      { path: '/nr-compliance', element: pr('health', <NrComplianceDashboard />) },
      { path: '/safety-automation', element: pr('health', <SafetyAutomation />) },
      // ── EPI ──
      { path: '/epi-catalog', element: pr('health', <EpiCatalog />) },
      { path: '/epi-delivery', element: pr('health', <EpiDelivery />) },
      { path: '/epi-dashboard', element: pr('health', <EpiDashboard />) },
      { path: '/epi-audit', element: pr('health', <EpiAuditLog />) },
      // ── PCCS ──
      { path: '/pccs-dashboard', element: pr('positions', <PccsDashboard />) },
      { path: '/pccs-wizard', element: pr('positions', <PccsWizard />) },
      // ── Fleet ──
      { path: '/fleet-dashboard', element: pr('dashboard', <FleetDashboard />) },
      // ── Live Display ──
      { path: '/live-display', element: pr('dashboard', <LiveDisplayAdmin />) },
      { path: '/command-center', element: pr('dashboard', <OperationalCommandCenter />) },
      // ── Agreements / Communication ──
      { path: '/agreements', element: pr('employees', <AgreementManagement />) },
      { path: '/communication-center', element: <TenantCommunicationCenter /> },
      { path: '/announcements', element: <TenantAnnouncements /> },
      // ── Apps / Plans / Notifications ──
      { path: '/apps', element: <TenantAppsIntegrations /> },
      { path: '/plans', element: <TenantPlansPage /> },
      { path: '/notifications', element: <Notifications /> },
      { path: '/audit', element: pr('audit', <Audit />) },
      // ── Settings ──
      { path: '/iam', element: <Navigate to="/settings/users" replace /> },
      { path: '/settings/users', element: pr('iam_users', <SettingsUsers />) },
      { path: '/settings/roles', element: pr('iam_roles', <SettingsRoles />) },
      { path: '/settings/webhooks', element: pr('iam_users', <WebhookSettings />) },
      // ── Referral ──
      { path: '/referral', element: pr('dashboard', <ReferralPage />) },
      // ── Support ──
      { path: '/support/chat', element: pr('support', <SupportLiveChat />) },
      { path: '/support/new', element: pr('support', <SupportNewTicket />) },
      { path: '/support/tickets', element: pr('support', <SupportTickets />) },
      { path: '/support/wiki', element: pr('support', <SupportWiki />) },
    ],
  },
];
