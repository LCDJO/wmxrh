/**
 * SecurityKernel — PolicyEngine (Enterprise-grade)
 * 
 * Declarative, composable policy system inspired by AWS IAM / OPA.
 * 
 * Architecture:
 *   PolicyRule (declarative) → compiled into PolicyFn (executable)
 *   PolicyEngine evaluates all rules: first explicit DENY wins, then requires ALLOW.
 * 
 * Evaluation order (IAM-style):
 *   1. Explicit DENY rules → if any match, immediately denied
 *   2. ALLOW rules → at least one must match for the action
 *   3. Default DENY → if no ALLOW matched
 * 
 * Built-in rules cover HR SaaS business constraints:
 *   - HR: salary adjustment only within company scope
 *   - Finance: view all financial data within tenant
 *   - Scope hierarchy enforcement
 *   - Cross-tenant prevention
 */

import type { TenantRole } from '@/domains/shared/types';
import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';
import type { ScopeResolution } from './scope-resolver';
import type { PermissionAction, PermissionEntity } from '../permissions';
import type { SecurityContext, SecurityScope } from './identity.service';

// ════════════════════════════════════════════════════════════
// POLICY TYPES
// ════════════════════════════════════════════════════════════

export type PolicyDecision = 'allow' | 'deny';
export type PolicyEffect = 'allow' | 'deny';

/**
 * Declarative policy rule — the building block.
 * 
 * Example:
 * {
 *   id: 'hr_salary_company_scope',
 *   effect: 'allow',
 *   roles: ['rh'],
 *   actions: ['create', 'update'],
 *   resources: ['salary_adjustments', 'salary_contracts'],
 *   condition: { scope_type: 'company' },
 *   description: 'HR pode ajustar salário apenas dentro do company scope',
 * }
 */
export interface PolicyRule {
  /** Unique identifier */
  id: string;
  /** What this rule does when matched */
  effect: PolicyEffect;
  /** Tenant-level roles this rule applies to (empty = all roles) */
  roles: TenantRole[];
  /** Platform-level roles this rule applies to (empty = ignored; checked via real_identity) */
  platform_roles?: PlatformRoleType[];
  /** Actions this rule governs (empty = all actions) */
  actions: PermissionAction[];
  /** Resources this rule governs (empty = all resources) */
  resources: PermissionEntity[];
  /** Condition that must be met for the rule to apply */
  condition?: PolicyCondition;
  /** Human-readable description */
  description: string;
  /** Priority: lower = evaluated first (default 100) */
  priority?: number;
  /** Whether this rule is active */
  enabled?: boolean;
}

/**
 * Conditions for policy evaluation.
 * All specified fields must match (AND logic).
 */
export interface PolicyCondition {
  /** Required scope type for the action */
  scope_type?: 'tenant' | 'company_group' | 'company';
  /** Required scope types (OR — any of these) */
  scope_type_in?: Array<'tenant' | 'company_group' | 'company'>;
  /** User must have scope covering the target */
  require_scope_match?: boolean;
  /** Custom predicate for complex conditions */
  custom?: (ctx: PolicyEvalContext) => boolean;
}

/** Extended context for policy evaluation */
export interface PolicyEvalContext {
  /** The SecurityContext of the requester */
  securityContext: SecurityContext;
  /** What action is being attempted */
  action: PermissionAction;
  /** What resource is being targeted */
  resource: PermissionEntity;
  /** Target entity's location (for scope matching) */
  target?: {
    tenant_id?: string;
    company_group_id?: string | null;
    company_id?: string | null;
  };
  /** Additional attributes */
  attributes?: Record<string, unknown>;
}

/** Legacy context (backward compat) */
export interface PolicyContext {
  userId: string;
  tenantId: string;
  roles: TenantRole[];
  scope: ScopeResolution;
  attributes?: Record<string, unknown>;
}

export interface PolicyResult {
  decision: PolicyDecision;
  reason?: string;
  /** Policy/rule that produced this result */
  policyId: string;
  /** All rules that were evaluated */
  evaluatedRules?: string[];
}

/** Legacy: simple function-based policy */
export type PolicyFn = (ctx: PolicyContext) => PolicyResult;

// ════════════════════════════════════════════════════════════
// BUILT-IN POLICY RULES
// ════════════════════════════════════════════════════════════

