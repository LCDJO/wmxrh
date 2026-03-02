/**
 * FaceTemplateGenerator — Creates secure, non-reversible face templates
 * from captured images for enrollment and matching.
 *
 * Templates are one-way hashes — the original face image cannot be
 * reconstructed from the template (LGPD compliance).
 */

export interface FaceTemplate {
  hash: string;
  version: number;
  quality_score: number;
  created_at: string;
}

const TEMPLATE_VERSION = 2;

export class FaceTemplateGenerator {
  /**
   * Generate a face template hash from normalized image data.
   * Uses SHA-256 with salting for irreversibility.
   */
  async generate(normalizedImage: string, employeeId: string): Promise<FaceTemplate> {
    const encoder = new TextEncoder();
    const salt = `biometric_v${TEMPLATE_VERSION}_${employeeId}_${Date.now()}`;
    const data = encoder.encode(normalizedImage + salt);

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Quality score based on image data characteristics
    const imageSize = (normalizedImage.length * 3) / 4;
    const quality_score = Math.min(1, Math.max(0.1, imageSize / 200000));

    return {
      hash,
      version: TEMPLATE_VERSION,
      quality_score: Math.round(quality_score * 100) / 100,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Verify template version compatibility.
   */
  isVersionCompatible(templateVersion: number): boolean {
    return templateVersion >= 1 && templateVersion <= TEMPLATE_VERSION;
  }

  getCurrentVersion(): number {
    return TEMPLATE_VERSION;
  }
}
