import { describe, it, expect, beforeEach } from 'vitest';
import {
  pushAppError,
  getAppErrors,
  clearAppErrors,
  onAppErrorsChange,
} from '@/lib/app-error-store';

describe('AppErrorStore', () => {
  beforeEach(() => {
    clearAppErrors();
  });

  it('starts empty', () => {
    expect(getAppErrors()).toHaveLength(0);
  });

  it('pushes errors and assigns id/timestamp/url', () => {
    pushAppError({ source: 'error_boundary', message: 'test error' });
    const errors = getAppErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('test error');
    expect(errors[0].source).toBe('error_boundary');
    expect(errors[0].id).toBeTruthy();
    expect(errors[0].timestamp).toBeTruthy();
    expect(errors[0].url).toBe('/');
  });

  it('orders newest first', () => {
    pushAppError({ source: 'global_error', message: 'first' });
    pushAppError({ source: 'global_error', message: 'second' });
    const errors = getAppErrors();
    expect(errors[0].message).toBe('second');
    expect(errors[1].message).toBe('first');
  });

  it('clears all errors', () => {
    pushAppError({ source: 'unhandled_rejection', message: 'err' });
    clearAppErrors();
    expect(getAppErrors()).toHaveLength(0);
  });

  it('limits to MAX_ERRORS (200)', () => {
    for (let i = 0; i < 210; i++) {
      pushAppError({ source: 'global_error', message: `err-${i}` });
    }
    expect(getAppErrors()).toHaveLength(200);
    // newest should be the last pushed
    expect(getAppErrors()[0].message).toBe('err-209');
  });

  it('notifies listeners on push', () => {
    let callCount = 0;
    const unsub = onAppErrorsChange(() => { callCount++; });
    pushAppError({ source: 'global_error', message: 'a' });
    pushAppError({ source: 'global_error', message: 'b' });
    expect(callCount).toBe(2);
    unsub();
    pushAppError({ source: 'global_error', message: 'c' });
    expect(callCount).toBe(2); // no more calls after unsub
  });

  it('notifies listeners on clear', () => {
    let called = false;
    const unsub = onAppErrorsChange(() => { called = true; });
    pushAppError({ source: 'global_error', message: 'a' });
    called = false;
    clearAppErrors();
    expect(called).toBe(true);
    unsub();
  });

  it('preserves optional stack and componentStack', () => {
    pushAppError({
      source: 'error_boundary',
      message: 'crash',
      stack: 'Error: crash\n  at X',
      componentStack: '\n  in MyComp',
    });
    const err = getAppErrors()[0];
    expect(err.stack).toContain('Error: crash');
    expect(err.componentStack).toContain('MyComp');
  });
});