export const BUILTIN_RULES: PolicyRule[] = [
  // ── HR Business Rules ──
  {
    id: 'hr_salary_company_scope',
    effect: 'allow',
    roles: ['rh'],
    actions: ['create', 'update', 'delete'],
    resources: ['salary_adjustments', 'salary_contracts', 'salary_additionals', 'salary_history'],
    condition: {
      scope_type_in: ['company', 'company_group'],
      require_scope_match: true,
    },
    description: 'HR pode ajustar salário apenas dentro do seu escopo (company/group)',
    priority: 10,
  },
  {
    id: 'hr_view_compensation',
    effect: 'allow',
    roles: ['rh'],
    actions: ['view'],
    resources: ['salary_adjustments', 'salary_contracts', 'salary_additionals', 'salary_history', 'compensation'],
    description: 'HR pode visualizar dados de compensação no seu escopo',
    priority: 10,
  },

  // ── Finance Rules ──
  {
    id: 'finance_view_all_financial',
    effect: 'allow',
    roles: ['financeiro'],
    actions: ['view'],
    resources: ['salary_adjustments', 'salary_contracts', 'salary_additionals', 'salary_history', 'compensation'],
    condition: { scope_type_in: ['tenant', 'company_group', 'company'] },
    description: 'Finance pode visualizar todos dados financeiros dentro do tenant',
    priority: 10,
  },
  {
    id: 'finance_manage_compensation',
    effect: 'allow',
    roles: ['financeiro'],
    actions: ['create', 'update'],
    resources: ['salary_adjustments', 'salary_contracts', 'salary_additionals'],
    condition: { require_scope_match: true },
    description: 'Finance pode gerenciar compensação dentro do seu escopo',
    priority: 10,
  },

  // ── Manager Rules ──
  {
    id: 'manager_view_team_compensation',
    effect: 'allow',
    roles: ['gestor', 'manager'],
    actions: ['view'],
    resources: ['compensation', 'salary_history'],
    condition: { require_scope_match: true },
    description: 'Gestor pode visualizar compensação da sua equipe',
    priority: 20,
  },

  // ── Admin Rules (broad access) ──
  {
    id: 'tenant_admin_full_access',
    effect: 'allow',
    roles: ['superadmin', 'owner', 'admin', 'tenant_admin'],
    actions: [],  // all actions
    resources: [], // all resources
    description: 'Tenant admins têm acesso completo',
    priority: 0,
  },

  // ── Group Admin ──
  {
    id: 'group_admin_manage_group',
    effect: 'allow',
    roles: ['group_admin'],
    actions: [],
    resources: ['employees', 'departments', 'positions', 'companies'],
    condition: { scope_type_in: ['company_group', 'company'] },
    description: 'Group admin gerencia recursos dentro do seu grupo',
    priority: 5,
  },

  // ── Company Admin ──
  {
    id: 'company_admin_manage_company',
    effect: 'allow',
    roles: ['company_admin'],
    actions: [],
    resources: ['employees', 'departments', 'positions'],
    condition: { scope_type: 'company', require_scope_match: true },
    description: 'Company admin gerencia recursos dentro da sua empresa',
    priority: 5,
  },

  // ── Deny Rules ──
  {
    id: 'deny_viewer_mutations',
    effect: 'deny',
    roles: ['viewer'],
    actions: ['create', 'update', 'delete'],
    resources: [], // all resources
    description: 'Viewer não pode realizar mutações',
    priority: 0,
  },
  {
    id: 'deny_audit_modification',
    effect: 'deny',
    roles: [], // all roles
    actions: ['create', 'update', 'delete'],
    resources: ['audit_logs'],
    description: 'Audit logs são imutáveis',
    priority: 0,
  },

  // ── Impersonation Financial Block ──
  {
    id: 'deny_impersonation_financial_mutations',
    effect: 'deny',
    roles: [], // any role during impersonation
    actions: ['create', 'update', 'delete'],
    resources: ['salary_adjustments', 'salary_contracts', 'salary_additionals', 'compensation'],
    condition: {
      custom: (ctx) => ctx.securityContext.is_impersonating === true,
    },
    description: 'Ações financeiras críticas são bloqueadas durante impersonação',
    priority: 0, // highest priority deny
  },
  {
    id: 'deny_impersonation_benefit_mutations',
    effect: 'deny',
    roles: [],
    actions: ['create', 'update', 'delete'],
    resources: ['benefit_plans', 'employee_benefits'],
    condition: {
      custom: (ctx) => ctx.securityContext.is_impersonating === true,
    },
    description: 'Gestão de benefícios bloqueada durante impersonação',
    priority: 0,
  },
  {
    id: 'deny_impersonation_iam_mutations',
    effect: 'deny',
    roles: [],
    actions: ['create', 'update', 'delete'],
    resources: ['user_roles'],
    condition: {
      custom: (ctx) => ctx.securityContext.is_impersonating === true,
    },
    description: 'Gestão de IAM/permissões bloqueada durante impersonação',
    priority: 0,
  },

  // ══════════════════════════════════════════════════════════
  // PLATFORM-LEVEL SECURITY RULES (CRITICAL)
  // ══════════════════════════════════════════════════════════

  // RULE: Only PlatformSuperAdmin can create system roles
  {
    id: 'platform_deny_non_super_admin_system_role_create',
    effect: 'deny',
    roles: [],
    platform_roles: ['platform_operations', 'platform_support', 'platform_finance', 'platform_fiscal', 'platform_read_only'],
    actions: ['create'],
    resources: ['platform_roles'],
    condition: {
      custom: (ctx) => {
        // Block when trying to create a system_role (passed via attributes)
        const isSystemRole = ctx.attributes?.is_system_role === true;
        return ctx.securityContext.user_type === 'platform' && isSystemRole;
      },
    },
    description: 'Apenas PlatformSuperAdmin pode criar cargos do tipo system_role. Outros cargos plataforma são bloqueados.',
    priority: 0,
  },

  // RULE: PlatformSupport CANNOT alter billing
  {
    id: 'platform_deny_support_billing_mutation',
    effect: 'deny',
    roles: [],
    platform_roles: ['platform_support'],
    actions: ['create', 'update', 'delete'],
    resources: ['platform_billing'],
    condition: {
      custom: (ctx) => ctx.securityContext.user_type === 'platform',
    },
    description: 'PlatformSupport NÃO pode alterar dados de billing. Apenas visualização é permitida.',
    priority: 0,
  },

  // RULE: PlatformFinance CANNOT impersonate
  {
    id: 'platform_deny_finance_impersonation',
    effect: 'deny',
    roles: [],
    platform_roles: ['platform_finance'],
    actions: ['create'],
    resources: ['platform_impersonation'],
    condition: {
      custom: (ctx) => ctx.securityContext.user_type === 'platform',
    },
    description: 'PlatformFinance NÃO pode iniciar impersonação de tenants. Política de segurança explícita.',
    priority: 0,
  },

  // RULE: Only PlatformSuperAdmin + PlatformFinance can create/update/delete coupons
  {
    id: 'platform_deny_non_authorized_coupon_mutation',
    effect: 'deny',
    roles: [],
    platform_roles: ['platform_operations', 'platform_support', 'platform_fiscal', 'platform_read_only', 'platform_delegated_support', 'platform_marketplace_admin', 'platform_compliance'],
    actions: ['create', 'update', 'delete'],
    resources: ['platform_coupons'],
    condition: {
      custom: (ctx) => ctx.securityContext.user_type === 'platform',
    },
    description: 'Apenas PlatformSuperAdmin e PlatformFinance podem criar, alterar ou desativar cupons. Demais roles de plataforma são bloqueados.',
    priority: 0,
  },

  // RULE: Only PlatformMarketingDirector + PlatformSuperAdmin can enable auto-rollback
  {
    id: 'platform_deny_non_authorized_auto_rollback',
    effect: 'deny',
    roles: [],
    platform_roles: ['platform_operations', 'platform_support', 'platform_finance', 'platform_fiscal', 'platform_read_only', 'platform_delegated_support', 'platform_marketplace_admin', 'platform_compliance'],
    actions: ['create', 'update'],
    resources: ['platform_auto_rollback'],
    condition: {
      custom: (ctx) => ctx.securityContext.user_type === 'platform',
    },
    description: 'Apenas PlatformMarketingDirector e PlatformSuperAdmin podem habilitar auto-rollback. Demais roles de plataforma são bloqueados.',
    priority: 0,
  },

  // ── IAM-Specific Rules ──
  {
    id: 'iam_admin_manage_roles',
    effect: 'allow',
    roles: ['superadmin', 'owner', 'admin', 'tenant_admin'],
    actions: ['create', 'update', 'delete'],
    resources: ['user_roles'],
    description: 'Apenas TenantAdmin pode gerenciar cargos e permissões (IAM)',
    priority: 5,
  },
  {
    id: 'iam_all_view_roles',
    effect: 'allow',
    roles: [],
    actions: ['view'],
    resources: ['user_roles'],
    description: 'Todos os membros podem visualizar cargos e permissões',
    priority: 10,
  },
  {
    id: 'deny_non_admin_iam_mutation',
    effect: 'deny',
    roles: ['rh', 'gestor', 'manager', 'financeiro', 'viewer', 'group_admin', 'company_admin'],
    actions: ['create', 'update', 'delete'],
    resources: ['user_roles'],
    description: 'Apenas TenantAdmin pode modificar IAM — roles não-admin são explicitamente negadas',
    priority: 1,
  },
];

