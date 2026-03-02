/**
 * BehaviorCaptureSDK — Client-side behavioral data collector.
 *
 * Captures touch/mouse/keyboard/motion patterns during clock-in/out flow.
 * Privacy-first: no raw biometrics stored, only statistical features.
 */

import type { BehaviorSample, BehaviorCaptureSession, InputSource, CapturePhase } from './types';

export class BehaviorCaptureSDK {
  private samples: BehaviorSample[] = [];
  private sessionId: string = '';
  private startedAt: string = '';
  private phase: CapturePhase = 'pre_clock';
  private isCapturing = false;

  /** Max samples per session to bound memory */
  private static readonly MAX_SAMPLES = 500;
  /** Min samples for valid session */
  private static readonly MIN_SAMPLES = 10;

  start(sessionId: string): void {
    this.sessionId = sessionId;
    this.startedAt = new Date().toISOString();
    this.samples = [];
    this.phase = 'pre_clock';
    this.isCapturing = true;
  }

  setPhase(phase: CapturePhase): void {
    this.phase = phase;
  }

  recordSample(source: InputSource, data: Record<string, number>): void {
    if (!this.isCapturing || this.samples.length >= BehaviorCaptureSDK.MAX_SAMPLES) return;

    this.samples.push({
      timestamp: performance.now(),
      source,
      phase: this.phase,
      data,
    });
  }

  // ── Convenience capture methods ──────────────────────────────

  recordTouch(pressure: number, x: number, y: number, duration_ms: number): void {
    this.recordSample('touch', { pressure, x, y, duration_ms });
  }

  recordSwipe(velocity: number, angle: number, distance: number): void {
    this.recordSample('touch', { velocity, angle, distance, type: 1 }); // type=1 → swipe
  }

  recordKeystroke(key_hold_ms: number, inter_key_ms: number): void {
    this.recordSample('keyboard', { key_hold_ms, inter_key_ms });
  }

  recordAccelerometer(x: number, y: number, z: number): void {
    this.recordSample('accelerometer', { x, y, z });
  }

  recordGyroscope(alpha: number, beta: number, gamma: number): void {
    this.recordSample('gyroscope', { alpha, beta, gamma });
  }

  recordMouse(x: number, y: number, velocity: number): void {
    this.recordSample('mouse', { x, y, velocity });
  }

  // ── Finalize ─────────────────────────────────────────────────

  stop(): void {
    this.isCapturing = false;
    this.phase = 'post_clock';
  }

  finalize(tenantId: string, employeeId: string, deviceFingerprint: string): BehaviorCaptureSession | null {
    this.stop();

    if (this.samples.length < BehaviorCaptureSDK.MIN_SAMPLES) {
      console.warn('[BehaviorCaptureSDK] Insufficient samples, discarding session');
      return null;
    }

    return {
      session_id: this.sessionId,
      tenant_id: tenantId,
      employee_id: employeeId,
      device_fingerprint: deviceFingerprint,
      samples: [...this.samples],
      started_at: this.startedAt,
      ended_at: new Date().toISOString(),
      metadata: {
        sample_count: this.samples.length,
        sources: [...new Set(this.samples.map(s => s.source))],
        phases: [...new Set(this.samples.map(s => s.phase))],
      },
    };
  }

  get sampleCount(): number {
    return this.samples.length;
  }

  get active(): boolean {
    return this.isCapturing;
  }
}
