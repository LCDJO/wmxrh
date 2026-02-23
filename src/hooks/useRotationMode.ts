/**
 * useRotationMode — Auto-rotate between TV dashboard views.
 *
 * Views: fleet_live | risk_heatmap | compliance_summary | executive_overview
 * Interval: 30–120 seconds (configurable via display config or URL param).
 */
import { useState, useEffect, useCallback, useRef } from 'react';

export type RotationView = 'fleet_live' | 'risk_heatmap' | 'sst_view' | 'compliance_summary' | 'executive_overview';

const DEFAULT_VIEWS: RotationView[] = [
  'fleet_live',
  'risk_heatmap',
  'compliance_summary',
  'executive_overview',
];

const VIEW_LABELS: Record<RotationView, string> = {
  fleet_live: 'Frota ao Vivo',
  risk_heatmap: 'Mapa de Risco',
  sst_view: 'SST — Saúde e Segurança',
  compliance_summary: 'Compliance',
  executive_overview: 'Visão Executiva',
};

interface UseRotationModeOptions {
  /** Whether rotation is enabled */
  enabled: boolean;
  /** Interval in seconds (clamped 30–120) */
  intervalSeconds?: number;
  /** Ordered list of views to rotate through */
  views?: RotationView[];
}

interface UseRotationModeReturn {
  currentView: RotationView;
  currentIndex: number;
  totalViews: number;
  viewLabel: string;
  /** Progress 0–1 within current interval */
  progress: number;
  /** Seconds remaining */
  remaining: number;
  /** Manual navigation */
  goTo: (view: RotationView) => void;
  goNext: () => void;
  goPrev: () => void;
  /** Pause/resume */
  paused: boolean;
  togglePause: () => void;
}

export function useRotationMode({
  enabled,
  intervalSeconds = 60,
  views = DEFAULT_VIEWS,
}: UseRotationModeOptions): UseRotationModeReturn {
  const interval = Math.max(30, Math.min(120, intervalSeconds)) * 1000;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const startRef = useRef(Date.now());
  const rafRef = useRef<number>();

  const safeViews = views.length > 0 ? views : DEFAULT_VIEWS;
  const currentView = safeViews[index % safeViews.length];

  // Reset timer on index change
  useEffect(() => {
    startRef.current = Date.now();
    setProgress(0);
  }, [index]);

  // Animation frame for smooth progress + auto-advance
  useEffect(() => {
    if (!enabled || paused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const p = Math.min(elapsed / interval, 1);
      setProgress(p);

      if (p >= 1) {
        setIndex(prev => (prev + 1) % safeViews.length);
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [enabled, paused, interval, safeViews.length, index]);

  const goTo = useCallback((view: RotationView) => {
    const i = safeViews.indexOf(view);
    if (i >= 0) setIndex(i);
  }, [safeViews]);

  const goNext = useCallback(() => {
    setIndex(prev => (prev + 1) % safeViews.length);
  }, [safeViews.length]);

  const goPrev = useCallback(() => {
    setIndex(prev => (prev - 1 + safeViews.length) % safeViews.length);
  }, [safeViews.length]);

  const togglePause = useCallback(() => {
    setPaused(p => {
      if (p) startRef.current = Date.now() - progress * interval; // resume from current progress
      return !p;
    });
  }, [progress, interval]);

  const remaining = Math.max(0, Math.ceil((interval - (Date.now() - startRef.current)) / 1000));

  return {
    currentView,
    currentIndex: index % safeViews.length,
    totalViews: safeViews.length,
    viewLabel: VIEW_LABELS[currentView] ?? currentView,
    progress,
    remaining,
    goTo,
    goNext,
    goPrev,
    paused,
    togglePause,
  };
}

export { VIEW_LABELS, DEFAULT_VIEWS };
