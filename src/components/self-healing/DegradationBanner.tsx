/**
 * DegradationBanner — Fallback experience banner shown when the
 * SelfHealingEngine detects degraded modules or active incidents.
 *
 * Part of PlatformExperienceEngine (PXE) fallback strategy.
 */

import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { useSelfHealingStatus } from '@/hooks/platform/use-self-healing-status';

export function DegradationBanner() {
  const { showDegradationBanner, degradedModules, activeIncidents } = useSelfHealingStatus();
  const [dismissed, setDismissed] = useState(false);

  if (!showDegradationBanner || dismissed) return null;

  const hasCritical = activeIncidents.some(i => i.severity === 'critical');

  return (
    <div
      role="alert"
      className={`relative flex items-center gap-3 px-4 py-3 text-sm border-b ${
        hasCritical
          ? 'bg-destructive/10 text-destructive border-destructive/20'
          : 'bg-warning/10 text-warning-foreground border-warning/20'
      }`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />

      <div className="flex-1">
        <span className="font-medium">
          Algumas funcionalidades estão temporariamente indisponíveis.
        </span>
        {degradedModules.length > 0 && (
          <span className="ml-1 text-muted-foreground">
            Módulos afetados: {degradedModules.join(', ')}
          </span>
        )}
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-sm p-1 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Fechar aviso"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
