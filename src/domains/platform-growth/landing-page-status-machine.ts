/**
 * LandingPageStatusMachine — Enforces strict state transitions for landing pages.
 *
 * States: draft → submitted → approved → published → archived
 *
 * Rules:
 *  - draft → submitted         (PlatformMarketing, Director, SuperAdmin)
 *  - submitted → approved      (Director, SuperAdmin)
 *  - approved → published      (Director, SuperAdmin)
 *  - published → archived      (Director, SuperAdmin)
 *  - submitted → draft         (rejection sends back to draft)
 *
 * Restrictions:
 *  - Approved pages CANNOT be deleted.
 *  - Published pages CANNOT revert to draft.
 *  - Changes after approval create a NEW VERSION (handled by governance engine).
 */

import { hasPlatformPermission } from '@/domains/platform/platform-permissions';
import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';
import type { PlatformPermission } from '@/domains/platform/platform-permissions';

// ═══════════════════════════════════
// Status Definitions
// ═══════════════════════════════════

export const LANDING_PAGE_STATUSES = ['draft', 'submitted', 'approved', 'published', 'archived'] as const;
export type LandingPageStatus = typeof LANDING_PAGE_STATUSES[number];

/** Version-level statuses (versions can be superseded but never archived) */
export const LANDING_VERSION_STATUSES = ['draft', 'submitted', 'approved', 'published', 'superseded'] as const;
export type LandingVersionStatus = typeof LANDING_VERSION_STATUSES[number];

// ═══════════════════════════════════
// Transition Matrix
// ═══════════════════════════════════

interface TransitionRule {
  to: LandingPageStatus;
  requiredPermission: PlatformPermission;
  label: string;
}

const TRANSITION_MAP: Record<LandingPageStatus, TransitionRule[]> = {
  draft: [
    { to: 'submitted', requiredPermission: 'landing.submit_for_review', label: 'Submeter para revisão' },
  ],
  submitted: [
    { to: 'approved', requiredPermission: 'landing.approve', label: 'Aprovar' },
    { to: 'draft', requiredPermission: 'landing.reject', label: 'Rejeitar (voltar p/ rascunho)' },
  ],
  approved: [
    { to: 'published', requiredPermission: 'landing.publish', label: 'Publicar' },
  ],
  published: [
    { to: 'archived', requiredPermission: 'landing.publish', label: 'Arquivar' },
  ],
  archived: [],
};

// ═══════════════════════════════════
// Deletion Rules
// ═══════════════════════════════════

/** Only 'draft' status allows deletion. Everything else is blocked. */
const DELETABLE_STATUSES: readonly LandingPageStatus[] = ['draft'];

// ═══════════════════════════════════
// Machine Functions
// ═══════════════════════════════════

/**
 * Returns all valid transitions from the current status for the given role.
 */
export function getAvailableTransitions(
  currentStatus: LandingPageStatus,
  role: PlatformRoleType | null | undefined,
): TransitionRule[] {
  if (!role) return [];
  const rules = TRANSITION_MAP[currentStatus] ?? [];
  return rules.filter(r => hasPlatformPermission(role, r.requiredPermission));
}

/**
 * Checks if a specific transition is allowed for a given role.
 */
export function canTransition(
  currentStatus: LandingPageStatus,
  targetStatus: LandingPageStatus,
  role: PlatformRoleType | null | undefined,
): boolean {
  return getAvailableTransitions(currentStatus, role)
    .some(t => t.to === targetStatus);
}

/**
 * Validates and returns the transition rule or throws.
 */
export function validateTransition(
  currentStatus: LandingPageStatus,
  targetStatus: LandingPageStatus,
  role: PlatformRoleType,
): TransitionRule {
  const available = getAvailableTransitions(currentStatus, role);
  const rule = available.find(t => t.to === targetStatus);

  if (!rule) {
    const validTargets = available.map(t => t.to).join(', ') || 'nenhuma';
    throw new Error(
      `Transição inválida: "${currentStatus}" → "${targetStatus}" não é permitida para o cargo "${role}". ` +
      `Transições válidas: ${validTargets}`
    );
  }

  return rule;
}

/**
 * Checks if a landing page in the given status can be deleted.
 * Only drafts can be deleted. After submission, deletion is blocked.
 */
