/**
 * Security Middleware - Permission Matrix
 * 
 * Centralized permission definitions mapping:
 *   Action × Entity → Required Roles
 * 
 * This is the SINGLE SOURCE OF TRUTH for authorization.
 * Both frontend guards and backend RLS mirror these rules.
 */

import type { TenantRole } from '@/domains/shared/types';

// ========================
// ACTION TYPES
// ========================

export type PermissionAction = 'view' | 'create' | 'update' | 'delete';

export type PermissionEntity =
  | 'tenants'
  | 'company_groups'
  | 'companies'
  | 'departments'
  | 'positions'
  | 'employees'
  | 'salary_contracts'
  | 'salary_adjustments'
  | 'salary_additionals'
  | 'salary_history'
  | 'compensation'
  | 'audit_logs'
  | 'user_roles'
  | 'payroll_catalog'
  | 'benefit_plans'
  | 'employee_benefits'
  | 'health_programs'
  | 'health_exams'
  | 'labor_rules';

// ========================
// ROLE SETS (mirrors DB functions)
// ========================

/** Roles that can manage tenant-level settings (companies, groups) */
const TENANT_ADMINS: TenantRole[] = [
  'superadmin', 'owner', 'admin', 'tenant_admin',
];

/** Roles that can manage employees, departments, positions */
const EMPLOYEE_MANAGERS: TenantRole[] = [
  'superadmin', 'owner', 'admin', 'tenant_admin',
  'group_admin', 'company_admin', 'rh',
];

/** Roles that can manage compensation data */
const COMPENSATION_MANAGERS: TenantRole[] = [
  'superadmin', 'owner', 'admin', 'tenant_admin',
  'rh', 'financeiro',
];

/** Roles that can VIEW compensation data */
const COMPENSATION_VIEWERS: TenantRole[] = [
  ...COMPENSATION_MANAGERS,
  'group_admin', 'company_admin', 'gestor',
];

/** All roles that are tenant members (can view basic data) */
const ALL_MEMBERS: TenantRole[] = [
  'superadmin', 'owner', 'admin', 'tenant_admin',
  'group_admin', 'company_admin', 'rh', 'gestor',
  'financeiro', 'manager', 'viewer',
];

// ========================
// PERMISSION MATRIX
// ========================

type PermissionMatrix = Record<PermissionEntity, Record<PermissionAction, TenantRole[]>>;

