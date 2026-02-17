/**
 * LandingPreSubmitAlert — Shows Governance AI alerts before a landing page
 * is submitted for review.
 *
 * Detects:
 *  - Large FAB content changes vs. last published version
 *  - Conversion drop risk (low score, incomplete FAB, structure degradation)
 *
 * Renders inline alerts with severity badges and suggested actions.
 */
import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertTriangle,
  ShieldAlert,
  Info,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  Loader2,
} from 'lucide-react';
import {
  landingGovernanceAIValidator,
  type GovernanceAIAlert,
  type AlertSeverity,
} from '@/domains/platform-growth/landing-governance-ai-validator';
import type { LandingPage } from '@/domains/platform-growth/types';

interface LandingPreSubmitAlertProps {
  page: LandingPage;
  onDismiss?: () => void;
  onProceed?: () => void;
}

const severityConfig: Record<AlertSeverity, {
  icon: typeof AlertTriangle;
  variant: 'default' | 'destructive';
  label: string;
  badgeClass: string;
}> = {
  critical: {
    icon: ShieldAlert,
    variant: 'destructive',
    label: 'Crítico',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  warning: {
    icon: AlertTriangle,
    variant: 'default',
    label: 'Atenção',
    badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  info: {
    icon: Info,
    variant: 'default',
    label: 'Info',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
  },
};

export function LandingPreSubmitAlert({ page, onDismiss, onProceed }: LandingPreSubmitAlertProps) {
  const [alerts, setAlerts] = useState<GovernanceAIAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    landingGovernanceAIValidator.validate(page).then(result => {
      if (!cancelled) {
        setAlerts(result);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [page]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Analisando governança AI antes da submissão…
      </div>
    );
  }

  if (alerts.length === 0) return null;

  const hasCritical = alerts.some(a => a.severity === 'critical');
  const hasWarning = alerts.some(a => a.severity === 'warning');

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
      {/* Summary header */}
      <div className="flex items-center gap-2">
        <TrendingDown className="h-5 w-5 text-amber-500" />
        <span className="font-semibold text-sm text-foreground">
          Governance AI — Análise Pré-Submissão
        </span>
        <Badge variant="outline" className={hasCritical ? severityConfig.critical.badgeClass : hasWarning ? severityConfig.warning.badgeClass : severityConfig.info.badgeClass}>
          {alerts.length} alerta{alerts.length > 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Individual alerts */}
      {alerts.map(alert => {
        const config = severityConfig[alert.severity];
        const Icon = config.icon;
        const isExpanded = expandedIds.has(alert.id);

        return (
          <Collapsible key={alert.id} open={isExpanded} onOpenChange={() => toggleExpand(alert.id)}>
            <Alert variant={alert.severity === 'critical' ? 'destructive' : 'default'} className="relative">
              <Icon className="h-4 w-4" />
              <AlertTitle className="flex items-center gap-2 text-sm">
                {alert.title}
                <Badge variant="outline" className={`text-[10px] ${config.badgeClass}`}>
                  {config.label}
                </Badge>
              </AlertTitle>
              <AlertDescription className="text-xs mt-1">
                {alert.description}
              </AlertDescription>

              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="absolute top-2 right-2 h-6 w-6 p-0">
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-3 space-y-2">
                {/* Metrics */}
                {Object.keys(alert.metrics).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(alert.metrics).map(([key, val]) => (
                      <span key={key} className="inline-flex items-center gap-1 text-[10px] rounded-md bg-muted px-2 py-0.5 font-mono">
                        {key.replace(/_/g, ' ')}: <strong>{val}</strong>
                      </span>
                    ))}
                  </div>
                )}

                {/* Suggested actions */}
                {alert.suggestedActions.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Ações sugeridas
                    </span>
                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                      {alert.suggestedActions.map((action, i) => (
                        <li key={i}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CollapsibleContent>
            </Alert>
          </Collapsible>
        );
      })}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss} className="text-xs">
            Revisar depois
          </Button>
        )}
        {onProceed && (
          <Button
            size="sm"
            variant={hasCritical ? 'destructive' : 'default'}
            onClick={onProceed}
            className="text-xs gap-1.5"
          >
            {hasCritical ? (
              <>
                <ShieldAlert className="h-3 w-3" />
                Submeter mesmo assim
              </>
            ) : (
              'Prosseguir com submissão'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
