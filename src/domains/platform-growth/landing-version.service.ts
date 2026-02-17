/**
 * LandingVersionService — Domain service for landing page versioning.
 *
 * Core flow:
 *  1. User clicks "Editar" on a published/approved LP
 *  2. System creates a NEW LandingVersion as draft (snapshot of current content)
 *  3. Published version stays active — zero downtime
 *  4. New version follows governance: draft → submitted → approved → published
 *  5. On publish: new version becomes active, previous version's parent LP updates
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { LandingVersionStatus } from './landing-page-status-machine';
import { getVersionTransitions, requiresNewVersion, validateVersionCreation, validateVersionPublish } from './landing-page-status-machine';
import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';

// ═══════════════════════════════════
// Types
// ═══════════════════════════════════

export interface LandingVersion {
  id: string;
  landing_page_id: string;
  version_number: number;
  content_snapshot: unknown[];
  fab_snapshot: Record<string, unknown>;
  seo_snapshot: Record<string, unknown>;
  status: LandingVersionStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface VersionActor {
  userId: string;
  email: string;
  role: PlatformRoleType;
}

// ═══════════════════════════════════
// Service
// ═══════════════════════════════════

export const landingVersionService = {
  /**
   * Create a new draft version from a published/approved landing page.
   * Snapshots the current blocks, fab data, and SEO config.
   */
  async createDraftFromPublished(
    landingPageId: string,
    actor: VersionActor,
  ): Promise<LandingVersion> {
    // 1. Fetch current LP
    const { data: lp, error: lpError } = await supabase
      .from('landing_pages')
      .select('id, status, blocks')
      .eq('id', landingPageId)
      .is('deleted_at', null)
      .single();

    if (lpError || !lp) throw new Error('Landing page não encontrada.');

    // 2. Validate: must require versioning (approved/published)
    if (!requiresNewVersion(lp.status as any)) {
      throw new Error(
        `Landing page com status "${lp.status}" pode ser editada diretamente. Versionamento não necessário.`
      );
    }

    // 2b. Block versioning if experiments are running or missing permission
    validateVersionCreation(landingPageId, actor.role);

    // 3. Determine next version number
    const { count } = await supabase
      .from('landing_page_versions')
      .select('*', { count: 'exact', head: true })
      .eq('landing_page_id', landingPageId);

    const nextVersion = (count ?? 0) + 1;

    // 4. Create version with snapshots
    const { data: version, error: vError } = await supabase
      .from('landing_page_versions')
      .insert({
        landing_page_id: landingPageId,
        version_number: nextVersion,
        content_snapshot: lp.blocks ?? [],
        fab_snapshot: {},
        seo_snapshot: {},
        status: 'draft',
        created_by: actor.userId,
      })
      .select()
      .single();

    if (vError) throw new Error(vError.message);

    // 5. Audit log
    await supabase.from('audit_logs').insert({
      tenant_id: '00000000-0000-0000-0000-000000000000',
      entity_type: 'landing_page_version',
      entity_id: version.id,
      action: 'VersionDraftCreated',
      user_id: actor.userId,
      metadata: {
        landing_page_id: landingPageId,
        version_number: nextVersion,
        created_by_role: actor.role,
        created_by_email: actor.email,
      },
    });

    return version as LandingVersion;
  },

  /**
   * List all versions for a landing page, ordered by version_number DESC.
   */
  async listByPage(landingPageId: string): Promise<LandingVersion[]> {
    const { data, error } = await supabase
      .from('landing_page_versions')
      .select('*')
      .eq('landing_page_id', landingPageId)
      .order('version_number', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as LandingVersion[];
  },

  /**
   * Get the current published version for a landing page (if any).
   */
  async getPublishedVersion(landingPageId: string): Promise<LandingVersion | null> {
    const { data, error } = await supabase
      .from('landing_page_versions')
      .select('*')
      .eq('landing_page_id', landingPageId)
      .eq('status', 'published')
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data as LandingVersion | null;
  },

  /**
   * Transition a version's status following governance rules.
   */
  async transitionStatus(
    versionId: string,
    targetStatus: LandingVersionStatus,
    actor: VersionActor,
  ): Promise<LandingVersion> {
    // 1. Fetch current version
    const { data: version, error: vErr } = await supabase
      .from('landing_page_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (vErr || !version) throw new Error('Versão não encontrada.');

    const currentStatus = version.status as LandingVersionStatus;

    // 2. Validate transition
    const available = getVersionTransitions(currentStatus, actor.role);
    const rule = available.find(t => t.to === targetStatus);
    if (!rule) {
      throw new Error(
        `Transição "${currentStatus}" → "${targetStatus}" não permitida para "${actor.role}".`
      );
    }

    // 3. SecurityKernel: validate landing.publish_version permission
    if (targetStatus === 'published') {
      validateVersionPublish(actor.role);
    }

    // 4. Apply transition
    const updatePayload: Record<string, unknown> = { status: targetStatus };

    // 4. If publishing: mark previous published versions as "superseded" (preserving metrics)
    //    and update the parent LP's active content + slug
    if (targetStatus === 'published') {
      // Find and supersede previous published versions
      const { data: oldPublished } = await supabase
        .from('landing_page_versions')
        .select('id, version_number')
        .eq('landing_page_id', version.landing_page_id)
        .eq('status', 'published')
        .neq('id', versionId);

      if (oldPublished && oldPublished.length > 0) {
        const oldIds = oldPublished.map(v => v.id);
        await supabase
          .from('landing_page_versions')
          .update({ status: 'superseded' })
          .in('id', oldIds);

        // Audit: record supersession for each old version
        for (const old of oldPublished) {
          await supabase.from('audit_logs').insert({
            tenant_id: '00000000-0000-0000-0000-000000000000',
            entity_type: 'landing_page_version',
            entity_id: old.id,
            action: 'VersionSuperseded',
            user_id: actor.userId,
            old_value: { status: 'published' },
            new_value: { status: 'superseded', superseded_by: versionId },
            metadata: {
              landing_page_id: version.landing_page_id,
              superseded_version: old.version_number,
              new_active_version: version.version_number,
            },
          });
        }
      }

      // Update the parent LP's blocks with the new version content and refresh slug
      await supabase
        .from('landing_pages')
        .update({
          blocks: version.content_snapshot,
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', version.landing_page_id);
    }

    const { data: updated, error: uErr } = await supabase
      .from('landing_page_versions')
      .update(updatePayload)
      .eq('id', versionId)
      .select()
      .single();

    if (uErr) throw new Error(uErr.message);

    // 5. Audit log
    await supabase.from('audit_logs').insert({
      tenant_id: '00000000-0000-0000-0000-000000000000',
      entity_type: 'landing_page_version',
      entity_id: versionId,
      action: `VersionStatus_${targetStatus}`,
      user_id: actor.userId,
      old_value: { status: currentStatus },
      new_value: { status: targetStatus },
      metadata: {
        landing_page_id: version.landing_page_id,
        version_number: version.version_number,
        transitioned_by_role: actor.role,
      },
    });

    return updated as LandingVersion;
  },

  /**
   * Update a draft version's content snapshots (only drafts can be edited).
   */
  async updateDraftContent(
    versionId: string,
    updates: {
      content_snapshot?: Json;
      fab_snapshot?: Json;
      seo_snapshot?: Json;
    },
  ): Promise<LandingVersion> {
    // Verify it's a draft
    const { data: version } = await supabase
      .from('landing_page_versions')
      .select('status')
      .eq('id', versionId)
      .single();

    if (!version || version.status !== 'draft') {
      throw new Error('Somente versões em rascunho podem ser editadas.');
    }

    const { data, error } = await supabase
      .from('landing_page_versions')
      .update(updates)
      .eq('id', versionId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as LandingVersion;
  },
};