export const PERMISSION_MATRIX: PermissionMatrix = {
  tenants: {
    view: ALL_MEMBERS,
    create: ALL_MEMBERS, // Any authenticated user can create a tenant (onboarding)
    update: TENANT_ADMINS,
    delete: TENANT_ADMINS,
  },
  company_groups: {
    view: ALL_MEMBERS,
    create: TENANT_ADMINS,
    update: TENANT_ADMINS,
    delete: TENANT_ADMINS,
  },
  companies: {
    view: ALL_MEMBERS,
    create: TENANT_ADMINS,
    update: TENANT_ADMINS,
    delete: TENANT_ADMINS,
  },
  departments: {
    view: ALL_MEMBERS,
    create: EMPLOYEE_MANAGERS,
    update: EMPLOYEE_MANAGERS,
    delete: EMPLOYEE_MANAGERS,
  },
  positions: {
    view: ALL_MEMBERS,
    create: EMPLOYEE_MANAGERS,
    update: EMPLOYEE_MANAGERS,
    delete: EMPLOYEE_MANAGERS,
  },
  employees: {
    view: ALL_MEMBERS,
    create: EMPLOYEE_MANAGERS,
    update: EMPLOYEE_MANAGERS,
    delete: EMPLOYEE_MANAGERS,
  },
  salary_contracts: {
    view: COMPENSATION_VIEWERS,
    create: COMPENSATION_MANAGERS,
    update: COMPENSATION_MANAGERS,
    delete: COMPENSATION_MANAGERS,
  },
  salary_adjustments: {
    view: COMPENSATION_VIEWERS,
    create: COMPENSATION_MANAGERS,
    update: COMPENSATION_MANAGERS,
    delete: COMPENSATION_MANAGERS,
  },
  salary_additionals: {
    view: COMPENSATION_VIEWERS,
    create: COMPENSATION_MANAGERS,
    update: COMPENSATION_MANAGERS,
    delete: COMPENSATION_MANAGERS,
  },
  salary_history: {
    view: COMPENSATION_VIEWERS,
    create: COMPENSATION_MANAGERS,
    update: COMPENSATION_MANAGERS,
    delete: COMPENSATION_MANAGERS,
  },
  compensation: {
    view: COMPENSATION_VIEWERS,
    create: COMPENSATION_MANAGERS,
    update: COMPENSATION_MANAGERS,
    delete: COMPENSATION_MANAGERS,
  },
  audit_logs: {
    view: TENANT_ADMINS,
    create: [], // System only (triggers)
    update: [], // Immutable
    delete: [], // Immutable
  },
  user_roles: {
    view: ALL_MEMBERS,
    create: TENANT_ADMINS,
    update: TENANT_ADMINS,
    delete: TENANT_ADMINS,
  },
  payroll_catalog: {
    view: ALL_MEMBERS,
    create: TENANT_ADMINS,
    update: TENANT_ADMINS,
    delete: TENANT_ADMINS,
  },
  benefit_plans: {
    view: ALL_MEMBERS,
    create: TENANT_ADMINS,
    update: TENANT_ADMINS,
    delete: TENANT_ADMINS,
  },
  employee_benefits: {
    view: COMPENSATION_VIEWERS,
    create: COMPENSATION_MANAGERS,
    update: COMPENSATION_MANAGERS,
    delete: COMPENSATION_MANAGERS,
  },
  health_programs: {
    view: ALL_MEMBERS,
    create: EMPLOYEE_MANAGERS,
    update: EMPLOYEE_MANAGERS,
    delete: EMPLOYEE_MANAGERS,
  },
  health_exams: {
    view: EMPLOYEE_MANAGERS,
    create: EMPLOYEE_MANAGERS,
    update: EMPLOYEE_MANAGERS,
    delete: [], // Immutable
  },
  labor_rules: {
    view: ALL_MEMBERS,
    create: TENANT_ADMINS,
    update: TENANT_ADMINS,
    delete: TENANT_ADMINS,
  },
};

// ========================
// NAV ACCESS (derived from permission matrix)
// ========================

export type NavKey = 'dashboard' | 'employees' | 'companies' | 'groups' | 'positions' | 'compensation' | 'departments' | 'audit' | 'compliance' | 'benefits' | 'health' | 'labor_dashboard' | 'labor_compliance' | 'labor_rules' | 'legal_dashboard';

const NAV_ENTITY_MAP: Record<NavKey, PermissionEntity> = {
  dashboard: 'tenants',
  employees: 'employees',
  companies: 'companies',
  groups: 'company_groups',
  positions: 'positions',
  compensation: 'compensation',
  departments: 'departments',
  audit: 'audit_logs',
  compliance: 'payroll_catalog',
  benefits: 'benefit_plans',
  health: 'health_programs',
  labor_dashboard: 'health_programs',
  labor_compliance: 'health_programs',
  labor_rules: 'labor_rules',
  legal_dashboard: 'labor_rules',
};

/**
 * Check if a set of roles can access a nav item.
 * Nav access = 'view' permission on the mapped entity.
 */
export function canAccessNavItem(navKey: NavKey, roles: TenantRole[]): boolean {
  const entity = NAV_ENTITY_MAP[navKey];
  if (!entity) return true;
  const allowedRoles = PERMISSION_MATRIX[entity].view;
  return roles.some(r => allowedRoles.includes(r));
}

/**
 * Check if a set of roles can perform an action on an entity.
 */
export function hasPermission(
  entity: PermissionEntity,
  action: PermissionAction,
  roles: TenantRole[]
): boolean {
  const allowedRoles = PERMISSION_MATRIX[entity]?.[action];
  if (!allowedRoles || allowedRoles.length === 0) return false;
  return roles.some(r => allowedRoles.includes(r));
}
