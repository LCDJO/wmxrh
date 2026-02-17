/**
 * WebsiteGovernanceEngine — Controls the full lifecycle of website
 * approval workflows at the platform level.
 *
 * Flow: draft → submitted → approved → published → archived
 *
 * Approval by: PlatformMarketingDirector, PlatformSuperAdmin
 *
 * Mirrors the LandingPageGovernanceEngine pattern, adapted for website entities.
 */
import { supabase } from '@/integrations/supabase/client';
import { hasPlatformPermission } from '@/domains/platform/platform-permissions';
import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';
import type { PlatformPermission } from '@/domains/platform/platform-permissions';

// ═══════════════════════════════════
// Status Definitions
// ═══════════════════════════════════

export const WEBSITE_STATUSES = ['draft', 'submitted', 'approved', 'published', 'archived'] as const;
export type WebsiteGovernanceStatus = typeof WEBSITE_STATUSES[number];

// ═══════════════════════════════════
// Transition Matrix
// ═══════════════════════════════════

interface TransitionRule {
  to: WebsiteGovernanceStatus;
  requiredPermission: PlatformPermission;
  label: string;
}

const TRANSITION_MAP: Record<WebsiteGovernanceStatus, TransitionRule[]> = {
  draft: [
    { to: 'submitted', requiredPermission: 'website.submit', label: 'Submeter para revisão' },
  ],
  submitted: [
    { to: 'approved', requiredPermission: 'website.approve', label: 'Aprovar' },
    { to: 'draft', requiredPermission: 'website.reject', label: 'Rejeitar (voltar p/ rascunho)' },
  ],
  approved: [
    { to: 'published', requiredPermission: 'website.publish', label: 'Publicar' },
  ],
  published: [
    { to: 'archived', requiredPermission: 'website.publish', label: 'Arquivar' },
  ],
  archived: [],
};

// ═══════════════════════════════════
// Machine Functions
// ═══════════════════════════════════

export function getWebsiteAvailableTransitions(
  currentStatus: WebsiteGovernanceStatus,
  role: PlatformRoleType | null | undefined,
): TransitionRule[] {
  if (!role) return [];
  const rules = TRANSITION_MAP[currentStatus] ?? [];
  return rules.filter(r => hasPlatformPermission(role, r.requiredPermission));
}

export function canWebsiteTransition(
  currentStatus: WebsiteGovernanceStatus,
  targetStatus: WebsiteGovernanceStatus,
  role: PlatformRoleType | null | undefined,
): boolean {
  return getWebsiteAvailableTransitions(currentStatus, role)
    .some(t => t.to === targetStatus);
}

export function getWebsiteStatusLabel(status: WebsiteGovernanceStatus): string {
  const labels: Record<WebsiteGovernanceStatus, string> = {
    draft: 'Rascunho',
    submitted: 'Aguardando Aprovação',
    approved: 'Aprovado',
    published: 'Publicado',
    archived: 'Arquivado',
  };
  return labels[status] ?? status;
}

export function getWebsiteStatusVariant(status: WebsiteGovernanceStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<WebsiteGovernanceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'outline',
    submitted: 'secondary',
    approved: 'default',
    published: 'default',
    archived: 'destructive',
  };
  return variants[status] ?? 'outline';
}

/** After approval, in-place edits create a new version */
export function canWebsiteEditInPlace(status: WebsiteGovernanceStatus): boolean {
  return status === 'draft' || status === 'submitted';
}

// ═══════════════════════════════════
// Actor Context
// ═══════════════════════════════════

interface ActorContext {
  userId: string;
  email: string;
  role: PlatformRoleType;
}

function requirePermission(actor: ActorContext, permission: PlatformPermission, action: string): void {
  if (!hasPlatformPermission(actor.role, permission)) {
    throw new Error(`Forbidden: role "${actor.role}" cannot ${action} (requires ${permission})`);
  }
}

// ═══════════════════════════════════
// Governance Engine
// ═══════════════════════════════════

class WebsiteGovernanceEngine {

  /**
   * Submit a website for review.
   * Requires: website.submit
   */
  async submit(
    websiteId: string,
    actor: ActorContext,
    notes?: string,
  ): Promise<void> {
    requirePermission(actor, 'website.submit', 'submit website for review');

    const { error } = await supabase
      .from('landing_pages')
      .update({ status: 'submitted', updated_at: new Date().toISOString() })
      .eq('id', websiteId);

    if (error) throw new Error(`Failed to submit website: ${error.message}`);
  }

  /**
   * Approve a submitted website.
   * Requires: website.approve
   * Cannot approve your own submission.
   */
  async approve(
    websiteId: string,
    actor: ActorContext,
    notes?: string,
  ): Promise<void> {
    requirePermission(actor, 'website.approve', 'approve website');

    const { data: page } = await supabase
      .from('landing_pages')
      .select('status, created_by')
      .eq('id', websiteId)
      .single();

    if (!page) throw new Error('Website not found');
    if (page.status !== 'submitted') {
      throw new Error(`Cannot approve website in "${page.status}" status`);
    }
    if (page.created_by === actor.userId) {
      throw new Error('Cannot approve your own submission (segregation of duties)');
    }

    const { error } = await supabase
      .from('landing_pages')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', websiteId);

    if (error) throw new Error(`Failed to approve: ${error.message}`);
  }

  /**
   * Reject a submitted website back to draft.
   * Requires: website.reject
   */
  async reject(
    websiteId: string,
    actor: ActorContext,
    notes: string,
  ): Promise<void> {
    requirePermission(actor, 'website.reject', 'reject website');

    if (!notes?.trim()) throw new Error('Rejection requires a reason');

    const { data: page } = await supabase
      .from('landing_pages')
      .select('status')
      .eq('id', websiteId)
      .single();

    if (!page) throw new Error('Website not found');
    if (page.status !== 'submitted') {
      throw new Error(`Cannot reject website in "${page.status}" status`);
    }

    const { error } = await supabase
      .from('landing_pages')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', websiteId);

    if (error) throw new Error(`Failed to reject: ${error.message}`);
  }

  /**
   * Publish an approved website.
   * Requires: website.publish
   */
  async publish(
    websiteId: string,
    actor: ActorContext,
    notes?: string,
  ): Promise<void> {
    requirePermission(actor, 'website.publish', 'publish website');

    const { data: page } = await supabase
      .from('landing_pages')
      .select('status')
      .eq('id', websiteId)
      .single();

    if (!page) throw new Error('Website not found');
    if (page.status !== 'approved') {
      throw new Error(`Cannot publish: website must be approved first (current: "${page.status}")`);
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('landing_pages')
      .update({ status: 'published', published_at: now, updated_at: now })
      .eq('id', websiteId);

    if (error) throw new Error(`Failed to publish: ${error.message}`);
  }

  /**
   * Archive a published website.
   * Requires: website.publish
   */
  async archive(
    websiteId: string,
    actor: ActorContext,
    notes?: string,
  ): Promise<void> {
    requirePermission(actor, 'website.publish', 'archive website');

    const { data: page } = await supabase
      .from('landing_pages')
      .select('status')
      .eq('id', websiteId)
      .single();

    if (!page) throw new Error('Website not found');
    if (page.status !== 'published') {
      throw new Error(`Cannot archive: website must be published (current: "${page.status}")`);
    }

    const { error } = await supabase
      .from('landing_pages')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', websiteId);

    if (error) throw new Error(`Failed to archive: ${error.message}`);
  }
}

export const websiteGovernance = new WebsiteGovernanceEngine();
