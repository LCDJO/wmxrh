/**
 * BehaviorDataSanitizer — LGPD / Privacy-first sanitization layer.
 *
 * Ensures NO raw sensitive data is stored:
 *  - Raw touch coordinates (x, y) → stripped
 *  - Raw accelerometer/gyroscope readings → stripped
 *  - Raw keyboard timings → stripped
 *  - Device fingerprints → hashed (one-way)
 *  - Employee IDs → kept (functional key, not PII per se)
 *
 * Only anonymized statistical feature vectors are persisted.
 */

import type { BehaviorCaptureSession, BehavioralFeatureVector } from './types';

/**
 * One-way hash for device fingerprints — prevents reversal to actual device.
 */
async function hashFingerprint(fp: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(fp);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback: simple hash for environments without SubtleCrypto
  let hash = 0;
  for (let i = 0; i < fp.length; i++) {
    hash = ((hash << 5) - hash + fp.charCodeAt(i)) | 0;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}

/**
 * Strip all raw samples from a session, keeping only metadata.
 * Must be called AFTER feature extraction.
 */
export function purgeRawSamples(session: BehaviorCaptureSession): void {
  session.samples = [];
  // Remove any raw data references from metadata
  if (session.metadata) {
    delete session.metadata.raw_events;
    delete session.metadata.raw_touches;
    delete session.metadata.raw_keystrokes;
  }
}

/**
 * Sanitize a feature vector — remove any fields that could leak
 * raw positional or biometric data. Only statistical aggregates remain.
 */
export function sanitizeFeatureVector(features: BehavioralFeatureVector): BehavioralFeatureVector {
  // Feature vectors are already statistical (means, stddevs, counts).
  // Ensure no raw coordinate arrays leaked in.
  const sanitized = { ...features };

  // Remove any accidental raw data attachments
  const asAny = sanitized as Record<string, unknown>;
  const FORBIDDEN_KEYS = [
    'raw_touches', 'raw_coordinates', 'raw_keystrokes', 'raw_samples',
    'ip_address', 'user_agent', 'device_model', 'os_version',
    'gps_latitude', 'gps_longitude', 'exact_location',
  ];
  for (const key of FORBIDDEN_KEYS) {
    delete asAny[key];
  }

  return sanitized;
}

/**
 * Hash the device fingerprint in a session to prevent raw storage.
 */
export async function anonymizeSession(
  session: BehaviorCaptureSession,
): Promise<BehaviorCaptureSession> {
  return {
    ...session,
    device_fingerprint: await hashFingerprint(session.device_fingerprint),
  };
}

export { hashFingerprint };
