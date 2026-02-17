/**
 * RollbackExecutor — Executes safe rollbacks between published landing page versions.
 *
 * Operates at the PLATFORM level:
 *  - Restores the previous version's content_snapshot to the parent landing page
 *  - Marks the current version as "superseded"
 *  - Re-publishes the target version
 *  - DOES NOT modify content — only swaps versions
 */
import { supabase } from '@/integrations/supabase/client';
import type { RollbackDecision, RollbackExecution } from './types';

class RollbackExecutor {
  private executions: RollbackExecution[] = [];

  /**
   * Execute a rollback based on an approved decision.
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
      // 1. Fetch target version's content snapshot
      const { data: targetVersion, error: tvErr } = await supabase
        .from('landing_page_versions')
        .select('content_snapshot')
        .eq('id', decision.targetVersionId)
        .single();

      if (tvErr || !targetVersion) {
        throw new Error(`Versão alvo ${decision.targetVersionNumber} não encontrada.`);
      }

      // 2. Supersede current version
      await supabase
        .from('landing_page_versions')
        .update({ status: 'superseded' })
        .eq('id', decision.currentVersionId);

      // 3. Re-publish target version
      await supabase
        .from('landing_page_versions')
        .update({ status: 'published' })
        .eq('id', decision.targetVersionId);

      // 4. Update parent landing page with target version content
      await supabase
        .from('landing_pages')
        .update({
          blocks: targetVersion.content_snapshot,
          updated_at: new Date().toISOString(),
        })
        .eq('id', decision.landingPageId);

      // 5. Mark execution as completed
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();

      // Record execution time on decision
      decision.executedAt = execution.completedAt;

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