// ════════════════════════════════════════════════════════════
// LEGACY BUILT-IN POLICIES (backward compat)
// ════════════════════════════════════════════════════════════

export const requireAtLeastOneRole: PolicyFn = (ctx) => ({
  decision: ctx.roles.length > 0 ? 'allow' : 'deny',
  reason: ctx.roles.length > 0 ? undefined : 'Nenhuma role atribuída ao usuário.',
  policyId: 'require_at_least_one_role',
});

export const requireValidScope: PolicyFn = (ctx) => ({
  decision: ctx.scope.tenantId ? 'allow' : 'deny',
  reason: ctx.scope.tenantId ? undefined : 'Escopo do tenant não resolvido.',
  policyId: 'require_valid_scope',
});

export const preventCrossTenantAccess: PolicyFn = (ctx) => ({
  decision: ctx.tenantId === ctx.scope.tenantId ? 'allow' : 'deny',
  reason: ctx.tenantId === ctx.scope.tenantId ? undefined : 'Acesso cross-tenant bloqueado.',
  policyId: 'prevent_cross_tenant',
});

// ════════════════════════════════════════════════════════════
// RULE EVALUATION LOGIC
// ════════════════════════════════════════════════════════════

function ruleMatchesRequest(
  rule: PolicyRule,
  ctx: PolicyEvalContext
): boolean {
  // Check enabled
  if (rule.enabled === false) return false;

  // Check tenant-level roles (empty = matches all)
  if (rule.roles.length > 0) {
    const hasMatchingRole = ctx.securityContext.roles.some(r => rule.roles.includes(r));
    if (!hasMatchingRole) return false;
  }

  // Check platform-level roles (if specified, must match via real_identity)
  if (rule.platform_roles && rule.platform_roles.length > 0) {
    const platformRole = ctx.securityContext.real_identity?.platformRole as PlatformRoleType | undefined;
    if (!platformRole || !rule.platform_roles.includes(platformRole)) return false;
  }

  // Check actions (empty = matches all)
  if (rule.actions.length > 0 && !rule.actions.includes(ctx.action)) return false;

  // Check resources (empty = matches all)
  if (rule.resources.length > 0 && !rule.resources.includes(ctx.resource)) return false;

  // Check conditions
  if (rule.condition) {
    if (!evaluateCondition(rule.condition, ctx)) return false;
  }

  return true;
}

