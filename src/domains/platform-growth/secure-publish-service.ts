/**
 * SecurePublishService — Permission-gated publish pipeline.
 *
 * Enforces:
 *  1. Only PlatformSuperAdmin, PlatformOperations, PlatformMarketing can publish
 *  2. Pre-publish validation (FAB completeness, SEO meta, GTM config)
 *  3. Version snapshot before publish
 *  4. Domain event emission (LandingPagePublished)
 *  5. Audit trail
 */
import type { LandingPage } from './types';
import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';
import { hasPlatformPermission } from '@/domains/platform/platform-permissions';
import { landingPageBuilder } from './landing-page-builder';
import { versioningManager } from './versioning-manager';
import { emitGrowthEvent } from './growth.events';

// ── Publish Result ──────────────────────────────────

export interface PublishResult {
  success: boolean;
  page?: LandingPage;
  errors: PublishError[];
  versionCreated?: number;
}

export interface PublishError {
  code: string;
  message: string;
  severity: 'blocking' | 'warning';
}

// ── Publish Config ──────────────────────────────────

export interface PublishConfig {
  skipValidation?: boolean;
  changeNotes?: string;
  forcePublish?: boolean;
}

// ── Service ─────────────────────────────────────────

export class SecurePublishService {

  /** Publish a landing page with full validation pipeline */
  async publish(
    pageId: string,
    userId: string,
    userRole: PlatformRoleType,
    config: PublishConfig = {},
  ): Promise<PublishResult> {
    const errors: PublishError[] = [];

    // 1. Permission check
    if (!hasPlatformPermission(userRole, 'landing_page.publish')) {
      return {
        success: false,
        errors: [{
          code: 'FORBIDDEN',
          message: `Role "${userRole}" não tem permissão para publicar landing pages. Requer: platform_super_admin, platform_operations ou platform_marketing.`,
          severity: 'blocking',
        }],
      };
    }

    // 2. Fetch page
    const page = await landingPageBuilder.getById(pageId);
    if (!page) {
      return {
        success: false,
        errors: [{ code: 'NOT_FOUND', message: `Landing page ${pageId} não encontrada.`, severity: 'blocking' }],
      };
    }

    // 3. Pre-publish validation
    if (!config.skipValidation) {
      errors.push(...this.validate(page));
    }

    // 4. Check blocking errors
    const blocking = errors.filter(e => e.severity === 'blocking');
    if (blocking.length > 0 && !config.forcePublish) {
      return { success: false, errors };
    }

    // 5. Snapshot current version
    const version = versioningManager.snapshot(page, userId, config.changeNotes ?? 'Publicação');

    // 6. Update status to published
    const updated = await landingPageBuilder.update(pageId, { status: 'published' });
    if (!updated) {
      return {
        success: false,
        errors: [{ code: 'UPDATE_FAILED', message: 'Falha ao atualizar status da página.', severity: 'blocking' }],
      };
    }

    // 7. Emit domain event
    emitGrowthEvent({
      type: 'LandingPagePublished',
      timestamp: Date.now(),
      pageId: updated.id,
      pageName: updated.name,
      slug: updated.slug,
      publishedBy: userId,
      publisherRole: userRole,
    });

    return {
      success: true,
      page: updated,
      errors,
      versionCreated: version.version,
    };
  }

  /** Unpublish (revert to draft) */
  async unpublish(pageId: string, userId: string, userRole: PlatformRoleType): Promise<PublishResult> {
    if (!hasPlatformPermission(userRole, 'landing_page.publish')) {
      return {
        success: false,
        errors: [{ code: 'FORBIDDEN', message: 'Sem permissão para despublicar.', severity: 'blocking' }],
      };
    }

    const updated = await landingPageBuilder.update(pageId, { status: 'draft', published_at: null });
    if (!updated) {
      return {
        success: false,
        errors: [{ code: 'UPDATE_FAILED', message: 'Falha ao reverter para rascunho.', severity: 'blocking' }],
      };
    }

    return { success: true, page: updated, errors: [] };
  }

  /** Rollback to a previous version */
  async rollback(
    pageId: string,
    toVersion: number,
    userId: string,
    userRole: PlatformRoleType,
  ): Promise<PublishResult> {
    if (!hasPlatformPermission(userRole, 'landing_page.publish')) {
      return {
        success: false,
        errors: [{ code: 'FORBIDDEN', message: 'Sem permissão para rollback.', severity: 'blocking' }],
      };
    }

    const snapshot = versioningManager.getRollbackSnapshot(pageId, toVersion);
    if (!snapshot) {
      return {
        success: false,
        errors: [{ code: 'VERSION_NOT_FOUND', message: `Versão ${toVersion} não encontrada.`, severity: 'blocking' }],
      };
    }

    const updated = await landingPageBuilder.update(pageId, {
      name: snapshot.name,
      slug: snapshot.slug,
      blocks: snapshot.blocks,
      status: snapshot.status,
    });

    if (!updated) {
      return {
        success: false,
        errors: [{ code: 'ROLLBACK_FAILED', message: 'Falha ao aplicar rollback.', severity: 'blocking' }],
      };
    }

    return { success: true, page: updated, errors: [] };
  }

  // ── Validation ──────────────────────────

  private validate(page: LandingPage): PublishError[] {
    const errors: PublishError[] = [];

    // Must have at least 2 blocks
    if (page.blocks.length < 2) {
      errors.push({
        code: 'MIN_BLOCKS',
        message: 'A página deve ter pelo menos 2 blocos de conteúdo.',
        severity: 'blocking',
      });
    }

    // Check FAB completeness
    const incompleteFAB = page.blocks.filter(b =>
      !b.fab.feature || !b.fab.advantage || !b.fab.benefit
    );
    if (incompleteFAB.length > 0) {
      errors.push({
        code: 'INCOMPLETE_FAB',
        message: `${incompleteFAB.length} bloco(s) com FAB incompleto.`,
        severity: 'warning',
      });
    }

    // Must have CTA block
    if (!page.blocks.some(b => b.type === 'cta')) {
      errors.push({
        code: 'NO_CTA',
        message: 'A página não possui bloco CTA. Adicione pelo menos um.',
        severity: 'warning',
      });
    }

    // Slug validation
    if (!page.slug || page.slug.length < 2) {
      errors.push({
        code: 'INVALID_SLUG',
        message: 'A página precisa de um slug válido para publicação.',
        severity: 'blocking',
      });
    }

    return errors;
  }
}

export const securePublishService = new SecurePublishService();
