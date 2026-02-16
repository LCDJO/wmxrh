/**
 * LoginIntentDetector — Auto-detects PlatformUser vs TenantUser.
 *
 * Detection cascade:
 *   1. JWT claim (highest confidence)
 *   2. DB lookup (platform_users / tenant_memberships)
 *   3. Membership inference (fallback)
 *
 * Part of the Identity Intelligence Layer decomposition.
 */

import { identityBoundary } from '../identity-boundary';
import type {
  DetectedUserType,
  UserTypeDetection,
  IILUserTypeDetectedEvent,
} from './types';

export type DetectionCallback = (event: IILUserTypeDetectedEvent) => void;

export class LoginIntentDetector {
  private _detection: UserTypeDetection | null = null;
  private _onEvent: DetectionCallback;

  constructor(onEvent: DetectionCallback) {
    this._onEvent = onEvent;
  }

  get detection(): UserTypeDetection | null { return this._detection; }
  get isPlatformUser(): boolean { return this._detection?.detectedType === 'platform'; }
  get isTenantUser(): boolean { return this._detection?.detectedType === 'tenant'; }

  /**
   * Step 1 — Detect from JWT access token.
   */
  detectFromJwt(accessToken: string | undefined): UserTypeDetection {
    let detectedType: DetectedUserType = 'unknown';
    let platformRole = null;

    if (accessToken) {
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        if (payload.user_type === 'platform' || payload.user_type === 'tenant') {
          detectedType = payload.user_type;
        }
        if (payload.platform_role) {
          platformRole = payload.platform_role;
        }
      } catch { /* malformed */ }
    }

    const detection: UserTypeDetection = {
      detectedType,
      confidence: detectedType !== 'unknown' ? 'jwt_claim' : 'unknown',
      platformRole,
      tenantCount: identityBoundary.identity?.tenantScopes.length ?? 0,
      detectedAt: Date.now(),
    };

    this._setDetection(detection);
    return detection;
  }

  /**
   * Step 2 — Set from DB lookup result.
   * Won't downgrade from jwt_claim confidence.
   */
  setFromDbLookup(
    type: DetectedUserType,
    confidence: UserTypeDetection['confidence'],
    platformRole: string | null = null,
  ): void {
    if (this._detection?.confidence === 'jwt_claim' && confidence !== 'jwt_claim') {
      return;
    }

    const detection: UserTypeDetection = {
      detectedType: type,
      confidence,
      platformRole: platformRole as any,
      tenantCount: identityBoundary.identity?.tenantScopes.length ?? 0,
      detectedAt: Date.now(),
    };

    this._setDetection(detection);
  }

  /**
   * Step 3 — Infer from membership data (lowest confidence).
   */
  inferFromMemberships(): UserTypeDetection | null {
    if (this._detection?.confidence === 'jwt_claim' || this._detection?.confidence === 'db_lookup') {
      return this._detection;
    }

    const session = identityBoundary.identity;
    if (!session) return null;

    // If user has tenantScopes → likely tenant user
    const type: DetectedUserType = session.tenantScopes.length > 0 ? 'tenant' : 'unknown';

    const detection: UserTypeDetection = {
      detectedType: type,
      confidence: 'membership_inferred',
      platformRole: null,
      tenantCount: session.tenantScopes.length,
      detectedAt: Date.now(),
    };

    this._setDetection(detection);
    return detection;
  }

  /**
   * Clear detection state (on logout).
   */
  clear(): void {
    this._detection = null;
  }

  private _setDetection(detection: UserTypeDetection): void {
    this._detection = detection;
    this._onEvent({
      type: 'UserTypeDetected',
      timestamp: Date.now(),
      userId: identityBoundary.identity?.userId ?? null,
      detection,
    });
  }
}
