/**
 * MFA Ready - Infrastructure Stubs
 * 
 * Prepared interfaces and hooks for when MFA is enabled.
 * Supabase Auth supports TOTP-based MFA natively.
 * 
 * To activate:
 * 1. Enable MFA in Supabase Auth settings
 * 2. Set SECURITY_FEATURES.MFA.enabled = true
 * 3. The enrollment and verification flows will activate automatically
 */

import { supabase } from '@/integrations/supabase/client';
import { SECURITY_FEATURES } from './feature-flags';

// ═══════════════════════════════════
// Types
// ═══════════════════════════════════

export type MFAMethod = 'totp'; // future: 'sms' | 'webauthn'

export interface MFAStatus {
  isEnabled: boolean;
  isEnrolled: boolean;
  requiresVerification: boolean;
  method: MFAMethod | null;
}

// ═══════════════════════════════════
// MFA Service (stubs - activate when ready)
// ═══════════════════════════════════

export const mfaService = {
  /** Check if MFA feature is enabled */
  isFeatureEnabled(): boolean {
    return SECURITY_FEATURES.MFA.enabled;
  },

  /** Get MFA enrollment status for current user */
  async getStatus(): Promise<MFAStatus> {
    if (!SECURITY_FEATURES.MFA.enabled) {
      return { isEnabled: false, isEnrolled: false, requiresVerification: false, method: null };
    }

    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      console.error('[MFA] Failed to get status:', error.message);
      return { isEnabled: true, isEnrolled: false, requiresVerification: false, method: null };
    }

    const totpFactors = data.totp || [];
    const isEnrolled = totpFactors.length > 0;
    const verifiedFactors = totpFactors.filter(f => f.status === 'verified');

    return {
      isEnabled: true,
      isEnrolled,
      requiresVerification: isEnrolled && verifiedFactors.length === 0,
      method: isEnrolled ? 'totp' : null,
    };
  },

  /** Start TOTP enrollment (returns QR code URI) */
  async enrollTOTP(): Promise<{ id: string; uri: string; secret: string } | null> {
    if (!SECURITY_FEATURES.MFA.enabled) return null;

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) {
      console.error('[MFA] Enrollment failed:', error.message);
      return null;
    }

    return { id: data.id, uri: data.totp.uri, secret: data.totp.secret };
  },

  /** Verify TOTP code during enrollment or login */
  async verifyTOTP(factorId: string, code: string): Promise<boolean> {
    if (!SECURITY_FEATURES.MFA.enabled) return true;

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      console.error('[MFA] Challenge failed:', challengeError.message);
      return false;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      console.error('[MFA] Verification failed:', verifyError.message);
      return false;
    }

    return true;
  },

  /** Unenroll a factor */
  async unenroll(factorId: string): Promise<boolean> {
    if (!SECURITY_FEATURES.MFA.enabled) return true;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      console.error('[MFA] Unenroll failed:', error.message);
      return false;
    }
    return true;
  },
};
