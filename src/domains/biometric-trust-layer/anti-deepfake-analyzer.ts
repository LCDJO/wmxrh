/**
 * AntiDeepfakeAnalyzer — Detects AI-generated or manipulated face images.
 *
 * Three analysis pillars:
 *  1. Texture Analysis     — Micro-texture, frequency domain, GAN fingerprints
 *  2. Lighting Consistency — Shadow direction, specular highlights, ambient coherence
 *  3. 3D Motion Analysis   — Depth estimation, parallax consistency, rigid body check
 *
 * Integrated into LivenessDetectionService as Layer 4.
 */

// ── Deepfake signal types ──────────────────────────────────────

export type DeepfakeSignal =
  | 'gan_artifact'
  | 'frequency_anomaly'
  | 'texture_smoothing'
  | 'boundary_blending'
  | 'shadow_inconsistency'
  | 'specular_mismatch'
  | 'ambient_incoherence'
  | 'chromatic_aberration_missing'
  | 'depth_flat'
  | 'parallax_absent'
  | 'rigid_body_violation'
  | 'temporal_flicker'
  | 'skin_pore_absence'
  | 'eye_reflection_mismatch';

export interface DeepfakeAnalysisResult {
  is_deepfake: boolean;
  confidence: number;          // 0–1, how confident we are it's a deepfake
  texture_score: number;       // 0–1, 1 = natural
  lighting_score: number;      // 0–1, 1 = consistent
  motion_3d_score: number;     // 0–1, 1 = real 3D motion
  signals: DeepfakeSignal[];
  processing_time_ms: number;
}

// ── Thresholds ─────────────────────────────────────────────────

const DEEPFAKE_THRESHOLD = 0.55;          // Above = likely deepfake
const TEXTURE_NATURAL_THRESHOLD = 0.5;
const LIGHTING_CONSISTENT_THRESHOLD = 0.5;
const MOTION_3D_THRESHOLD = 0.4;

// ── Analyzer ──────────────────────────────────────────────────

export class AntiDeepfakeAnalyzer {

