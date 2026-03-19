/**
 * PlatformContext — Global React context for the Platform Operating System Layer.
 *
 * Provides the PlatformRuntime singleton to the entire React tree.
 * Auto-boots the runtime on mount and shuts down on unmount.
 *
 * Usage:
 *   // In App root:
 *   <PlatformProvider>
 *     <App />
 *   </PlatformProvider>
 *
 *   // In any component:
 *   const os = usePlatformOS();
 *   os.modules.listActive();
 *   os.events.emit('custom:event', 'MyComponent', { data: 1 });
 *   os.identity.snapshot();
 */

import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import { getPlatformRuntime } from '@/domains/platform-os/platform-runtime';
import type { PlatformRuntimeAPI, RuntimePhase } from '@/domains/platform-os/types';

// ══════════════════════════════════════════════════════════════════
// Context
// ══════════════════════════════════════════════════════════════════

interface PlatformContextValue {
  /** The full runtime API */
  os: PlatformRuntimeAPI;
  /** Current lifecycle phase */
  phase: RuntimePhase;
  /** Whether the runtime has completed boot */
  ready: boolean;
  /** Boot error, if any */
  error: string | null;
}

const PlatformCtx = createContext<PlatformContextValue | null>(null);

// ══════════════════════════════════════════════════════════════════
// Provider
// ══════════════════════════════════════════════════════════════════

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const runtime = useRef(getPlatformRuntime()).current;
  const [phase, setPhase] = useState<RuntimePhase>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Listen for phase changes
    const unsubReady = runtime.events.on('runtime:ready', () => {
      if (mounted) setPhase('ready');
    });
    const unsubError = runtime.events.on('runtime:error', (evt) => {
      if (mounted) {
        setPhase('degraded');
        setError(String((evt.payload as any)?.error ?? 'Unknown error'));
      }
    });

    // Boot
    setPhase('booting');
    runtime.boot().catch((err) => {
      if (mounted) {
        setPhase('degraded');
        setError(err instanceof Error ? err.message : String(err));
      }
    });

    return () => {
      mounted = false;
      unsubReady();
      unsubError();
      // Don't shutdown on unmount — singleton persists across HMR
    };
  }, [runtime]);

  const value = useMemo<PlatformContextValue>(() => ({
    os: runtime,
    phase,
    ready: phase === 'ready',
    error,
  }), [runtime, phase, error]);

  return (
    <PlatformCtx.Provider value={value}>
      {children}
    </PlatformCtx.Provider>
  );
}

// ══════════════════════════════════════════════════════════════════
// Hooks
// ══════════════════════════════════════════════════════════════════

/**
 * Access the full PlatformOS runtime.
 * Throws if used outside PlatformProvider.
 */
export function usePlatformOS(): PlatformRuntimeAPI {
  const ctx = useContext(PlatformCtx);
  if (!ctx) throw new Error('usePlatformOS must be used within <PlatformProvider>');
  return ctx.os;
}

/**
 * Access the PlatformContext metadata (phase, ready, error).
 */
export function usePlatformContext(): PlatformContextValue {
  const ctx = useContext(PlatformCtx);
  if (!ctx) throw new Error('usePlatformContext must be used within <PlatformProvider>');
  return ctx;
}

/**
 * Check if the platform runtime is ready.
 */
export function usePlatformReady(): boolean {
  const ctx = useContext(PlatformCtx);
  return ctx?.ready ?? false;
}
