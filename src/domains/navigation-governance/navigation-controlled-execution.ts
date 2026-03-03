/**
 * NavigationControlledExecution
 *
 * Pipeline de execução controlada para refatorações de navegação:
 *   1) Gerar nova versão DRAFT
 *   2) Exibir preview visual (diff)
 *   3) Exigir aprovação de PlatformSuperAdmin
 *   4) Aplicar nova estrutura
 *
 * ⚠️ Nenhuma mudança é aplicada sem aprovação explícita.
 */

import { supabase } from '@/integrations/supabase/client';
import type { MenuHierarchy } from './menu-hierarchy-builder';
import type { NavigationDiff } from './navigation-version-manager';
import {
  getLatestVersion,
  computeNavigationDiff,
  createNavigationVersion,
} from './navigation-version-manager';

// ── Types ────────────────────────────────────────────────────

export type DraftStatus = 'draft' | 'pending_approval' | 'approved' | 'applied' | 'rejected' | 'expired';

export interface NavigationDraft {
  id: string;
  status: DraftStatus;
  context: 'saas' | 'tenant';
  proposed_snapshot: MenuHierarchy;
  current_snapshot: MenuHierarchy | null;
  diff: NavigationDiff | null;
  proposed_by: string;
  proposed_at: number;
  reason: string;
  approval?: DraftApproval;
  applied_version?: number;
}

export interface DraftApproval {
  approved_by: string;
  approved_at: number;
  notes?: string;
}

export interface DraftRejection {
  rejected_by: string;
  rejected_at: number;
  reason: string;
}

export interface CreateDraftInput {
  proposed_snapshot: MenuHierarchy;
  proposed_by: string;
  reason: string;
  context?: 'saas' | 'tenant';
}

export interface ApplyResult {
  success: boolean;
  new_version: number;
  draft_id: string;
  summary: string[];
}

// ── Draft Store ──────────────────────────────────────────────

const drafts = new Map<string, NavigationDraft>();

function generateDraftId(): string {
  return `nav_draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Step 1: Create Draft ─────────────────────────────────────

/**
 * Creates a new navigation draft version.
 * The draft is NOT applied — it must go through the approval pipeline.
 */
export function createNavigationDraft(input: CreateDraftInput): NavigationDraft {
  const { proposed_snapshot, proposed_by, reason, context = 'tenant' } = input;

  const current = getLatestVersion();
  const currentSnapshot = current?.snapshot ?? null;

  const diff = currentSnapshot
    ? computeNavigationDiff(currentSnapshot, proposed_snapshot, current!.version, 0)
    : null;

  const draft: NavigationDraft = {
    id: generateDraftId(),
    status: 'draft',
    context,
    proposed_snapshot,
    current_snapshot: currentSnapshot,
    diff,
    proposed_by,
    proposed_at: Date.now(),
    reason,
  };

  drafts.set(draft.id, draft);

  // Persist draft to DB (fire-and-forget)
  supabase.from('navigation_versions').insert({
    version_number: 0, // draft = version 0
    context,
    tree_snapshot: proposed_snapshot as any,
    description: `[DRAFT] ${reason}`,
    created_by: proposed_by,
  } as any).then(({ error }) => {
    if (error) console.warn('[ControlledExecution] Failed to persist draft:', error.message);
  });

  return draft;
}

// ── Step 2: Preview ──────────────────────────────────────────

/**
 * Returns the draft with its diff for visual preview.
 * No side effects — purely read-only.
 */
export function previewDraft(draftId: string): NavigationDraft | null {
  return drafts.get(draftId) ?? null;
}

/**
 * Returns all drafts, optionally filtered by status.
 */
export function listDrafts(statusFilter?: DraftStatus): NavigationDraft[] {
  const all = Array.from(drafts.values());
  return statusFilter ? all.filter(d => d.status === statusFilter) : all;
}

// ── Step 3: Submit for Approval ──────────────────────────────

/**
 * Marks a draft as pending approval from PlatformSuperAdmin.
 */
export function submitDraftForApproval(draftId: string): NavigationDraft | null {
  const draft = drafts.get(draftId);
  if (!draft || draft.status !== 'draft') return null;

  draft.status = 'pending_approval';
  return draft;
}

/**
 * PlatformSuperAdmin approves a draft.
 * Only `platform_super_admin` should call this (enforced at caller).
 */
export function approveDraft(
  draftId: string,
  approvedBy: string,
  notes?: string,
): NavigationDraft | null {
  const draft = drafts.get(draftId);
  if (!draft || draft.status !== 'pending_approval') return null;

  draft.status = 'approved';
  draft.approval = {
    approved_by: approvedBy,
    approved_at: Date.now(),
    notes,
  };

  return draft;
}

/**
 * PlatformSuperAdmin rejects a draft.
 */
export function rejectDraft(
  draftId: string,
  rejectedBy: string,
  reason: string,
): NavigationDraft | null {
  const draft = drafts.get(draftId);
  if (!draft || draft.status !== 'pending_approval') return null;

  draft.status = 'rejected';
  return draft;
}

// ── Step 4: Apply Approved Draft ─────────────────────────────

/**
 * Applies an approved draft, creating a real navigation version.
 * ONLY works if status === 'approved'.
 *
 * ⚠️ This is the ONLY path to change the live navigation structure.
 */
export function applyApprovedDraft(draftId: string): ApplyResult {
  const draft = drafts.get(draftId);

  if (!draft) {
    return { success: false, new_version: 0, draft_id: draftId, summary: ['Draft não encontrado'] };
  }

  if (draft.status !== 'approved') {
    return {
      success: false,
      new_version: 0,
      draft_id: draftId,
      summary: [`Draft está em status "${draft.status}" — aprovação obrigatória`],
    };
  }

  if (!draft.approval) {
    return {
      success: false,
      new_version: 0,
      draft_id: draftId,
      summary: ['Aprovação não registrada'],
    };
  }

  // Create official version from approved draft
  const newVersion = createNavigationVersion(
    draft.proposed_snapshot,
    draft.approval.approved_by,
    `Refatoração aprovada: ${draft.reason} (draft: ${draft.id})`,
    draft.context,
  );

  draft.status = 'applied';
  draft.applied_version = newVersion.version;

  const summary = [
    `✅ Refatoração aplicada com sucesso`,
    `Nova versão: v${newVersion.version}`,
    `Aprovado por: ${draft.approval.approved_by}`,
    `Motivo: ${draft.reason}`,
    ...(draft.diff?.summary ?? []),
  ];

  return {
    success: true,
    new_version: newVersion.version,
    draft_id: draft.id,
    summary,
  };
}

// ── Utilities ────────────────────────────────────────────────

/**
 * Get a draft by ID.
 */
export function getDraft(draftId: string): NavigationDraft | null {
  return drafts.get(draftId) ?? null;
}

/**
 * Expire old drafts that were never applied.
 */
export function expireOldDrafts(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
  const now = Date.now();
  let expired = 0;

  for (const [id, draft] of drafts) {
    if (
      (draft.status === 'draft' || draft.status === 'pending_approval') &&
      now - draft.proposed_at > maxAgeMs
    ) {
      draft.status = 'expired';
      expired++;
    }
  }

  return expired;
}
