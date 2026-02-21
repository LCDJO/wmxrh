/**
 * LandingPageGovernanceEngine — Controls the full lifecycle of landing page
 * approval workflows at the platform level.
 *
 * Flow: draft → submit (pending_review) → approve/reject → publish
 *
 * Security: Every state transition checks PlatformPermissions.
 * Audit: Every action is logged to landing_page_governance_logs and emits platform events.
 */
import { supabase } from '@/integrations/supabase/client';
import { hasPlatformPermission } from '@/domains/platform/platform-permissions';
import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';
import type { PlatformPermission } from '@/domains/platform/platform-permissions';
import { platformEvents } from '@/domains/platform/platform-events';
import { securePublishService } from './secure-publish-service';
import { emitGrowthEvent } from './growth.events';

// ═══════════════════════════════════
// Types
// ═══════════════════════════════════

export type GovernanceStatus = 'pending_review' | 'approved' | 'rejected' | 'published' | 'cancelled';

export interface ApprovalRequest {
  id: string;
  landing_page_id: string;
  status: GovernanceStatus;
  submitted_by: string;
  submitted_by_user_id: string;
  submitted_at: string;
  submission_notes: string | null;
  reviewed_by: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_decision: 'approved' | 'rejected' | null;
  review_notes: string | null;
  published_by: string | null;
  published_by_user_id: string | null;
  published_at: string | null;
  page_snapshot: Record<string, unknown>;
  version_number: number;
  created_at: string;
  updated_at: string;
}

/**
 * LandingApproval — Simplified entity view matching the spec:
 * id, landing_page_id, submitted_by, reviewed_by, status, review_notes, reviewed_at
 */
export interface LandingApproval {
  id: string;
  landing_page_id: string;
  submitted_by: string;
  reviewed_by: string | null;
  status: 'approved' | 'rejected';
  review_notes: string | null;
  reviewed_at: string | null;
}

export interface GovernanceLog {
  id: string;
  approval_request_id: string;
  landing_page_id: string;
  action: string;
  performed_by: string;
  performed_by_user_id: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ActorContext {
  userId: string;
  email: string;
  role: PlatformRoleType;
}

// ═══════════════════════════════════
// Permission Gate
// ═══════════════════════════════════

function requirePermission(actor: ActorContext, permission: PlatformPermission, action: string): void {
  if (!hasPlatformPermission(actor.role, permission)) {
    throw new Error(`Forbidden: role "${actor.role}" cannot ${action} (requires ${permission})`);
  }
}

// ═══════════════════════════════════
// Governance Engine
// ═══════════════════════════════════

class LandingPageGovernanceEngine {

  /**
   * Submit a landing page for review.
   * Requires: landing_page.submit
   * Creates approval request + snapshot + governance log.
   */
  async submit(
    landingPageId: string,
    actor: ActorContext,
    notes?: string,
  ): Promise<ApprovalRequest> {
    requirePermission(actor, 'landing_page.submit', 'submit landing pages for review');

    // Fetch current page content for snapshot
    const { data: page, error: pageError } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('id', landingPageId)
      .single();

    if (pageError || !page) throw new Error('Landing page not found');

    // Check no pending request exists
    const { data: existing } = await (supabase
      .from('landing_page_approval_requests') as any)
      .select('id')
      .eq('landing_page_id', landingPageId)
      .in('status', ['pending_review', 'approved'])
      .limit(1);

    if (existing && existing.length > 0) {
      throw new Error('There is already a pending or approved request for this page. Cancel it first.');
    }

    // Compute next version number
    const { count } = await (supabase
      .from('landing_page_approval_requests') as any)
      .select('*', { count: 'exact', head: true })
      .eq('landing_page_id', landingPageId);

    const versionNumber = (count ?? 0) + 1;

    // Create approval request
    const { data: request, error } = await (supabase
      .from('landing_page_approval_requests') as any)
      .insert({
        landing_page_id: landingPageId,
        status: 'pending_review',
        submitted_by: actor.email,
        submitted_by_user_id: actor.userId,
        submission_notes: notes || null,
        page_snapshot: page as unknown as Record<string, unknown>,
        version_number: versionNumber,
      })
      .select()
      .single();

    if (error || !request) throw new Error(`Failed to create approval request: ${error?.message}`);

    // Log action
    await this.log(request.id, landingPageId, 'submitted', actor, notes);

    // Update landing page status
    await supabase
      .from('landing_pages')
      .update({ status: 'pending_review' })
      .eq('id', landingPageId);

    // Emit event
    platformEvents.landingPageSubmitted(actor.userId, {
      landingPageId,
      requestId: request.id,
      pageName: page.name,
      version: versionNumber,
    });

    return request as unknown as ApprovalRequest;
  }

