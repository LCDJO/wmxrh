/**
 * Module Definitions — Concrete module manifests for the platform.
 *
 * Each module declares its full contract: routes, widgets, permissions,
 * feature flags, and navigation entries.
 */

import type { ModuleManifest } from './module-loader';
import type { ModuleRegistration } from '../types';

// ════════════════════════════════════════════════════════════════
// Module Manifests
// ════════════════════════════════════════════════════════════════

export const CORE_HR_MANIFEST: ModuleManifest = {
  module_id: 'core_hr',
  module_name: 'RH Core',
  version: '1.0.0',
  routes: ['/hr', '/hr/employees', '/hr/departments', '/hr/positions', '/hr/org-chart'],
  widgets: [
    {
      widget_id: 'core_hr:headcount_kpi',
      label: 'Headcount',
      slot: 'dashboard',
      loadComponent: () => import('@/pages/Index').then(m => ({ default: m.default })),
      priority: 1,
    },
    {
      widget_id: 'core_hr:recent_hires',
      label: 'Admissões Recentes',
      slot: 'sidebar',
      loadComponent: () => import('@/pages/Index').then(m => ({ default: m.default })),
      priority: 2,
    },
  ],
  permissions: ['hr:read', 'hr:write', 'hr:admin', 'employees:read', 'employees:write', 'departments:manage'],
  feature_flags: ['ff_hr_org_chart', 'ff_hr_bulk_import', 'ff_hr_advanced_search'],
  navigation_entries: [
    { path: '/hr', label: 'RH Core', icon: 'Users', order: 1 },
    { path: '/hr/employees', label: 'Colaboradores', icon: 'Users', parent: '/hr', order: 1 },
    { path: '/hr/departments', label: 'Departamentos', icon: 'Building2', parent: '/hr', order: 2 },
    { path: '/hr/positions', label: 'Cargos', icon: 'Briefcase', parent: '/hr', order: 3 },
    { path: '/hr/org-chart', label: 'Organograma', icon: 'GitBranch', parent: '/hr', order: 4, required_permission: 'hr:read' },
  ],
  loadComponent: () => import('@/pages/Index').then(m => ({ default: m.default })),
  preload: 'idle',
};

export const COMPENSATION_ENGINE_MANIFEST: ModuleManifest = {
  module_id: 'compensation_engine',
  module_name: 'Motor de Remuneração',
  version: '1.0.0',
  routes: ['/compensation', '/compensation/salary-tables', '/compensation/simulations', '/compensation/history'],
  widgets: [
    {
      widget_id: 'compensation:payroll_summary',
      label: 'Resumo Folha',
      slot: 'dashboard',
      loadComponent: () => import('@/pages/Index').then(m => ({ default: m.default })),
      required_permission: 'compensation:read',
      priority: 3,
    },
  ],
  permissions: ['compensation:read', 'compensation:write', 'compensation:approve', 'salary_tables:manage'],
  feature_flags: ['ff_comp_simulations', 'ff_comp_mass_adjustment', 'ff_comp_audit_trail'],
  navigation_entries: [
    { path: '/compensation', label: 'Remuneração', icon: 'DollarSign', order: 2 },
    { path: '/compensation/salary-tables', label: 'Tabelas Salariais', icon: 'Table', parent: '/compensation', order: 1 },
    { path: '/compensation/simulations', label: 'Simulações', icon: 'Calculator', parent: '/compensation', order: 2 },
    { path: '/compensation/history', label: 'Histórico', icon: 'Clock', parent: '/compensation', order: 3 },
  ],
  loadComponent: () => import('@/pages/Index').then(m => ({ default: m.default })),
  preload: 'hover',
};

export const TENANT_ADMIN_MANIFEST: ModuleManifest = {
  module_id: 'tenant_admin',
  module_name: 'Administração do Tenant',
  version: '1.0.0',
  routes: ['/admin', '/admin/users', '/admin/roles', '/admin/settings', '/admin/audit-log', '/admin/modules'],
  widgets: [
    {
      widget_id: 'tenant_admin:active_users',
      label: 'Usuários Ativos',
      slot: 'dashboard',
      loadComponent: () => import('@/pages/Index').then(m => ({ default: m.default })),
      required_permission: 'admin:read',
      priority: 5,
    },
  ],
  permissions: ['admin:read', 'admin:write', 'admin:super', 'users:manage', 'roles:manage', 'modules:manage'],
  feature_flags: ['ff_admin_impersonation', 'ff_admin_sso', 'ff_admin_advanced_audit'],
  navigation_entries: [
    { path: '/admin', label: 'Administração', icon: 'Settings', order: 10 },
    { path: '/admin/users', label: 'Usuários', icon: 'Users', parent: '/admin', order: 1 },
    { path: '/admin/roles', label: 'Papéis', icon: 'Shield', parent: '/admin', order: 2 },
    { path: '/admin/modules', label: 'Módulos', icon: 'Puzzle', parent: '/admin', order: 3, required_permission: 'modules:manage' },
    { path: '/admin/audit-log', label: 'Audit Log', icon: 'FileText', parent: '/admin', order: 4 },
    { path: '/admin/settings', label: 'Configurações', icon: 'Sliders', parent: '/admin', order: 5 },
  ],
  loadComponent: () => import('@/pages/Index').then(m => ({ default: m.default })),
  preload: 'idle',
};

