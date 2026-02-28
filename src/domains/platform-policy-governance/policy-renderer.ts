/**
 * PolicyRenderer — Resolves renderable policy content for UI display.
 */

import type { PolicyVersion, PlatformPolicy } from './types';
import { PolicyVersionManager } from './policy-version-manager';

export interface RenderablePolicy {
  policy: PlatformPolicy;
  version: PolicyVersion;
  contentHtml: string;
  contentPlain: string | null;
  versionLabel: string;
  effectiveDate: string | null;
}

export class PolicyRenderer {
  private versions = new PolicyVersionManager();

  async resolve(policy: PlatformPolicy): Promise<RenderablePolicy | null> {
    const version = await this.versions.getCurrent(policy.id);
    if (!version) return null;

    return {
      policy,
      version,
      contentHtml: version.content_html,
      contentPlain: version.content_plain,
      versionLabel: `v${version.version_number}`,
      effectiveDate: version.effective_from,
    };
  }
}