function evaluateCondition(
  condition: PolicyCondition,
  ctx: PolicyEvalContext
): boolean {
  const scopes = ctx.securityContext.scopes;

  // scope_type: user must have this specific scope type
  if (condition.scope_type) {
    const hasType = scopes.some(s => s.type === condition.scope_type);
    if (!hasType) return false;
  }

  // scope_type_in: user must have at least one of these scope types
  if (condition.scope_type_in && condition.scope_type_in.length > 0) {
    const hasAny = scopes.some(s => condition.scope_type_in!.includes(s.type as any));
    if (!hasAny) return false;
  }

  // require_scope_match: user's scopes must cover the target
  if (condition.require_scope_match && ctx.target) {
    if (!scopeCoversTarget(scopes, ctx.target)) return false;
  }

  // custom predicate
  if (condition.custom && !condition.custom(ctx)) return false;

  return true;
}

function scopeCoversTarget(
  scopes: SecurityScope[],
  target: NonNullable<PolicyEvalContext['target']>
): boolean {
  // Tenant scope covers everything
  if (scopes.some(s => s.type === 'tenant')) return true;

  // Group scope covers target group or any company in group
  if (target.company_group_id) {
    if (scopes.some(s => s.type === 'company_group' && s.id === target.company_group_id)) return true;
  }

  // Company scope covers target company
  if (target.company_id) {
    if (scopes.some(s => s.type === 'company' && s.id === target.company_id)) return true;
    // Group-scoped users may access companies in their group (RLS validates)
    if (scopes.some(s => s.type === 'company_group')) return true;
  }

  // No target location = tenant-level, only tenant scope matches
  if (!target.company_group_id && !target.company_id) return false;

  return false;
}

