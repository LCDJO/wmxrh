/**
 * LandingVersionService — DB-backed mandatory versioning.
 *
 * Rules:
 *  1. Every publish creates an immutable version snapshot
 *  2. Editing an approved/published page creates a NEW draft version
 *  3. Versions are immutable once created
 */
import { supabase } from '@/integrations/supabase/client';
import type { LandingPage } from './types';

export interface LandingVersion {
  id: string;
  landing_page_id: string;
  version_number: number;
  content_snapshot: Record<string, unknown>;
  status: 'draft' | 'approved' | 'published';
  created_by: string | null;
  created_at: string;
  change_notes: string | null;
}

export class LandingVersionService {
  /** Create a version snapshot for a landing page */
  async createVersion(
    page: LandingPage,
    createdBy: string,
    status: 'draft' | 'approved' | 'published' = 'draft',
    changeNotes?: string,
  ): Promise<LandingVersion | null> {
    const nextVersion = await this.getNextVersionNumber(page.id);

    const snapshot = {
      name: page.name,
      slug: page.slug,
      blocks: page.blocks,
      status: page.status,
      target_plan_id: page.target_plan_id,
      referral_program_id: page.referral_program_id,
      gtm_container_id: page.gtm_container_id,
    };

    const { data, error } = await (supabase
      .from('landing_versions') as any)
      .insert({
        landing_page_id: page.id,
        version_number: nextVersion,
        content_snapshot: snapshot,
        status,
        created_by: createdBy,
        change_notes: changeNotes ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('[LandingVersionService] createVersion error:', error);
      return null;
    }

    return this.rowToVersion(data);
  }

  /**
   * Handle edit-after-approval: creates a new draft version with changes
   * and resets the main page to draft status.
   */
  async createDraftFromApproved(
    page: LandingPage,
    changes: Partial<LandingPage>,
    createdBy: string,
  ): Promise<LandingVersion | null> {
    // Snapshot the approved state first
    await this.createVersion(page, createdBy, 'approved', 'Snapshot antes de edição pós-aprovação');

    // Merge changes into page for the new draft snapshot
    const draftPage: LandingPage = {
      ...page,
      ...changes,
      status: 'draft',
    };

    return this.createVersion(draftPage, createdBy, 'draft', 'Nova versão draft após edição pós-aprovação');
  }

  /** Get all versions for a landing page */
  async getVersions(landingPageId: string): Promise<LandingVersion[]> {
    const { data, error } = await supabase
      .from('landing_versions')
      .select('*')
      .eq('landing_page_id', landingPageId)
      .order('version_number', { ascending: false });

    if (error) {
      console.error('[LandingVersionService] getVersions error:', error);
      return [];
    }

    return (data ?? []).map(this.rowToVersion);
  }

  /** Get a specific version */
  async getVersion(landingPageId: string, versionNumber: number): Promise<LandingVersion | null> {
    const { data, error } = await supabase
      .from('landing_versions')
      .select('*')
      .eq('landing_page_id', landingPageId)
      .eq('version_number', versionNumber)
      .maybeSingle();

    if (error || !data) return null;
    return this.rowToVersion(data);
  }

  /** Get the latest version */
  async getLatest(landingPageId: string): Promise<LandingVersion | null> {
    const { data, error } = await supabase
      .from('landing_versions')
      .select('*')
      .eq('landing_page_id', landingPageId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return this.rowToVersion(data);
  }

  /** Get the next version number */
  private async getNextVersionNumber(landingPageId: string): Promise<number> {
    const latest = await this.getLatest(landingPageId);
    return (latest?.version_number ?? 0) + 1;
  }

  private rowToVersion(row: Record<string, unknown>): LandingVersion {
    return {
      id: row.id as string,
      landing_page_id: row.landing_page_id as string,
      version_number: row.version_number as number,
      content_snapshot: (row.content_snapshot ?? {}) as Record<string, unknown>,
      status: row.status as 'draft' | 'approved' | 'published',
      created_by: (row.created_by as string) ?? null,
      created_at: row.created_at as string,
      change_notes: (row.change_notes as string) ?? null,
    };
  }
}

export const landingVersionService = new LandingVersionService();