  /**
   * Approve a pending landing page.
   * Requires: landing_page.approve
   */
  async approve(
    requestId: string,
    actor: ActorContext,
    notes?: string,
  ): Promise<ApprovalRequest> {
    requirePermission(actor, 'landing_page.approve', 'approve landing pages');

    const request = await this.getRequest(requestId);
    if (request.status !== 'pending_review') {
      throw new Error(`Cannot approve request in "${request.status}" status`);
    }

    // Cannot approve your own submission
    if (request.submitted_by_user_id === actor.userId) {
      throw new Error('Cannot approve your own submission (segregation of duties)');
    }

    const { data, error } = await (supabase
      .from('landing_page_approval_requests') as any)
      .update({
        status: 'approved',
        reviewed_by: actor.email,
        reviewed_by_user_id: actor.userId,
        reviewed_at: new Date().toISOString(),
        review_decision: 'approved',
        review_notes: notes || null,
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw new Error(`Failed to approve: ${error.message}`);

    await this.log(requestId, request.landing_page_id, 'approved', actor, notes);

    await supabase
      .from('landing_pages')
      .update({ status: 'approved' })
      .eq('id', request.landing_page_id);

    platformEvents.landingPageApproved(actor.userId, {
      landingPageId: request.landing_page_id,
      requestId,
      approvedBy: actor.email,
    });

    // ── Auto-publish pipeline ──────────────────────────
    // Runs validation but only blocks on critical errors (warnings are tolerated).
    // Registers the approver in the audit trail + system as the publisher.
    try {
      const publishResult = await securePublishService.publish(
        request.landing_page_id,
        actor.userId,
        actor.role,
        {
          changeNotes: `Auto-publicação após aprovação por ${actor.email}`,
          forcePublish: true,        // tolerate warnings
          skipValidation: false,     // still run validation
        },
      );

      if (publishResult.success) {
        // Update governance request to published status
        const now = new Date().toISOString();
        await (supabase
          .from('landing_page_approval_requests') as any)
          .update({
            status: 'published',
            published_by: actor.email,
            published_by_user_id: actor.userId,
            published_at: now,
          })
          .eq('id', requestId);

        await this.log(requestId, request.landing_page_id, 'auto_published', actor,
          `Publicação automática após aprovação. Versão: ${publishResult.versionCreated ?? '—'}`,
        );

        // Log system actor separately for dual audit trail
        await this.log(requestId, request.landing_page_id, 'system_auto_publish', {
          userId: 'system-auto-publish',
          email: 'system@platform.internal',
          role: 'platform_super_admin' as PlatformRoleType,
        }, `Sistema executou publicação automática aprovada por ${actor.email}`);

        platformEvents.landingPagePublished(actor.userId, {
          landingPageId: request.landing_page_id,
          requestId,
          publishedBy: actor.email,
          version: request.version_number,
        });

        // Emit warnings if any
        if (publishResult.errors.length > 0) {
          emitGrowthEvent({
            type: 'LandingVersionCreated',
            timestamp: Date.now(),
            pageId: request.landing_page_id,
            pageTitle: '',
            versionNumber: publishResult.versionCreated ?? 0,
            changeSummary: `Auto-publicação com ${publishResult.errors.length} aviso(s): ${publishResult.errors.map(e => e.message).join('; ')}`,
            createdBy: actor.userId,
          });
        }
      } else {
        // Only blocking errors prevent auto-publish — log the failure
        const blockingErrors = publishResult.errors.filter(e => e.severity === 'blocking');
        await this.log(requestId, request.landing_page_id, 'auto_publish_failed', actor,
          `Falha na publicação automática: ${blockingErrors.map(e => e.message).join('; ')}`,
        );
        console.warn('[Governance] Auto-publish blocked after approval:', blockingErrors);
      }
    } catch (publishError) {
      console.error('[Governance] Auto-publish error after approval:', publishError);
      await this.log(requestId, request.landing_page_id, 'auto_publish_error', actor,
        `Erro na publicação automática: ${publishError instanceof Error ? publishError.message : String(publishError)}`,
      );
    }

    return data as unknown as ApprovalRequest;
  }

  /**
   * Reject a pending landing page.
   * Requires: landing_page.reject
   */
  async reject(
    requestId: string,
    actor: ActorContext,
    notes: string,
  ): Promise<ApprovalRequest> {
    requirePermission(actor, 'landing_page.reject', 'reject landing pages');

    if (!notes || notes.trim().length === 0) {
      throw new Error('Rejection requires a reason (notes)');
    }

    const request = await this.getRequest(requestId);
    if (request.status !== 'pending_review') {
      throw new Error(`Cannot reject request in "${request.status}" status`);
    }

    const { data, error } = await (supabase
      .from('landing_page_approval_requests') as any)
      .update({
        status: 'rejected',
        reviewed_by: actor.email,
        reviewed_by_user_id: actor.userId,
        reviewed_at: new Date().toISOString(),
        review_decision: 'rejected',
        review_notes: notes,
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw new Error(`Failed to reject: ${error.message}`);

    await this.log(requestId, request.landing_page_id, 'rejected', actor, notes);

    await supabase
      .from('landing_pages')
      .update({ status: 'draft' })
      .eq('id', request.landing_page_id);

    platformEvents.landingPageRejected(actor.userId, {
      landingPageId: request.landing_page_id,
      requestId,
      rejectedBy: actor.email,
      reason: notes,
    });

    return data as unknown as ApprovalRequest;
  }

  /**
   * Publish an approved landing page.
   * Requires: landing_page.publish
   */
  async publish(
    requestId: string,
    actor: ActorContext,
    notes?: string,
  ): Promise<ApprovalRequest> {
    requirePermission(actor, 'landing_page.publish', 'publish landing pages');

    const request = await this.getRequest(requestId);
    if (request.status !== 'approved') {
      throw new Error(`Cannot publish: request must be approved first (current: "${request.status}")`);
    }

    const now = new Date().toISOString();

    const { data, error } = await (supabase
      .from('landing_page_approval_requests') as any)
      .update({
        status: 'published',
        published_by: actor.email,
        published_by_user_id: actor.userId,
        published_at: now,
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw new Error(`Failed to publish: ${error.message}`);

    await supabase
      .from('landing_pages')
      .update({ status: 'published', published_at: now })
      .eq('id', request.landing_page_id);

    await this.log(requestId, request.landing_page_id, 'published', actor, notes);

    platformEvents.landingPagePublished(actor.userId, {
      landingPageId: request.landing_page_id,
      requestId,
      publishedBy: actor.email,
      version: request.version_number,
    });

    return data as unknown as ApprovalRequest;
  }

  /**
   * Cancel a pending/approved request.
   * Requires: landing_page.submit (submitter) or landing_page.delete (admin)
   */
  async cancel(
    requestId: string,
    actor: ActorContext,
    notes?: string,
  ): Promise<ApprovalRequest> {
    const request = await this.getRequest(requestId);

    // Only submitter or admin can cancel
    const isSubmitter = request.submitted_by_user_id === actor.userId;
    const isAdmin = hasPlatformPermission(actor.role, 'landing_page.delete');
    if (!isSubmitter && !isAdmin) {
      throw new Error('Only the original submitter or an admin can cancel a request');
    }

    if (!['pending_review', 'approved'].includes(request.status)) {
      throw new Error(`Cannot cancel request in "${request.status}" status`);
    }

    const { data, error } = await (supabase
      .from('landing_page_approval_requests') as any)
      .update({ status: 'cancelled' })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw new Error(`Failed to cancel: ${error.message}`);

    await this.log(requestId, request.landing_page_id, 'cancelled', actor, notes);

    await supabase
      .from('landing_pages')
      .update({ status: 'draft' })
      .eq('id', request.landing_page_id);

    return data as unknown as ApprovalRequest;
  }

  // ═══════════════════════════════════
  // Queries
  // ═══════════════════════════════════

  /** Get a single approval request */
  async getRequest(requestId: string): Promise<ApprovalRequest> {
    const { data, error } = await (supabase
      .from('landing_page_approval_requests') as any)
      .select('*')
      .eq('id', requestId)
      .single();

    if (error || !data) throw new Error(`Approval request not found: ${requestId}`);
    return data as unknown as ApprovalRequest;
  }

  /** List requests for a landing page */
  async listByPage(landingPageId: string): Promise<ApprovalRequest[]> {
    const { data } = await (supabase
      .from('landing_page_approval_requests') as any)
      .select('*')
      .eq('landing_page_id', landingPageId)
      .order('created_at', { ascending: false });

    return (data || []) as unknown as ApprovalRequest[];
  }

  /** List requests by status */
  async listByStatus(status: GovernanceStatus): Promise<ApprovalRequest[]> {
    const { data } = await (supabase
      .from('landing_page_approval_requests') as any)
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    return (data || []) as unknown as ApprovalRequest[];
  }

  /** Get audit trail for a request */
  async getAuditTrail(requestId: string): Promise<GovernanceLog[]> {
    const { data } = await (supabase
      .from('landing_page_governance_logs') as any)
      .select('*')
      .eq('approval_request_id', requestId)
      .order('created_at', { ascending: true });

    return (data || []) as unknown as GovernanceLog[];
  }

  /** Get pending requests count (for badges) */
  async getPendingCount(): Promise<number> {
    const { count } = await (supabase
      .from('landing_page_approval_requests') as any)
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_review');

    return count ?? 0;
  }

  // ═══════════════════════════════════
  // Private
  // ═══════════════════════════════════

  private async log(
    requestId: string,
    landingPageId: string,
    action: string,
    actor: ActorContext,
    notes?: string,
  ): Promise<void> {
    await (supabase.from('landing_page_governance_logs') as any).insert({
      approval_request_id: requestId,
      landing_page_id: landingPageId,
      action,
      performed_by: actor.email,
      performed_by_user_id: actor.userId,
      notes: notes || null,
      metadata: { role: actor.role },
    });
  }
}

export const landingPageGovernance = new LandingPageGovernanceEngine();
export { LandingPageGovernanceEngine };
