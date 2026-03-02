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
  private startTimestamp: number = 0;
  private phase: CapturePhase = 'pre_clock';
  private isCapturing = false;

  // Native event listeners (auto-attach)
  private boundHandlers: { type: string; handler: EventListener }[] = [];

  /** Max samples per session to bound memory */
  private static readonly MAX_SAMPLES = 500;
  /** Min samples for valid session */
  private static readonly MIN_SAMPLES = 10;
  /** Accelerometer sampling interval (ms) */
  private static readonly ACCEL_INTERVAL = 200;
  private accelTimer: ReturnType<typeof setInterval> | null = null;

  start(sessionId: string): void {
    this.sessionId = sessionId;
    this.startedAt = new Date().toISOString();
    this.startTimestamp = performance.now();
    this.samples = [];
    this.phase = 'pre_clock';
    this.isCapturing = true;
    this.attachNativeListeners();
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

  // ── Native event auto-attach ──────────────────────────────────

  private attachNativeListeners(): void {
    if (typeof window === 'undefined') return;

    // Touch events (pressure + duration)
    let touchStartTime = 0;
    const onTouchStart = (e: Event) => {
      const te = e as TouchEvent;
      touchStartTime = performance.now();
      if (te.touches[0]) {
        const t = te.touches[0];
        this.recordSample('touch', {
          pressure: (t as any).force ?? 0,
          x: t.clientX,
          y: t.clientY,
          duration_ms: 0,
        });
      }
    };
    const onTouchEnd = (e: Event) => {
      const duration_ms = performance.now() - touchStartTime;
      const te = e as TouchEvent;
      const t = te.changedTouches[0];
      if (t) {
        this.recordTouch((t as any).force ?? 0, t.clientX, t.clientY, duration_ms);
      }
    };

    // Mouse fallback (desktop)
    const onMouseMove = (e: Event) => {
      const me = e as MouseEvent;
      this.recordMouse(me.clientX, me.clientY, Math.sqrt(me.movementX ** 2 + me.movementY ** 2));
    };

    // Keyboard (typing speed)
    let lastKeyTime = 0;
    const onKeyDown = (e: Event) => {
      const now = performance.now();
      const inter_key_ms = lastKeyTime > 0 ? now - lastKeyTime : 0;
      lastKeyTime = now;
      this.recordKeystroke(0, inter_key_ms);
    };
    const onKeyUp = (e: Event) => {
      const hold = performance.now() - lastKeyTime;
      // Update last sample's key_hold_ms
      if (this.samples.length > 0) {
        const last = this.samples[this.samples.length - 1];
        if (last.source === 'keyboard') {
          last.data.key_hold_ms = hold;
        }
      }
    };

    // Device orientation (device_angle)
    const onOrientation = (e: Event) => {
      const de = e as DeviceOrientationEvent;
      this.recordGyroscope(de.alpha ?? 0, de.beta ?? 0, de.gamma ?? 0);
    };

    // Device motion (accelerometer_pattern)
    const onMotion = (e: Event) => {
      const dm = e as DeviceMotionEvent;
      const acc = dm.accelerationIncludingGravity;
      if (acc) {
        this.recordAccelerometer(acc.x ?? 0, acc.y ?? 0, acc.z ?? 0);
      }
    };

    // Register all
    const register = (target: EventTarget, type: string, handler: EventListener) => {
      target.addEventListener(type, handler, { passive: true });
      this.boundHandlers.push({ type, handler });
    };

    register(document, 'touchstart', onTouchStart);
    register(document, 'touchend', onTouchEnd);
    register(document, 'mousemove', onMouseMove);
    register(document, 'keydown', onKeyDown);
    register(document, 'keyup', onKeyUp);
    register(window, 'deviceorientation', onOrientation);
    register(window, 'devicemotion', onMotion);
  }

  private detachNativeListeners(): void {
    for (const { type, handler } of this.boundHandlers) {
      document.removeEventListener(type, handler);
      if (typeof window !== 'undefined') {
        window.removeEventListener(type, handler);
      }
    }
    this.boundHandlers = [];
    if (this.accelTimer) {
      clearInterval(this.accelTimer);
      this.accelTimer = null;
    }
  }

  // ── Finalize ─────────────────────────────────────────────────

  stop(): void {
    this.isCapturing = false;
    this.phase = 'post_clock';
    this.detachNativeListeners();
  }

  /** Session duration in ms */
  get sessionDurationMs(): number {
    return performance.now() - this.startTimestamp;
  }

  finalize(tenantId: string, employeeId: string, deviceFingerprint: string): BehaviorCaptureSession | null {
    const sessionDuration = this.sessionDurationMs;
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
        session_duration_ms: sessionDuration,
        clock_hour: new Date().getHours(),
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
