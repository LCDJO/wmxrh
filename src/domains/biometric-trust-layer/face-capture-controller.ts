/**
 * FaceCaptureController — Manages image capture, quality validation,
 * and preprocessing before template generation.
 */

export interface CaptureQualityResult {
  acceptable: boolean;
  brightness_ok: boolean;
  sharpness_ok: boolean;
  face_detected: boolean;
  face_centered: boolean;
  estimated_quality: number; // 0-1
  issues: string[];
}

const MIN_QUALITY = 0.6;

export class FaceCaptureController {
  /**
   * Validate capture quality from a base64 image.
   * In production, this delegates to a server-side ML model.
   * Client-side performs heuristic pre-checks.
   */
  validateCaptureQuality(imageData: string): CaptureQualityResult {
    const issues: string[] = [];

    // Basic validation: image exists and has reasonable size
    const sizeKb = (imageData.length * 3) / 4 / 1024;
    const brightness_ok = sizeKb > 10; // Very dark images tend to be tiny
    const sharpness_ok = sizeKb > 20;  // Blurry images compress more
    const face_detected = sizeKb > 5;  // Placeholder — real detection is server-side
    const face_centered = true;        // Validated server-side

    if (!brightness_ok) issues.push('Imagem muito escura');
    if (!sharpness_ok) issues.push('Imagem pode estar desfocada');
    if (!face_detected) issues.push('Imagem muito pequena ou vazia');

    const estimated_quality = face_detected
      ? Math.min(1, (sizeKb / 100) * 0.5 + (brightness_ok ? 0.25 : 0) + (sharpness_ok ? 0.25 : 0))
      : 0;

    return {
      acceptable: estimated_quality >= MIN_QUALITY && face_detected,
      brightness_ok,
      sharpness_ok,
      face_detected,
      face_centered,
      estimated_quality,
      issues,
    };
  }

  /**
   * Normalize the image data (strip prefix, validate base64).
   */
  normalizeImage(imageData: string): string {
    // Strip data URI prefix if present
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, '');

    // Basic base64 validation
    if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) {
      throw new Error('[FaceCaptureController] Invalid base64 image data');
    }

    return base64;
  }
}
