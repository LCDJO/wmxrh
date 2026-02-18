/**
 * SupportModuleRollback — Tenant-precision rollback for support_module only.
 *
 * Reverts the support_module to a previous version for a specific tenant
 * WITHOUT affecting any other module (Billing, Landing, Website, IAM, etc.).
 *
 * Flow:
 *   1. Validate target version exists and is released
 *   2. Ensure no protected modules are affected (support_module is NOT protected)
 *   3. Create a sandbox preview session pointing to the target version
 *   4. Log the rollback in the changelog with entity_scope
 *   5. Return the rollback result
 */
import { SupportModuleSandboxPreview } from './support-sandbox-preview';
import { SupportModuleVersionRegistry } from './support-module-version';
import { ModuleVersionRegistry } from './module-version-registry';
import { ROLLBACK_PROTECTED_MODULES } from './types';
import type { EntityScope } from './types';
import { getAdvancedVersioningEngine } from './index';
import { hasPlatformPermission } from '@/domains/platform/platform-permissions';
import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';

export interface TenantRollbackResult {
  success: boolean;
  tenant_id: string;
  module_id: 'support_module';
  from_version_tag: string | null;
  to_version_tag: string | null;
  preview_session_id: string | null;
  modules_untouched: string[];
  error?: string;
}

/** Modules explicitly guaranteed NOT to be affected */
const ISOLATION_GUARANTEED = [
  'billing',
  'billing_core',
  'invoicing',
  'financial_ledger',
  'payment_gateway',
  'coupon_engine',
  'revenue_intelligence',
  'landing_engine',
  'website_engine',
  'iam',
  'automation',
  'observability',
  'growth',
] as const;

export class SupportModuleRollback {
  private preview = new SupportModuleSandboxPreview();
  private supportVersions = new SupportModuleVersionRegistry();
  private moduleRegistry = new ModuleVersionRegistry();

  /**
   * Roll back support_module for a single tenant to a specific version.
   * All other modules remain completely untouched.
   */
  async rollbackTenant(opts: {
    tenant_id: string;
    target_version_id: string;
    rolled_back_by: string;
    role: PlatformRoleType;
    reason?: string;
  }): Promise<TenantRollbackResult> {
    const MODULE_ID = 'support_module';

    // 0. Permission gate — only PlatformSuperAdmin / PlatformOperations
    if (!hasPlatformPermission(opts.role, 'versioning.rollback')) {
      return {
        success: false,
        tenant_id: opts.tenant_id,
        module_id: MODULE_ID,
        from_version_tag: null,
        to_version_tag: null,
        preview_session_id: null,
        modules_untouched: [...ISOLATION_GUARANTEED],
        error: `Role "${opts.role}" não possui permissão versioning.rollback`,
      };
    }

    // 1. Safety check — support_module must NOT be in protected list
    if (ROLLBACK_PROTECTED_MODULES.includes(MODULE_ID)) {
      return {
        success: false,
        tenant_id: opts.tenant_id,
        module_id: MODULE_ID,
        from_version_tag: null,
        to_version_tag: null,
        preview_session_id: null,
        modules_untouched: [...ISOLATION_GUARANTEED],
        error: 'support_module is unexpectedly in the protected list',
      };
    }

    // 2. Validate target version exists
    const targetVersion = await this.supportVersions.getById(opts.target_version_id);
    if (!targetVersion) {
      return {
        success: false,
        tenant_id: opts.tenant_id,
        module_id: MODULE_ID,
        from_version_tag: null,
        to_version_tag: null,
        preview_session_id: null,
        modules_untouched: [...ISOLATION_GUARANTEED],
        error: `Target version ${opts.target_version_id} not found`,
      };
    }

    // 3. Get current version for changelog diff
    const currentModuleVersion = await this.moduleRegistry.getCurrent(MODULE_ID);
    const fromTag = currentModuleVersion?.version_tag ?? null;

    // 4. Activate sandbox preview — tenant sees the rollback version immediately
    let session;
    try {
      session = await this.preview.activate({
        tenant_id: opts.tenant_id,
        version_id: opts.target_version_id,
        activated_by: opts.rolled_back_by,
        feature_flags_override: targetVersion.feature_flags as Record<string, boolean | string | number>,
      });
    } catch (err: any) {
      return {
        success: false,
        tenant_id: opts.tenant_id,
        module_id: MODULE_ID,
        from_version_tag: fromTag,
        to_version_tag: null,
        preview_session_id: null,
        modules_untouched: [...ISOLATION_GUARANTEED],
        error: err.message,
      };
    }

    // 5. Log in changelog
    try {
      const engine = getAdvancedVersioningEngine();
      await engine.tracker.track({
        module_id: MODULE_ID,
        entity_type: 'support_module',
        entity_id: `rollback:${opts.tenant_id}`,
        entity_scope: 'tenant_side' as EntityScope,
        change_type: 'rolled_back',
        version_tag: fromTag ?? 'v0.0.0',
        before: { version_id: currentModuleVersion?.id, version_tag: fromTag },
        after: {
          version_id: opts.target_version_id,
          tenant_id: opts.tenant_id,
          reason: opts.reason,
          preview_session_id: session.id,
        },
        changed_by: opts.rolled_back_by,
      });
    } catch {
      // Non-blocking — rollback still succeeded
    }

    return {
      success: true,
      tenant_id: opts.tenant_id,
      module_id: MODULE_ID,
      from_version_tag: fromTag,
      to_version_tag: `v-preview:${opts.target_version_id.slice(0, 8)}`,
      preview_session_id: session.id,
      modules_untouched: [...ISOLATION_GUARANTEED],
    };
  }

  /**
   * Finalize a tenant rollback — promote the version or abort.
   */
  async finalize(
    sessionId: string,
    opts: { promote: boolean; notes?: string },
  ) {
    if (opts.promote) {
      return this.preview.conclude(sessionId, { promoted: true, notes: opts.notes });
    }
    await this.preview.abort(sessionId, opts.notes ?? 'Rollback aborted');
    return null;
  }
}