export function canDelete(status: LandingPageStatus): boolean {
  return DELETABLE_STATUSES.includes(status);
}

/**
 * Checks if a user can delete a specific landing page.
 * - PlatformMarketing can delete their OWN drafts only
 * - PlatformMarketingDirector / SuperAdmin can delete ANY draft
 */
export function canDeletePage(
  status: LandingPageStatus,
  role: PlatformRoleType | null | undefined,
  pageCreatedBy: string | null,
  currentUserId: string | null,
): boolean {
  if (!canDelete(status) || !role) return false;

  // Directors and SuperAdmins can delete any draft
  if (role === 'platform_marketing_director' || role === 'platform_super_admin') return true;

  // Marketing can delete only their own drafts
  if (role === 'platform_marketing' || role === 'platform_marketing_team') {
    return !!pageCreatedBy && !!currentUserId && pageCreatedBy === currentUserId;
  }

  return false;
}

/**
 * Validates deletion or throws.
 */
export function validateDeletion(status: LandingPageStatus): void {
  if (!canDelete(status)) {
    throw new Error(
      `Landing page com status "${status}" não pode ser excluída. ` +
      `Somente páginas em "draft" podem ser removidas.`
    );
  }
}

/**
 * Checks if a landing page can be edited in-place.
 * After approval, edits must create a NEW VERSION instead.
 */
export function canEditInPlace(status: LandingPageStatus): boolean {
  return status === 'draft' || status === 'submitted';
}

/**
 * Validates in-place editing or throws.
 */
export function validateEdit(status: LandingPageStatus): void {
  if (!canEditInPlace(status)) {
    throw new Error(
      `Landing page com status "${status}" não pode ser editada diretamente. ` +
      `Alterações após aprovação devem criar uma nova versão.`
    );
  }
}

/**
 * Get human-readable label for a status.
 */
export function getStatusLabel(status: LandingPageStatus): string {
  const labels: Record<LandingPageStatus, string> = {
    draft: 'Rascunho',
    submitted: 'Aguardando Aprovação',
    approved: 'Aprovada',
    published: 'Publicada',
    archived: 'Arquivada',
  };
  return labels[status] ?? status;
}

/**
 * Get badge color variant for a status.
 */
export function getStatusVariant(status: LandingPageStatus | LandingVersionStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'outline',
    submitted: 'secondary',
    approved: 'default',
    published: 'default',
    archived: 'destructive',
    superseded: 'secondary',
  };
  return variants[status] ?? 'outline';
}

/**
 * Get human-readable label for version statuses (includes superseded).
 */
export function getVersionStatusLabel(status: LandingVersionStatus): string {
  const labels: Record<LandingVersionStatus, string> = {
    draft: 'Rascunho',
    submitted: 'Aguardando Aprovação',
    approved: 'Aprovada',
    published: 'Publicada (Ativa)',
    superseded: 'Substituída',
  };
  return labels[status] ?? status;
}

// ═══════════════════════════════════
// Version Transition Matrix
// ═══════════════════════════════════

const VERSION_TRANSITION_MAP: Record<LandingVersionStatus, TransitionRule[]> = {
  draft: [
    { to: 'submitted', requiredPermission: 'landing.submit_for_review', label: 'Submeter versão para revisão' },
  ],
  submitted: [
    { to: 'approved', requiredPermission: 'landing.approve', label: 'Aprovar versão' },
    { to: 'draft', requiredPermission: 'landing.reject', label: 'Rejeitar versão' },
  ],
  approved: [
    { to: 'published', requiredPermission: 'landing.publish', label: 'Publicar versão' },
  ],
  published: [],
  superseded: [], // terminal state — no transitions out
};

/**
 * Returns valid transitions for a VERSION (not the parent page).
 */
export function getVersionTransitions(
  currentStatus: LandingVersionStatus,
  role: PlatformRoleType | null | undefined,
): TransitionRule[] {
  if (!role) return [];
  const rules = VERSION_TRANSITION_MAP[currentStatus] ?? [];
  return rules.filter(r => hasPlatformPermission(role, r.requiredPermission));
}

/**
 * Checks if a version needs creation instead of in-place editing.
 * Returns true when the parent LP status blocks direct edits.
 */
export function requiresNewVersion(parentStatus: LandingPageStatus): boolean {
  return !canEditInPlace(parentStatus);
}
