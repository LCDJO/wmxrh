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
import AgreementComplianceDashboard from '@/pages/AgreementComplianceDashboard';
import EsocialGovernanceDashboard from '@/pages/EsocialGovernanceDashboard';
import FleetDashboard from '@/pages/FleetDashboard';
import FleetLiveView from '@/pages/FleetLiveView';
import FleetAnalyticsView from '@/pages/FleetAnalyticsView';
import FleetEmployeeBehaviorProfile from '@/pages/FleetEmployeeBehaviorProfile';
import LiveDisplayAdmin from '@/pages/LiveDisplayAdmin';
import OperationalCommandCenter from '@/pages/OperationalCommandCenter';
import DocumentValidationDashboard from '@/pages/DocumentValidationDashboard';
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
import TenantDocumentSignatureIntegration from '@/pages/TenantDocumentSignatureIntegration';
import TelegramIntegration from '@/pages/TelegramIntegration';
import TenantTraccarSettings from '@/modules/traccar/ui/TenantTraccarSettings';
import CpfIntegrationSettings from '@/pages/CpfIntegrationSettings';
import ReferralPage from '@/pages/ReferralPage';
...
      { path: '/apps', element: pr('iam_users', <TenantAppsIntegrations />) },
      { path: '/integrations/telegram', element: pr('integrations', <TelegramIntegration />) },
      { path: '/integrations/traccar', element: pr('integrations', <TenantTraccarSettings />) },
      { path: '/integrations/document-signature', element: pr('integrations', <TenantDocumentSignatureIntegration />) },
      { path: '/integrations/cpf', element: pr('integrations', <CpfIntegrationSettings />) },
      { path: '/fleet-policies', element: pr('fleet', <FleetPolicies />) },
      { path: '/plans', element: pr('iam_users', <TenantPlansPage />) },
      { path: '/notifications', element: pr('dashboard', <Notifications />) },
      { path: '/audit', element: pr('audit', <Audit />) },
      // ── Settings ──
      { path: '/settings/personalization', element: pr('iam_users', <TenantPersonalization />) },
      { path: '/settings/pdf-layout', element: pr('iam_users', <PdfLayoutSettings />) },
      // Legacy redirect — /iam is referenced by notification-event-listener, onboarding-experience-bridge, and experience-orchestrator
      { path: '/iam', element: <Navigate to="/settings/users" replace /> },
      { path: '/settings/users', element: pr('iam_users', <SettingsUsers />) },
      { path: '/settings/roles', element: pr('iam_roles', <SettingsRoles />) },
      { path: '/settings/webhooks', element: pr('iam_users', <WebhookSettings />) },
      
      { path: '/settings/sso', element: pr('iam_users', <SsoSettings />) },
      { path: '/settings/scim', element: pr('iam_users', <ScimSettings />) },
      { path: '/settings/sessions', element: <MySessionsPage /> },
      // ── Referral & Engajamento ──
      { path: '/referral', element: pr('referral', <ReferralPage />) },
      { path: '/engajamento', element: pr('referral', <TenantEngagement />) },
      // ── Support ──
      { path: '/support/chat', element: pr('support', <SupportLiveChat />) },
      { path: '/support/new', element: pr('support', <SupportNewTicket />) },
      { path: '/support/tickets', element: pr('support', <SupportTickets />) },
      { path: '/support/wiki', element: pr('support', <SupportWiki />) },
    ],
  },
];
