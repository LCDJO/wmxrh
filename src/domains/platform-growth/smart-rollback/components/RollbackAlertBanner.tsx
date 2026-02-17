/**
 * RollbackAlertBanner — Platform-level alert banner for conversion degradation.
 *
 * Displays when the SmartRollbackEngine has pending rollback suggestions.
 * "Queda de conversão detectada. Deseja reverter para versão anterior?"
 */
import { useState } from 'react';
import { AlertTriangle, RotateCcw, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RollbackDecision } from '../types';

interface RollbackAlertBannerProps {
  decisions: RollbackDecision[];
  onApprove: (decisionId: string) => void;
  onDismiss: (decisionId: string) => void;
}

export function RollbackAlertBanner({ decisions, onApprove, onDismiss }: RollbackAlertBannerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pending = decisions.filter(d => d.approved === null);

  if (pending.length === 0) return null;

  return (
    <div className="space-y-2">
      {pending.map(decision => {
        const isExpanded = expandedId === decision.id;
        const isCritical = decision.mode === 'automatic';
        const dropPct = Math.abs(decision.comparison.conversionRateDelta).toFixed(1);

        return (
          <div
            key={decision.id}
            className={`
              relative rounded-lg border px-4 py-3 shadow-sm transition-colors
              ${isCritical
                ? 'border-destructive/40 bg-destructive/5 text-destructive'
                : 'border-warning/40 bg-warning/5 text-warning-foreground'
              }
            `}
          >
            {/* Main row */}
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  Queda de conversão detectada. Deseja reverter para versão anterior?
                </p>
                <p className="text-xs opacity-80 mt-0.5">
                  v{decision.currentVersionNumber} → v{decision.targetVersionNumber}
                  {' · '}
                  Conversão: -{dropPct}%
                  {' · '}
                  Confiança: {decision.comparison.confidence}%
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => onApprove(decision.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reverter
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => setExpandedId(isExpanded ? null : decision.id)}
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 opacity-60 hover:opacity-100"
                  onClick={() => onDismiss(decision.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="mt-3 border-t border-current/10 pt-3 grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="block opacity-60">Motivo</span>
                  <span className="font-medium">{formatReason(decision.reason)}</span>
                </div>
                <div>
                  <span className="block opacity-60">Receita</span>
                  <span className="font-medium">
                    {decision.comparison.revenueDelta > 0 ? '+' : ''}
                    {decision.comparison.revenueDelta.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="block opacity-60">Bounce Rate</span>
                  <span className="font-medium">
                    {decision.comparison.bounceRateDelta > 0 ? '+' : ''}
                    {decision.comparison.bounceRateDelta.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatReason(reason: string): string {
  const map: Record<string, string> = {
    conversion_drop: 'Queda de conversão',
    revenue_drop: 'Queda de receita',
    bounce_spike: 'Aumento de bounce rate',
    combined_degradation: 'Degradação combinada',
    manual_trigger: 'Acionamento manual',
  };
  return map[reason] ?? reason;
}
