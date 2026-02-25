/**
 * BehavioralProfileSection — Embedded summary of the employee's
 * driving behavioral score, infractions count, and warnings inside the Ficha.
 * Links to the full profile page.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Activity, AlertTriangle, FileWarning, TrendingUp, ExternalLink, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { computeBehavioralScore, type BehavioralScoreResult } from '@/domains/fleet-compliance/behavioral-score.engine';

interface Props {
  employeeId: string;
  tenantId: string;
}

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  B: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  C: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  D: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  F: 'bg-destructive/15 text-destructive border-destructive/30',
};

const RISK_LABELS: Record<string, string> = {
  low: 'Baixo',
  medium: 'Moderado',
  high: 'Alto',
  critical: 'Crítico',
};

export function BehavioralProfileSection({ employeeId, tenantId }: Props) {
  const navigate = useNavigate();

  const { data: behaviorEvents = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['fleet_behavior_events', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_behavior_events')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('tenant_id', tenantId)
        .order('event_timestamp', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!employeeId && !!tenantId,
  });

  const { data: warnings = [], isLoading: loadingWarnings } = useQuery({
    queryKey: ['fleet_warnings_profile', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_warnings')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('tenant_id', tenantId)
        .order('issued_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!employeeId && !!tenantId,
  });

  const isLoading = loadingEvents || loadingWarnings;

  // Compute score
  const scoreResult: BehavioralScoreResult | null = (!isLoading && behaviorEvents)
    ? computeBehavioralScore({
        employeeId,
        behaviorEvents: behaviorEvents as any[],
        warnings: warnings as any[],
        daysSinceLastIncident: behaviorEvents.length > 0
          ? Math.floor((Date.now() - new Date(behaviorEvents[0]?.event_timestamp).getTime()) / 86400000)
          : 90,
        allAgreementsSigned: true,
      })
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando perfil comportamental...</span>
      </div>
    );
  }

  const hasData = behaviorEvents.length > 0 || warnings.length > 0;

  if (!hasData) {
    return (
      <div className="text-center py-6">
        <Activity className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Nenhum evento comportamental registrado para este colaborador.
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Dados aparecerão aqui quando o colaborador estiver vinculado a um veículo monitorado.
        </p>
      </div>
    );
  }

  const recentEvents = behaviorEvents.slice(0, 5);
  const criticalCount = behaviorEvents.filter((e: any) => e.severity === 'critical' || e.severity === 'high').length;

  return (
    <div className="space-y-4">
      {/* Score Summary */}
      {scoreResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Score */}
          <Card className="border-none shadow-sm">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{scoreResult.score}</div>
              <Progress value={scoreResult.score} className="h-1.5 mt-1" />
              <div className="flex items-center justify-center gap-1.5 mt-1.5">
                <Badge variant="outline" className={`text-[10px] px-1.5 ${GRADE_COLORS[scoreResult.grade]}`}>
                  {scoreResult.grade}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {RISK_LABELS[scoreResult.riskLevel]}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Total Events */}
          <Card className="border-none shadow-sm">
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-[10px]">Infrações</span>
              </div>
              <div className="text-2xl font-bold">{behaviorEvents.length}</div>
              {criticalCount > 0 && (
                <span className="text-[10px] text-destructive">{criticalCount} graves</span>
              )}
            </CardContent>
          </Card>

          {/* Warnings */}
          <Card className="border-none shadow-sm">
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <FileWarning className="h-3.5 w-3.5" />
                <span className="text-[10px]">Advertências</span>
              </div>
              <div className="text-2xl font-bold">{warnings.length}</div>
            </CardContent>
          </Card>

          {/* Trend */}
          <Card className="border-none shadow-sm">
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-[10px]">Tendência</span>
              </div>
              <div className="text-lg font-bold">
                {scoreResult.breakdown.recencyBonus > 6 ? '📈 Melhora' : scoreResult.score < 50 ? '📉 Piora' : '➡️ Estável'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fatores */}
      {scoreResult && scoreResult.factors.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {scoreResult.factors.map((f, i) => (
            <Badge key={i} variant="outline" className="text-[10px]">{f}</Badge>
          ))}
        </div>
      )}

      <Separator />

      {/* Recent Events */}
      <div>
        <h5 className="text-xs font-medium text-muted-foreground mb-2">Últimos Eventos</h5>
        <div className="space-y-1.5">
          {recentEvents.map((evt: any) => (
            <div key={evt.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/30">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1 ${
                    evt.severity === 'critical' ? 'border-destructive/50 text-destructive'
                    : evt.severity === 'high' ? 'border-orange-500/50 text-orange-600'
                    : 'border-border'
                  }`}
                >
                  {evt.severity}
                </Badge>
                <span>{evt.event_type?.replace(/_/g, ' ')}</span>
              </div>
              <span className="text-muted-foreground">
                {new Date(evt.event_timestamp).toLocaleDateString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Link to full profile */}
      <Button
        variant="default"
        size="default"
        className="w-full gap-2 mt-2"
        onClick={() => navigate(`/fleet-behavior-profile?employee=${employeeId}`)}
      >
        <ExternalLink className="h-4 w-4" />
        Ver Perfil Comportamental Completo
      </Button>
    </div>
  );
}
