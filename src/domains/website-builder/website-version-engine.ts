/**
 * WebsiteVersionEngine — Manages immutable version snapshots for website pages.
 *
 * Every publish creates a snapshot. Rollback restores a previous snapshot
 * and publishes it as a NEW version (never mutates history).
 */
import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════
// Types
// ═══════════════════════════════════

export interface WebsiteVersion {
  id: string;
  website_page_id: string;
  version_number: number;
  snapshot_layout: Record<string, unknown>[];
  snapshot_seo: Record<string, unknown>;
  snapshot_content: Record<string, unknown>;
  published_by: string | null;
  published_by_email: string | null;
  notes: string | null;
  is_current: boolean;
  created_at: string;
}

interface CreateVersionInput {
  websitePageId: string;
  layout: Record<string, unknown>[];
  seo: Record<string, unknown>;
  content: Record<string, unknown>;
  publishedBy: string;
  publishedByEmail: string;
  notes?: string;
}

// ═══════════════════════════════════
// Engine
// ═══════════════════════════════════

class WebsiteVersionEngine {

  /**
   * Create a new version snapshot (called on publish).
   * Marks the new version as current and un-marks the previous one.
   */
  async createVersion(input: CreateVersionInput): Promise<WebsiteVersion> {
    // Get next version number
    const { count } = await (supabase
      .from('website_versions') as any)
      .select('*', { count: 'exact', head: true })
      .eq('website_page_id', input.websitePageId);

    const nextVersion = (count ?? 0) + 1;

    // Un-mark current
    await (supabase
      .from('website_versions') as any)
      .update({ is_current: false })
      .eq('website_page_id', input.websitePageId)
      .eq('is_current', true);

    // Insert new version
    const { data, error } = await (supabase
      .from('website_versions') as any)
      .insert({
        website_page_id: input.websitePageId,
        version_number: nextVersion,
        snapshot_layout: input.layout,
        snapshot_seo: input.seo,
        snapshot_content: input.content,
        published_by: input.publishedBy,
        published_by_email: input.publishedByEmail,
        notes: input.notes || null,
        is_current: true,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create version: ${error.message}`);
    return data as unknown as WebsiteVersion;
  }

  /**
   * List all versions for a website page (newest first).
   */
  async listVersions(websitePageId: string): Promise<WebsiteVersion[]> {
    const { data } = await (supabase
      .from('website_versions') as any)
      .select('*')
      .eq('website_page_id', websitePageId)
      .order('version_number', { ascending: false });

    return (data ?? []) as unknown as WebsiteVersion[];
  }

  /**
   * Get a specific version.
   */
  async getVersion(versionId: string): Promise<WebsiteVersion> {
    const { data, error } = await (supabase
      .from('website_versions') as any)
      .select('*')
      .eq('id', versionId)
      .single();

    if (error || !data) throw new Error(`Version not found: ${versionId}`);
    return data as unknown as WebsiteVersion;
  }

  /**
   * Get the current (active) version for a page.
   */
  async getCurrentVersion(websitePageId: string): Promise<WebsiteVersion | null> {
    const { data } = await (supabase
      .from('website_versions') as any)
      .select('*')
      .eq('website_page_id', websitePageId)
      .eq('is_current', true)
      .single();

    return (data as unknown as WebsiteVersion) ?? null;
  }

  /**
   * Rollback to a previous version.
   *
   * IMPORTANT: Does NOT mutate history. Creates a NEW version
   * with the snapshot from the target version. This preserves
   * full audit trail.
   */
  async rollback(
    websitePageId: string,
    targetVersionId: string,
    actor: { userId: string; email: string },
  ): Promise<WebsiteVersion> {
    const target = await this.getVersion(targetVersionId);

    if (target.website_page_id !== websitePageId) {
      throw new Error('Version does not belong to this page');
    }

    // Create a new version from the target snapshot
    const newVersion = await this.createVersion({
      websitePageId,
      layout: target.snapshot_layout,
      seo: target.snapshot_seo,
      content: target.snapshot_content,
      publishedBy: actor.userId,
      publishedByEmail: actor.email,
      notes: `Rollback para versão ${target.version_number}`,
    });

    // Update the page content to match the restored snapshot
    await supabase
      .from('landing_pages')
      .update({
        content: target.snapshot_content,
        seo_config: target.snapshot_seo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', websitePageId);

    return newVersion;
  }

  /**
   * Compare two versions (returns diff summary).
   */
  async compareVersions(
    versionAId: string,
    versionBId: string,
  ): Promise<{ a: WebsiteVersion; b: WebsiteVersion; layoutChanged: boolean; seoChanged: boolean; contentChanged: boolean }> {
    const [a, b] = await Promise.all([
      this.getVersion(versionAId),
      this.getVersion(versionBId),
    ]);

    return {
      a,
      b,
      layoutChanged: JSON.stringify(a.snapshot_layout) !== JSON.stringify(b.snapshot_layout),
      seoChanged: JSON.stringify(a.snapshot_seo) !== JSON.stringify(b.snapshot_seo),
      contentChanged: JSON.stringify(a.snapshot_content) !== JSON.stringify(b.snapshot_content),
    };
  }
}

export const websiteVersionEngine = new WebsiteVersionEngine();