// ════════════════════════════════════════════════════════════
// POLICY ENGINE
// ════════════════════════════════════════════════════════════

export interface PolicyEngineAPI {
  // ── Declarative API (primary) ──
  /** Evaluate declarative rules for an action. IAM-style: explicit deny → allow → default deny */
  evaluateRules: (ctx: PolicyEvalContext) => PolicyResult;
  /** Register a declarative policy rule */
  addRule: (rule: PolicyRule) => void;
  /** Remove a rule by ID */
  removeRule: (ruleId: string) => void;
  /** Get a rule by ID */
  getRule: (ruleId: string) => PolicyRule | undefined;
  /** Get all rules */
  getRules: () => PolicyRule[];

  // ── Legacy API (backward compat) ──
  /** Evaluate legacy function-based policies */
  evaluate: (ctx: PolicyContext) => PolicyResult;
  /** Register a legacy policy function */
  register: (policy: PolicyFn) => void;
  /** Get legacy policies */
  getPolicies: () => PolicyFn[];
  /** Reset to defaults */
  reset: () => void;
}

function createPolicyEngine(): PolicyEngineAPI {
  // Declarative rules
  let rules: PolicyRule[] = [...BUILTIN_RULES];

  // Legacy function-based policies
  let legacyPolicies: PolicyFn[] = [
    requireAtLeastOneRole,
    requireValidScope,
    preventCrossTenantAccess,
  ];

  return {
    // ── Declarative API ──

    evaluateRules: (ctx) => {
      const sortedRules = [...rules].sort(
        (a, b) => (a.priority ?? 100) - (b.priority ?? 100)
      );

      const evaluatedRules: string[] = [];

      // Phase 1: Check explicit DENY rules
      for (const rule of sortedRules) {
        if (rule.effect !== 'deny') continue;
        if (ruleMatchesRequest(rule, ctx)) {
          evaluatedRules.push(rule.id);
          return {
            decision: 'deny',
            reason: rule.description,
            policyId: rule.id,
            evaluatedRules,
          };
        }
      }

      // Phase 2: Check ALLOW rules — at least one must match
      let allowed = false;
      for (const rule of sortedRules) {
        if (rule.effect !== 'allow') continue;
        evaluatedRules.push(rule.id);
        if (ruleMatchesRequest(rule, ctx)) {
          allowed = true;
          return {
            decision: 'allow',
            policyId: rule.id,
            evaluatedRules,
          };
        }
      }

      // Phase 3: Default deny
      return {
        decision: 'deny',
        reason: `Nenhuma policy permite ${ctx.action} em ${ctx.resource} para roles [${ctx.securityContext.roles.join(', ')}].`,
        policyId: 'default_deny',
        evaluatedRules,
      };
    },

    addRule: (rule) => {
      // Replace if same ID exists
      rules = rules.filter(r => r.id !== rule.id);
      rules.push(rule);
    },

    removeRule: (ruleId) => {
      rules = rules.filter(r => r.id !== ruleId);
    },

    getRule: (ruleId) => rules.find(r => r.id === ruleId),

    getRules: () => [...rules],

    // ── Legacy API ──

    evaluate: (ctx) => {
      for (const policy of legacyPolicies) {
        const result = policy(ctx);
        if (result.decision === 'deny') return result;
      }
      return { decision: 'allow', policyId: 'all_passed' };
    },

    register: (policy) => {
      legacyPolicies.push(policy);
    },

    getPolicies: () => [...legacyPolicies],

    reset: () => {
      rules = [...BUILTIN_RULES];
      legacyPolicies = [
        requireAtLeastOneRole,
        requireValidScope,
        preventCrossTenantAccess,
      ];
    },
  };
}

export const policyEngine = createPolicyEngine();