  /**
   * Full deepfake analysis pipeline.
   */
  analyze(imageData: string, previousFrameData?: string): DeepfakeAnalysisResult {
    const start = performance.now();
    const signals: DeepfakeSignal[] = [];

    // ═══ Pillar 1: Texture Analysis ══════════════════════════
    const texture = this.analyzeTexture(imageData);
    signals.push(...texture.signals);

    // ═══ Pillar 2: Lighting Consistency ══════════════════════
    const lighting = this.analyzeLighting(imageData);
    signals.push(...lighting.signals);

    // ═══ Pillar 3: 3D Motion Analysis ════════════════════════
    const motion = this.analyzeMotion3D(imageData, previousFrameData);
    signals.push(...motion.signals);

    // ═══ Combined deepfake probability ═══════════════════════
    const deepfakeProb = (
      (1 - texture.score) * 0.40 +
      (1 - lighting.score) * 0.30 +
      (1 - motion.score) * 0.30
    );

    return {
      is_deepfake: deepfakeProb >= DEEPFAKE_THRESHOLD,
      confidence: Math.round(deepfakeProb * 10000) / 10000,
      texture_score: Math.round(texture.score * 10000) / 10000,
      lighting_score: Math.round(lighting.score * 10000) / 10000,
      motion_3d_score: Math.round(motion.score * 10000) / 10000,
      signals,
      processing_time_ms: Math.round(performance.now() - start),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PILLAR 1: TEXTURE ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  private analyzeTexture(imageData: string): { score: number; signals: DeepfakeSignal[] } {
    const signals: DeepfakeSignal[] = [];
    let score = 1.0;

    // 1a. GAN artifact detection — GANs produce characteristic high-frequency noise
    const ganScore = this.detectGANFingerprint(imageData);
    if (ganScore > 0.5) {
      signals.push('gan_artifact');
      score -= ganScore * 0.35;
    }

    // 1b. Frequency domain analysis — deepfakes lack natural frequency distribution
    const freqScore = this.analyzeFrequencyDomain(imageData);
    if (freqScore < TEXTURE_NATURAL_THRESHOLD) {
      signals.push('frequency_anomaly');
      score -= (1 - freqScore) * 0.25;
    }

    // 1c. Over-smoothing detection — GANs often over-smooth skin
    const smoothScore = this.detectOverSmoothing(imageData);
    if (smoothScore > 0.5) {
      signals.push('texture_smoothing');
      score -= smoothScore * 0.2;
    }

    // 1d. Skin pore analysis — real faces have visible pores at close range
    const poreScore = this.detectSkinPores(imageData);
    if (poreScore < 0.3) {
      signals.push('skin_pore_absence');
      score -= 0.15;
    }

    // 1e. Face boundary blending — deepfakes show artifacts at face-background boundary
    const blendScore = this.detectBoundaryBlending(imageData);
    if (blendScore > 0.5) {
      signals.push('boundary_blending');
      score -= blendScore * 0.15;
    }

    return { score: Math.max(0, score), signals };
  }

  // ═══════════════════════════════════════════════════════════════
  // PILLAR 2: LIGHTING CONSISTENCY
  // ═══════════════════════════════════════════════════════════════

  private analyzeLighting(imageData: string): { score: number; signals: DeepfakeSignal[] } {
    const signals: DeepfakeSignal[] = [];
    let score = 1.0;

    // 2a. Shadow direction consistency — all shadows should agree on light source
    const shadowScore = this.analyzeShadowDirection(imageData);
    if (shadowScore < LIGHTING_CONSISTENT_THRESHOLD) {
      signals.push('shadow_inconsistency');
      score -= (1 - shadowScore) * 0.35;
    }

    // 2b. Specular highlight analysis — eye/skin reflections should match environment
    const specularScore = this.analyzeSpecularHighlights(imageData);
    if (specularScore < 0.4) {
      signals.push('specular_mismatch');
      score -= (1 - specularScore) * 0.25;
    }

    // 2c. Ambient light coherence — face and background should share same lighting
    const ambientScore = this.analyzeAmbientCoherence(imageData);
    if (ambientScore < 0.4) {
      signals.push('ambient_incoherence');
      score -= (1 - ambientScore) * 0.2;
    }

    // 2d. Chromatic aberration — real camera lenses produce subtle color fringing
    const chromaticScore = this.detectChromaticAberration(imageData);
    if (chromaticScore < 0.2) {
      signals.push('chromatic_aberration_missing');
      score -= 0.1;
    }

    // 2e. Eye reflection consistency — corneal reflections must match between eyes
    const eyeReflectionScore = this.analyzeEyeReflections(imageData);
    if (eyeReflectionScore < 0.4) {
      signals.push('eye_reflection_mismatch');
      score -= (1 - eyeReflectionScore) * 0.2;
    }

    return { score: Math.max(0, score), signals };
  }

  // ═══════════════════════════════════════════════════════════════
  // PILLAR 3: 3D MOTION ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  private analyzeMotion3D(imageData: string, previousFrameData?: string): { score: number; signals: DeepfakeSignal[] } {
    const signals: DeepfakeSignal[] = [];

    // No previous frame → can only do static depth estimation
    if (!previousFrameData) {
      const depthScore = this.estimateDepthPlausibility(imageData);
      if (depthScore < MOTION_3D_THRESHOLD) {
        signals.push('depth_flat');
      }
      return { score: Math.max(0.3, depthScore), signals };
    }

    let score = 1.0;

    // 3a. Depth plausibility — face should exhibit 3D depth (nose, eyes, chin)
    const depthScore = this.estimateDepthPlausibility(imageData);
    if (depthScore < MOTION_3D_THRESHOLD) {
      signals.push('depth_flat');
      score -= (1 - depthScore) * 0.3;
    }

    // 3b. Parallax consistency — different face parts should move at different rates
    const parallaxScore = this.analyzeParallax(imageData, previousFrameData);
    if (parallaxScore < 0.4) {
      signals.push('parallax_absent');
      score -= (1 - parallaxScore) * 0.3;
    }

    // 3c. Rigid body constraint — face should move as connected 3D object
    const rigidScore = this.analyzeRigidBody(imageData, previousFrameData);
    if (rigidScore < 0.4) {
      signals.push('rigid_body_violation');
      score -= (1 - rigidScore) * 0.2;
    }

    // 3d. Temporal consistency — no frame-to-frame flicker or warping
    const temporalScore = this.analyzeTemporalConsistency(imageData, previousFrameData);
    if (temporalScore < 0.5) {
      signals.push('temporal_flicker');
      score -= (1 - temporalScore) * 0.2;
    }

    return { score: Math.max(0, score), signals };
  }

  // ═══════════════════════════════════════════════════════════════
  // HEURISTIC SUB-ANALYZERS
  // (Production: replace with ML models — ONNX inference)
  // ═══════════════════════════════════════════════════════════════

  // -- Texture --

  private detectGANFingerprint(imageData: string): number {
    // GANs produce periodic artifacts in frequency space
    // Heuristic: detect periodic patterns in data chunks
    const chunk = imageData.slice(500, 2500);
    let periodic = 0;
    for (let i = 0; i < chunk.length - 6; i++) {
      if (chunk[i] === chunk[i + 3] && chunk[i + 1] === chunk[i + 4] && chunk[i + 2] === chunk[i + 5]) {
        periodic++;
      }
    }
    return Math.min(1, periodic / (chunk.length * 0.08));
  }

  private analyzeFrequencyDomain(imageData: string): number {
    // Natural images have smooth frequency fall-off; deepfakes have spectral gaps
    const sample = imageData.slice(0, 3000);
    const freqs = new Float32Array(64);
    for (let i = 0; i < sample.length; i++) {
      freqs[sample.charCodeAt(i) % 64]++;
    }
    // Measure smoothness of distribution
    let variance = 0;
    const mean = sample.length / 64;
    for (let i = 0; i < 64; i++) {
      variance += (freqs[i] - mean) ** 2;
    }
    variance /= 64;
    const cv = Math.sqrt(variance) / mean;
    return Math.max(0, 1 - cv * 0.5);
  }

  private detectOverSmoothing(imageData: string): number {
    // Over-smoothed images have low local variance
    const sample = imageData.slice(200, 2200);
    let localVariance = 0;
    for (let i = 1; i < sample.length; i++) {
      localVariance += Math.abs(sample.charCodeAt(i) - sample.charCodeAt(i - 1));
    }
    const avgVar = localVariance / sample.length;
    // Low avg variance = over-smoothed
    return avgVar < 8 ? 0.8 : avgVar < 12 ? 0.4 : 0.1;
  }

  private detectSkinPores(imageData: string): number {
    // Real skin at close range shows high-frequency micro-texture (pores)
    // Heuristic: measure high-frequency content in image data
    const sample = imageData.slice(1000, 3000);
    let highFreq = 0;
    for (let i = 2; i < sample.length; i++) {
      const d2 = Math.abs(sample.charCodeAt(i) - 2 * sample.charCodeAt(i - 1) + sample.charCodeAt(i - 2));
      if (d2 > 15) highFreq++;
    }
    return Math.min(1, highFreq / (sample.length * 0.15));
  }

  private detectBoundaryBlending(imageData: string): number {
    // Deepfakes show blurring/artifacts at face-background boundary
    // Heuristic: detect smooth-to-sharp transitions
    const edge = imageData.slice(0, 500);
    let transitions = 0;
    for (let i = 1; i < edge.length - 1; i++) {
      const prev = Math.abs(edge.charCodeAt(i) - edge.charCodeAt(i - 1));
      const next = Math.abs(edge.charCodeAt(i + 1) - edge.charCodeAt(i));
      if ((prev < 3 && next > 20) || (prev > 20 && next < 3)) {
        transitions++;
      }
    }
    return Math.min(1, transitions / (edge.length * 0.05));
  }

  // -- Lighting --

  private analyzeShadowDirection(imageData: string): number {
    // Split image into quadrants and compare brightness gradients
    const len = imageData.length;
    const q1 = this.avgBrightness(imageData.slice(0, len / 4));
    const q2 = this.avgBrightness(imageData.slice(len / 4, len / 2));
    const q3 = this.avgBrightness(imageData.slice(len / 2, (3 * len) / 4));
    const q4 = this.avgBrightness(imageData.slice((3 * len) / 4));
    // Natural: smooth gradient; deepfake: inconsistent jumps
    const gradientSmooth = 1 - (Math.abs(q1 - q2) + Math.abs(q3 - q4)) / 200;
    return Math.max(0, Math.min(1, gradientSmooth));
  }

  private analyzeSpecularHighlights(imageData: string): number {
    // Count specular peaks — real faces have consistent highlight positions
    const sample = imageData.slice(500, 3000);
    let peaks = 0;
    let peakPositions: number[] = [];
    for (let i = 1; i < sample.length - 1; i++) {
      const val = sample.charCodeAt(i);
      if (val > sample.charCodeAt(i - 1) && val > sample.charCodeAt(i + 1) && val > 100) {
        peaks++;
        peakPositions.push(i);
      }
    }
    // Consistent spacing = natural; random = suspicious
    if (peakPositions.length < 2) return 0.5;
    const spacings = [];
    for (let i = 1; i < Math.min(peakPositions.length, 10); i++) {
      spacings.push(peakPositions[i] - peakPositions[i - 1]);
    }
    const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
    const spacingVar = spacings.reduce((s, v) => s + (v - avgSpacing) ** 2, 0) / spacings.length;
    return Math.max(0, 1 - Math.sqrt(spacingVar) / avgSpacing);
  }

  private analyzeAmbientCoherence(imageData: string): number {
    // Face region brightness should correlate with background brightness
    const faceRegion = imageData.slice(imageData.length * 0.3, imageData.length * 0.7);
    const bgRegion = imageData.slice(0, imageData.length * 0.15) + imageData.slice(imageData.length * 0.85);
    const faceBright = this.avgBrightness(faceRegion);
    const bgBright = this.avgBrightness(bgRegion);
    const diff = Math.abs(faceBright - bgBright);
    return Math.max(0, 1 - diff / 50);
  }

  private detectChromaticAberration(imageData: string): number {
    // Real camera lenses produce subtle color fringing at edges
    // Heuristic: measure variation at image boundaries
    const edge = imageData.slice(0, 300);
    let variation = 0;
    for (let i = 1; i < edge.length; i++) {
      variation += Math.abs(edge.charCodeAt(i) - edge.charCodeAt(i - 1));
    }
    return Math.min(1, (variation / edge.length) / 20);
  }

  private analyzeEyeReflections(imageData: string): number {
    // Corneal reflections in both eyes should show same light source
    // Heuristic: compare symmetry in two sections of the image
    const mid = Math.floor(imageData.length / 2);
    const leftEye = imageData.slice(mid * 0.3, mid * 0.5);
    const rightEye = imageData.slice(mid * 0.5, mid * 0.7);
    let similarity = 0;
    const len = Math.min(leftEye.length, rightEye.length);
    for (let i = 0; i < len; i++) {
      similarity += 1 - Math.abs(leftEye.charCodeAt(i) - rightEye.charCodeAt(i)) / 128;
    }
    return Math.max(0, similarity / len);
  }

  // -- 3D Motion --

  private estimateDepthPlausibility(imageData: string): number {
    // Real faces have depth variation (nose protrudes, eyes recessed)
    // Heuristic: measure brightness gradient from center outward
    const center = imageData.slice(imageData.length * 0.4, imageData.length * 0.6);
    const outer = imageData.slice(0, imageData.length * 0.1);
    const centerBright = this.avgBrightness(center);
    const outerBright = this.avgBrightness(outer);
    const depthGradient = Math.abs(centerBright - outerBright);
    return Math.min(1, depthGradient / 15);
  }

  private analyzeParallax(current: string, previous: string): number {
    // Different face parts should move at different rates during head rotation
    const regions = 4;
    const regionSize = Math.min(current.length, previous.length) / regions;
    const displacements: number[] = [];

    for (let r = 0; r < regions; r++) {
      const start = Math.floor(r * regionSize);
      const end = Math.floor(start + regionSize * 0.5);
      let displacement = 0;
      for (let i = start; i < end && i < current.length && i < previous.length; i++) {
        displacement += Math.abs(current.charCodeAt(i) - previous.charCodeAt(i));
      }
      displacements.push(displacement / (end - start));
    }

    // Parallax = regions should have DIFFERENT displacement magnitudes
    const avg = displacements.reduce((a, b) => a + b, 0) / regions;
    if (avg < 1) return 0.3; // No motion at all
    const variance = displacements.reduce((s, d) => s + (d - avg) ** 2, 0) / regions;
    return Math.min(1, Math.sqrt(variance) / avg);
  }

  private analyzeRigidBody(current: string, previous: string): number {
    // Face parts should maintain relative positions (rigid body constraint)
    const sampleLen = Math.min(current.length, previous.length, 2000);
    let consistentMotion = 0;
    let totalPairs = 0;

    for (let i = 10; i < sampleLen - 10; i += 20) {
      const d1 = current.charCodeAt(i) - previous.charCodeAt(i);
      const d2 = current.charCodeAt(i + 5) - previous.charCodeAt(i + 5);
      if (Math.abs(d1 - d2) < 10) consistentMotion++;
      totalPairs++;
    }

    return totalPairs > 0 ? consistentMotion / totalPairs : 0.5;
  }

  private analyzeTemporalConsistency(current: string, previous: string): number {
    // Deepfakes may show frame-to-frame flicker or warping
    const sampleLen = Math.min(current.length, previous.length, 3000);
    let abruptChanges = 0;
    for (let i = 0; i < sampleLen; i++) {
      if (Math.abs(current.charCodeAt(i) - previous.charCodeAt(i)) > 30) {
        abruptChanges++;
      }
    }
    const flickerRatio = abruptChanges / sampleLen;
    return Math.max(0, 1 - flickerRatio * 3);
  }

  // -- Helpers --

  private avgBrightness(data: string): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data.charCodeAt(i);
    return data.length > 0 ? sum / data.length : 0;
  }
}
