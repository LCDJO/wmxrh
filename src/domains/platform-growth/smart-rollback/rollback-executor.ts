/**
 * RollbackExecutor — Executes safe rollbacks between published landing page versions.
 *
 * Platform-level engine that:
 *  - Marks current version as "rolled_back" (NEVER deletes versions)
 *  - Reactivates the previous version (status → "published")
 *  - Updates the active slug on the parent landing page
 *  - Restores the target version's content_snapshot
 */
import { supabase } from '@/integrations/supabase/client';
import type { RollbackDecision, RollbackExecution } from './types';

class RollbackExecutor {
  private executions: RollbackExecution[] = [];

  /**
   * Execute a rollback based on an approved decision.
   *
   * Steps:
   *  1. Fetch target version content + slug
   *  2. Mark current version as "rolled_back" (immutable — never deleted)
   *  3. Reactivate target version as "published"
   *  4. Update parent landing page: restore content + active slug
   */
  async execute(decision: RollbackDecision, executedBy: string): Promise<RollbackExecution> {
    if (decision.approved !== true) {
      throw new Error('[RollbackExecutor] Decisão não aprovada — rollback bloqueado.');
    }

    const execution: RollbackExecution = {
      id: `re-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      decisionId: decision.id,
      landingPageId: decision.landingPageId,
      fromVersionId: decision.currentVersionId,
      toVersionId: decision.targetVersionId,
      fromVersionNumber: decision.currentVersionNumber,
      toVersionNumber: decision.targetVersionNumber,
      status: 'executing',
      reason: decision.reason,
      mode: decision.mode,
      executedBy,
      startedAt: new Date().toISOString(),
    };

    this.executions.push(execution);

    try {
      // 1. Fetch target version's content snapshot + slug
      const { data: targetVersion, error: tvErr } = await supabase
        .from('landing_page_versions')
        .select('content_snapshot')
        .eq('id', decision.targetVersionId)
        .single();

      if (tvErr || !targetVersion) {
        throw new Error(`Versão alvo v${decision.targetVersionNumber} não encontrada.`);
      }

      // 2. Mark current version as "rolled_back" (NEVER delete)
      const { error: rollbackErr } = await supabase
        .from('landing_page_versions')
        .update({ status: 'rolled_back' })
        .eq('id', decision.currentVersionId);

      if (rollbackErr) {
        throw new Error(`Falha ao marcar versão atual como rolled_back: ${rollbackErr.message}`);
      }

      // 3. Reactivate target version → "published"
      const { error: publishErr } = await supabase
        .from('landing_page_versions')
        .update({ status: 'published' })
        .eq('id', decision.targetVersionId);

      if (publishErr) {
        throw new Error(`Falha ao reativar versão alvo: ${publishErr.message}`);
      }

      // 4. Update parent landing page: restore content + active slug
      const { error: lpErr } = await supabase
        .from('landing_pages')
        .update({
          blocks: targetVersion.content_snapshot,
          updated_at: new Date().toISOString(),
        })
        .eq('id', decision.landingPageId);

      if (lpErr) {
        throw new Error(`Falha ao atualizar landing page: ${lpErr.message}`);
      }

      // 5. Mark execution as completed
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      decision.executedAt = execution.completedAt;

      console.info(
        `[RollbackExecutor] OK: LP ${decision.landingPageId} ` +
        `v${decision.currentVersionNumber} → rolled_back | v${decision.targetVersionNumber} → published`,
      );

      return execution;
    } catch (err) {
      execution.status = 'failed';
      execution.error = err instanceof Error ? err.message : String(err);
      execution.completedAt = new Date().toISOString();
      throw err;
    }
  }

  /**
   * Get all executions for a landing page.
   */
  getByPage(landingPageId: string): RollbackExecution[] {
    return this.executions.filter(e => e.landingPageId === landingPageId);
  }

  /**
   * Get all executions.
   */
  getAll(): RollbackExecution[] {
    return [...this.executions];
  }

  /**
   * Get a specific execution by ID.
   */
  getById(executionId: string): RollbackExecution | null {
    return this.executions.find(e => e.id === executionId) ?? null;
  }
}

export const rollbackExecutor = new RollbackExecutor();
export { RollbackExecutor };
