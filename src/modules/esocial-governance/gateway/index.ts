/**
 * eSocial Governance Module — Domain Gateway
 *
 * All data access goes through the sandbox gateway.
 * Direct Supabase/DB imports are FORBIDDEN in module code.
 */
import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export function createEsocialGovGateway(sandbox: SandboxContext) {
  const { gateway } = sandbox;

  return {
    // ── SuperAdmin (global) ──

    /** Platform-wide KPIs */
    getPlatformKPIs: () =>
      gateway.query('esocial_governance', 'platform_kpis'),

    /** All tenant overviews */
    getTenantOverviews: () =>
      gateway.query('esocial_governance', 'tenant_overviews'),

    /** System status (webservice, layout) */
    getSystemStatus: () =>
      gateway.query('esocial_governance', 'system_status'),

    /** Certificate monitoring scan */
    runCertificateMonitor: () =>
      gateway.query('esocial_governance', 'certificate_monitor'),

    /** Error insights (rejection analysis) */
    getErrorInsights: () =>
      gateway.query('esocial_governance', 'error_insights'),

    // ── Tenant-scoped ──

    /** Dashboard for a specific tenant */
    getTenantDashboard: (tenantId: string) =>
      gateway.query('esocial_governance', 'tenant_dashboard', { tenantId }),

    /** Tenant eSocial integration status */
    getTenantStatus: (tenantId: string) =>
      gateway.query('esocial_governance', 'tenant_status', { tenantId }),

    /** Company eSocial status within tenant */
    getCompanyStatus: (tenantId: string, companyId: string) =>
      gateway.query('esocial_governance', 'company_status', { tenantId, companyId }),

    // ── Alerts ──

    /** Active alerts (filtered by access level) */
    getActiveAlerts: () =>
      gateway.query('esocial_governance', 'active_alerts'),

    /** Generate a new alert */
    generateAlert: (alertData: Record<string, unknown>) =>
      gateway.mutate('esocial_governance', 'generate_alert', alertData),

    // ── Audit ──

    /** Fetch governance audit logs */
    getAuditLogs: (params?: Record<string, unknown>) =>
      gateway.query('esocial_governance_logs', 'list', params),

    /** Log a governance action */
    logAction: (data: Record<string, unknown>) =>
      gateway.mutate('esocial_governance_logs', 'create', data),

    // ── Layout ──

    /** Current and upcoming layout versions */
    getLayoutVersions: () =>
      gateway.query('esocial_governance', 'layout_versions'),

    /** Detect layout mismatch for a tenant */
    detectLayoutMismatch: (tenantId: string) =>
      gateway.query('esocial_governance', 'layout_mismatch', { tenantId }),

    // ── Subscriptions ──

    /** Subscribe to alert changes */
    onAlertChange: (handler: (data: unknown) => void) =>
      gateway.subscribe('esocial_governance', 'alert_change', handler),
  };
}