export const REPORTING_MANIFEST: ModuleManifest = {
  module_id: 'reporting',
  module_name: 'Relatórios & Analytics',
  version: '1.0.0',
  routes: ['/reports', '/reports/builder', '/reports/scheduled', '/reports/dashboards'],
  widgets: [
    {
      widget_id: 'reporting:quick_reports',
      label: 'Relatórios Rápidos',
      slot: 'sidebar',
      loadComponent: () => import('@/pages/Index').then(m => ({ default: m.default })),
      priority: 4,
    },
    {
      widget_id: 'reporting:kpi_strip',
      label: 'KPI Strip',
      slot: 'header',
      loadComponent: () => import('@/pages/Index').then(m => ({ default: m.default })),
      required_permission: 'reports:read',
      priority: 1,
    },
  ],
  permissions: ['reports:read', 'reports:write', 'reports:export', 'dashboards:manage'],
  feature_flags: ['ff_report_builder', 'ff_report_scheduling', 'ff_report_pdf_export'],
  navigation_entries: [
    { path: '/reports', label: 'Relatórios', icon: 'BarChart3', order: 5 },
    { path: '/reports/builder', label: 'Construtor', icon: 'PenTool', parent: '/reports', order: 1, required_permission: 'reports:write' },
    { path: '/reports/scheduled', label: 'Agendados', icon: 'Clock', parent: '/reports', order: 2 },
    { path: '/reports/dashboards', label: 'Dashboards', icon: 'LayoutDashboard', parent: '/reports', order: 3 },
  ],
  loadComponent: () => import('@/pages/Index').then(m => ({ default: m.default })),
  preload: 'hover',
};

// ════════════════════════════════════════════════════════════════
// Module Registrations (lifecycle descriptors)
// ════════════════════════════════════════════════════════════════

export const CORE_HR_REGISTRATION: ModuleRegistration = {
  key: 'core_hr',
  label: 'RH Core',
  version: '1.0.0',
  is_core: true,
  routes: CORE_HR_MANIFEST.routes,
  required_permissions: ['hr:read'],
  dependencies: [],
  cognitive_signals: ['headcount_anomaly', 'turnover_alert'],
};

export const COMPENSATION_REGISTRATION: ModuleRegistration = {
  key: 'compensation_engine',
  label: 'Motor de Remuneração',
  version: '1.0.0',
  is_core: false,
  lazy: true,
  routes: COMPENSATION_ENGINE_MANIFEST.routes,
  required_permissions: ['compensation:read'],
  dependencies: ['core_hr'],
  cognitive_signals: ['salary_drift', 'equity_gap'],
};

export const TENANT_ADMIN_REGISTRATION: ModuleRegistration = {
  key: 'tenant_admin',
  label: 'Administração do Tenant',
  version: '1.0.0',
  is_core: true,
  routes: TENANT_ADMIN_MANIFEST.routes,
  required_permissions: ['admin:read'],
  dependencies: [],
  cognitive_signals: ['security_alert', 'license_expiry'],
};

export const REPORTING_REGISTRATION: ModuleRegistration = {
  key: 'reporting',
  label: 'Relatórios & Analytics',
  version: '1.0.0',
  is_core: false,
  lazy: true,
  routes: REPORTING_MANIFEST.routes,
  required_permissions: ['reports:read'],
  dependencies: ['core_hr'],
  cognitive_signals: ['anomaly_detected', 'report_ready'],
};

// ════════════════════════════════════════════════════════════════
// All modules — convenience arrays
// ════════════════════════════════════════════════════════════════

export const ALL_MODULE_REGISTRATIONS: ModuleRegistration[] = [
  CORE_HR_REGISTRATION,
  COMPENSATION_REGISTRATION,
  TENANT_ADMIN_REGISTRATION,
  REPORTING_REGISTRATION,
];

export const ALL_MODULE_MANIFESTS: ModuleManifest[] = [
  CORE_HR_MANIFEST,
  COMPENSATION_ENGINE_MANIFEST,
  TENANT_ADMIN_MANIFEST,
  REPORTING_MANIFEST,
];

/** Map registration → manifest for bulk federation */
export const MODULE_FEDERATION_MAP: Array<{ registration: ModuleRegistration; manifest: ModuleManifest }> = [
  { registration: CORE_HR_REGISTRATION, manifest: CORE_HR_MANIFEST },
  { registration: COMPENSATION_REGISTRATION, manifest: COMPENSATION_ENGINE_MANIFEST },
  { registration: TENANT_ADMIN_REGISTRATION, manifest: TENANT_ADMIN_MANIFEST },
  { registration: REPORTING_REGISTRATION, manifest: REPORTING_MANIFEST },
];
