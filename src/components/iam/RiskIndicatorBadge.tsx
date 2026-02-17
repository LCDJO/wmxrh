/**
 * RiskIndicatorBadge — Compact risk level indicator from UGE RiskAssessment.
 *
 * READ-ONLY: Consumes UGE data, never mutates permissions.
 *
 * Variants:
 *   - "badge"    → inline Badge with icon + label
 *   - "expanded" → Card with signals summary + user scores
 */
import { useMemo } from 'react';
import { Shield, AlertTriangle, CheckCircle, AlertOctagon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { unifiedGraphEngine } from '@/domains/security/kernel/unified-graph-engine';
import type { RiskLevel, RiskAssessment, UserRiskScore } from '@/domains/security/kernel/unified-graph-engine';

// ════════════════════════════════════
// LEVEL CONFIG
// ════════════════════════════════════

const LEVEL_CONFIG: Record<RiskLevel, {
  icon: typeof Shield;
  label: string;
  badgeClass: string;
  dotClass: string;
}> = {
  critical: {
    icon: AlertOctagon,
    label: 'Crítico',
    badgeClass: 'border-red-500/50 text-red-400 bg-red-500/10',
    dotClass: 'bg-red-500',
  },
  high: {
    icon: AlertTriangle,
    label: 'Alto',
    badgeClass: 'border-orange-500/50 text-orange-400 bg-orange-500/10',
    dotClass: 'bg-orange-500',
  },
  medium: {
    icon: Shield,
    label: 'Médio',
    badgeClass: 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10',
    dotClass: 'bg-yellow-500',
  },
  low: {
    icon: CheckCircle,
    label: 'Baixo',
    badgeClass: 'border-green-500/50 text-green-400 bg-green-500/10',
    dotClass: 'bg-green-500',
  },
};

// ════════════════════════════════════
// PROPS
// ════════════════════════════════════

export interface RiskIndicatorBadgeProps {
  /** Visualization variant */
  variant?: 'badge' | 'expanded';
  /** Optionally pass pre-computed assessment (avoids recomputation) */
  assessment?: RiskAssessment | null;
  /** Max user scores to show in expanded variant */
  maxUserScores?: number;
  /** Max signals to show in expanded variant */
  maxSignals?: number;
  className?: string;
}

// ════════════════════════════════════
// COMPONENT
// ════════════════════════════════════

export function RiskIndicatorBadge({
  variant = 'badge',
  assessment: externalAssessment,
  maxUserScores = 5,
  maxSignals = 6,
  className,
}: RiskIndicatorBadgeProps) {
  const riskData = useMemo(() => {
    if (externalAssessment) return externalAssessment;
    try {
      const snapshot = unifiedGraphEngine.compose();
      return unifiedGraphEngine.assessRisk(snapshot);
    } catch {
      return null;
    }
  }, [externalAssessment]);

  if (!riskData) return null;

  const config = LEVEL_CONFIG[riskData.overallLevel];
  const Icon = config.icon;

  // ── Badge variant ──
  if (variant === 'badge') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`${config.badgeClass} gap-1 cursor-default ${className ?? ''}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass} animate-pulse`} />
            <Icon className="h-3 w-3" />
            <span className="text-[10px] font-semibold">{config.label}</span>
            {riskData.signals.length > 0 && (
              <span className="text-[9px] opacity-70">({riskData.signals.length})</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs font-medium mb-1">
            Risco {config.label} — {riskData.signals.length} sinal(is)
          </p>
          {riskData.signals.slice(0, 3).map((s, i) => (
            <p key={i} className="text-[10px] text-muted-foreground">• {s.title}</p>
          ))}
          {riskData.signals.length > 3 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              +{riskData.signals.length - 3} mais...
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  // ── Expanded variant ──
  return (
    <Card className={`border-border/50 ${className ?? ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Risk Assessment
          </CardTitle>
          <Badge variant="outline" className={`${config.badgeClass} gap-1`}>
            <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
            {config.label}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {riskData.signals.length} sinal(is) · {riskData.userScores.length} usuário(s) avaliado(s)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Signals */}
        {riskData.signals.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-[11px] font-semibold text-foreground">Sinais</h4>
            {riskData.signals.slice(0, maxSignals).map((signal, i) => {
              const sc = LEVEL_CONFIG[signal.level];
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 shrink-0 mt-0.5 ${sc.badgeClass}`}>
                    {signal.level}
                  </Badge>
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{signal.title}</span>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{signal.detail}</p>
                  </div>
                </div>
              );
            })}
            {riskData.signals.length > maxSignals && (
              <p className="text-[10px] text-muted-foreground">+{riskData.signals.length - maxSignals} mais sinais</p>
            )}
          </div>
        )}

        {/* User Scores */}
        {riskData.userScores.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-[11px] font-semibold text-foreground">User Risk Scores</h4>
            <div className="space-y-1">
              {riskData.userScores.slice(0, maxUserScores).map((us) => (
                <UserScoreRow key={us.userUid} score={us} />
              ))}
            </div>
            {riskData.userScores.length > maxUserScores && (
              <p className="text-[10px] text-muted-foreground">+{riskData.userScores.length - maxUserScores} mais usuários</p>
            )}
          </div>
        )}

        {riskData.signals.length === 0 && riskData.userScores.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum sinal de risco detectado.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════
// USER SCORE ROW
// ════════════════════════════════════

function UserScoreRow({ score }: { score: UserRiskScore }) {
  const config = LEVEL_CONFIG[score.level];
  const barWidth = Math.max(2, score.score);

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-foreground font-medium truncate w-24" title={score.userLabel}>
        {score.userLabel}
      </span>
      <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${config.dotClass}`}
          style={{ width: `${barWidth}%`, transition: 'width 300ms ease' }}
        />
      </div>
      <span className="text-muted-foreground w-7 text-right tabular-nums">{score.score}</span>
      <Badge variant="outline" className={`text-[8px] px-1 py-0 ${config.badgeClass}`}>
        {config.label}
      </Badge>
    </div>
  );
}
