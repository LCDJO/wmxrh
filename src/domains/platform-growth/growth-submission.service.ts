/**
 * GrowthSubmissionService — Handles the approval workflow for Growth content.
 *
 * Escopo: FAB content, website pages, campaigns e templates.
 *
 * ⚠️  LANDING PAGES não passam por aqui.
 *     Use `landingPageGovernance` (landing-page-governance.ts) para landing pages.
 *     Esse serviço existia antes da separação; o campo `content_type: 'landing_page'`
 *     foi removido para evitar dois trilhos de aprovação concorrentes.
 *
 * Workflow:
 *  1. Marketing Team creates content → submits for approval (status: pending)
 *  2. Director / SuperAdmin reviews → approves or rejects
 *  3. Approved content → publish (dual confirmation: approve + publish)
 *  4. Every action is logged in growth_submission_logs
 */

import { supabase } from '@/integrations/supabase/client';

export interface GrowthSubmission {
  id: string;
  content_type: string;
  content_id: string;
  content_title: string;
  content_snapshot: Record<string, unknown>;
  version_number: number;
  change_summary: string | null;
  diff_from_previous: Record<string, unknown> | null;
  submitted_by: string;
  submitted_by_email: string;
  submitted_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'published' | 'cancelled';
  reviewed_by: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  publish_approved_by: string | null;
  publish_approved_at: string | null;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmissionLog {
  id: string;
  submission_id: string;
  action: string;
  performed_by: string;
  performed_by_email: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateSubmissionInput {
  content_type: 'fab_content' | 'website_page' | 'campaign' | 'template';
  content_id: string;
  content_title: string;
  content_snapshot: Record<string, unknown>;
  change_summary?: string;
  submitted_by_email: string;
}

class GrowthSubmissionService {
  /** Submit content for approval */
  async submit(input: CreateSubmissionInput, userId: string): Promise<GrowthSubmission> {
    // Guard: landing pages têm sistema próprio
    if ((input.content_type as string) === 'landing_page') {
      throw new Error(
        'Landing pages não passam pelo GrowthSubmissionService. ' +
        'Use landingPageGovernance.submit() de landing-page-governance.ts.',
      );
    }

    // Get latest version number for this content
    const { data: existing } = await supabase
      .from('growth_submissions')
      .select('version_number, content_snapshot')
      .eq('content_id', input.content_id)
      .eq('content_type', input.content_type)
      .order('version_number', { ascending: false })
      .limit(1);

    const prevVersion = existing?.[0];
    const versionNumber = prevVersion ? prevVersion.version_number + 1 : 1;

    // Compute basic diff
    const diff = prevVersion
      ? this.computeDiff(prevVersion.content_snapshot as Record<string, unknown>, input.content_snapshot)
      : null;

    const { data, error } = await supabase
      .from('growth_submissions')
      .insert([{
        content_type: input.content_type,
        content_id: input.content_id,
        content_title: input.content_title,
        content_snapshot: input.content_snapshot as any,
        version_number: versionNumber,
        change_summary: input.change_summary || null,
        diff_from_previous: diff as any,
        submitted_by: userId,
        submitted_by_email: input.submitted_by_email,
        status: 'pending',
      }])
      .select()
      .single();

    if (error) throw error;

    // Log the submission
    await this.log(data.id, 'submitted', userId, input.submitted_by_email, input.change_summary || null, {
      version: versionNumber,
      content_type: input.content_type,
    });

    return data as unknown as GrowthSubmission;
  }

  /** Approve a submission (Director/SuperAdmin) */
  async approve(submissionId: string, userId: string, email: string, notes?: string): Promise<GrowthSubmission> {
    const { data, error } = await supabase
      .from('growth_submissions')
      .update({
        status: 'approved',
        reviewed_by: userId,
        reviewed_by_email: email,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
      })
      .eq('id', submissionId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) throw error;

    await this.log(submissionId, 'approved', userId, email, notes || null);
    return data as unknown as GrowthSubmission;
  }

  /** Reject a submission */
  async reject(submissionId: string, userId: string, email: string, notes: string): Promise<GrowthSubmission> {
    const { data, error } = await supabase
      .from('growth_submissions')
      .update({
        status: 'rejected',
        reviewed_by: userId,
        reviewed_by_email: email,
        reviewed_at: new Date().toISOString(),
        review_notes: notes,
      })
      .eq('id', submissionId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) throw error;

    await this.log(submissionId, 'rejected', userId, email, notes);
    return data as unknown as GrowthSubmission;
  }

  /** Publish approved content (dual confirmation — second approval) */
  async publish(submissionId: string, userId: string, email: string): Promise<GrowthSubmission> {
    const { data, error } = await supabase
      .from('growth_submissions')
      .update({
        status: 'published',
        publish_approved_by: userId,
        publish_approved_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        published_by: userId,
      })
      .eq('id', submissionId)
      .eq('status', 'approved')
      .select()
      .single();

    if (error) throw error;

    await this.log(submissionId, 'published', userId, email, null, { published_at: new Date().toISOString() });
    return data as unknown as GrowthSubmission;
  }

  /** Cancel a pending submission */
  async cancel(submissionId: string, userId: string, email: string): Promise<void> {
    const { error } = await supabase
      .from('growth_submissions')
      .update({ status: 'cancelled' })
      .eq('id', submissionId)
      .eq('status', 'pending');

    if (error) throw error;
    await this.log(submissionId, 'cancelled', userId, email);
  }

  /** List submissions */
  async list(filters?: { status?: string; content_type?: string }): Promise<GrowthSubmission[]> {
    let query = supabase
      .from('growth_submissions')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.content_type) query = query.eq('content_type', filters.content_type);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as GrowthSubmission[];
  }

  /** Get version history for a content */
  async getVersionHistory(contentId: string, contentType: string): Promise<GrowthSubmission[]> {
    const { data, error } = await supabase
      .from('growth_submissions')
      .select('*')
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as GrowthSubmission[];
  }

  /** Get logs for a submission */
  async getLogs(submissionId: string): Promise<SubmissionLog[]> {
    const { data, error } = await supabase
      .from('growth_submission_logs')
      .select('*')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as unknown as SubmissionLog[];
  }

  // ── Private helpers ──

  private async log(
    submissionId: string,
    action: string,
    performedBy: string,
    email: string,
    notes?: string | null,
    metadata?: Record<string, unknown>,
  ) {
    await supabase.from('growth_submission_logs').insert([{
      submission_id: submissionId,
      action,
      performed_by: performedBy,
      performed_by_email: email,
      notes: notes || null,
      metadata: (metadata || null) as any,
    }]);
  }

  private computeDiff(prev: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
    const diff: Record<string, unknown> = {};
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    for (const key of allKeys) {
      if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
        diff[key] = { from: prev[key], to: next[key] };
      }
    }
    return diff;
  }
}

export const growthSubmissionService = new GrowthSubmissionService();
