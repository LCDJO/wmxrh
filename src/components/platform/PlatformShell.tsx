/**
 * PlatformShell — Top-level integration component for the Platform OS.
 *
 * Responsibilities:
 *   1. Boot the PlatformRuntime (via PlatformProvider)
 *   2. Sync active modules with NavigationOrchestrator
 *   3. Apply identity (track navigation, sync identity snapshot)
 *   4. Render cognitive signal widgets (floating suggestion panel)
 *   5. Provide runtime status indicator in degraded/booting states
 *
 * Usage:
 *   <PlatformShell>
 *     <AppRoutes />
 *   </PlatformShell>
 *
 * SECURITY: PlatformShell is a UI orchestration layer.
 * It does NOT bypass the Security Kernel — all permission checks
 * still flow through ProtectedRoute and the SecurityKernel hooks.
 */

import React, { useEffect, useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PlatformProvider, usePlatformOS, usePlatformContext } from '@/domains/platform-os/platform-context';
import type { CognitiveSignal } from '@/domains/platform-os/types';
import { Sparkles, X, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ════════════════════════════════════════════════════════════════
// Inner shell (requires PlatformProvider above it)
// ════════════════════════════════════════════════════════════════

function PlatformShellInner({ children }: { children: React.ReactNode }) {
  const os = usePlatformOS();
  const { phase, ready, error } = usePlatformContext();
  const location = useLocation();

  // ── 1. Track navigation in POSL ───────────────────────────
  useEffect(() => {
    if (!ready) return;
    os.navigation.navigate(location.pathname);
    os.cognitive.trackNavigation(location.pathname);
  }, [location.pathname, ready, os]);

  // ── 2. Sync identity on boot ──────────────────────────────
  useEffect(() => {
    if (!ready) return;
    os.identity.refresh().catch(() => {
      // Identity refresh failures are non-fatal
    });
  }, [ready, os]);

  // ── 3. Boot status overlay ────────────────────────────────
  if (phase === 'booting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Inicializando plataforma...</p>
        </div>
      </div>
    );
  }

  // ── 4. Degraded banner ────────────────────────────────────
  const showDegradedBanner = phase === 'degraded' && error;

  return (
    <>
      {showDegradedBanner && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Plataforma em modo degradado: {error}</span>
        </div>
      )}

      {children}

      {/* Cognitive signals widget */}
      {ready && <CognitiveSignalWidget />}
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// Cognitive Signal Widget — Floating suggestion panel
// ════════════════════════════════════════════════════════════════

function CognitiveSignalWidget() {
  const os = usePlatformOS();
  const [signals, setSignals] = useState<CognitiveSignal[]>([]);
  const [expanded, setExpanded] = useState(false);

  // Poll active signals periodically
  useEffect(() => {
    function refresh() {
      const active = os.cognitive.activeSignals({ minConfidence: 0.5 });
      setSignals(active);
    }

    refresh();

    // Listen for signal events to refresh
    const unsub1 = os.events.on('cognitive:signal_pushed', refresh);
    const unsub2 = os.events.on('cognitive:signal_dismissed', refresh);
    const unsub3 = os.events.on('cognitive:signal_accepted', refresh);
    const unsub4 = os.events.on('cognitive:signals_cleared', refresh);

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [os]);

  const handleDismiss = useCallback((id: string) => {
    os.cognitive.dismissSignal(id);
  }, [os]);

  const handleAccept = useCallback((id: string) => {
    os.cognitive.acceptSignal(id);
  }, [os]);

  if (signals.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Collapsed: floating badge */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all"
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">{signals.length} sugestão{signals.length > 1 ? 'ões' : ''}</span>
        </button>
      )}

      {/* Expanded: signal list */}
      {expanded && (
        <div className="w-80 max-h-96 overflow-y-auto bg-card border border-border rounded-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Sugestões Cognitivas</span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Signals */}
          <div className="divide-y divide-border">
            {signals.map(signal => (
              <div key={signal.id} className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{signal.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{signal.description}</p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0",
                    signal.confidence >= 0.8
                      ? "bg-primary/10 text-primary"
                      : signal.confidence >= 0.6
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-muted-foreground"
                  )}>
                    {Math.round(signal.confidence * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAccept(signal.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Check className="h-3 w-3" />
                    {signal.action_label ?? 'Aplicar'}
                  </button>
                  <button
                    onClick={() => handleDismiss(signal.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Dispensar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Public export — wraps children with PlatformProvider
// ════════════════════════════════════════════════════════════════

export function PlatformShell({ children }: { children: React.ReactNode }) {
  return (
    <PlatformProvider>
      <PlatformShellInner>
        {children}
      </PlatformShellInner>
    </PlatformProvider>
  );
}
