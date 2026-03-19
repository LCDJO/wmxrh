import { useEffect, useState, useMemo } from 'react';
import { Shield, Scale, TrendingUp, AlertTriangle, Building2, ChevronRight, Bell, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatsCard } from '@/components/shared/StatsCard';
import { useTenant } from '@/contexts/TenantContext';
import { getStructuralIndicatorsEngine, getAlertEngine } from '@/domains/governance';
import type { IndicatorResult, ExecutiveAlert } from '@/domains/governance';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { toast } from 'sonner';

const RISK_COLORS: Record<string, string> = {
  low: 'hsl(160, 84%, 29%)',
  medium: 'hsl(38, 92%, 50%)',
  high: 'hsl(20, 90%, 50%)',
  critical: 'hsl(0, 72%, 51%)',
};

const RISK_LABELS: Record<string, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  critical: 'Crítico',
};

const SEVERITY_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  medium: 'secondary',
  high: 'default',
  critical: 'destructive',
};

export default function ExecutiveDashboard() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? '';

  const [indicators, setIndicators] = useState<Record<string, IndicatorResult | null>>({});
  const [alerts, setAlerts] = useState<ExecutiveAlert[]>([]);
  const [alertStats, setAlertStats] = useState({ total_open: 0, critical: 0, high: 0, medium: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);

    Promise.all([
      getStructuralIndicatorsEngine().getDashboard(tenantId),
      getAlertEngine().getOpenAlerts(tenantId, { limit: 10 }),
      getAlertEngine().getAlertStats(tenantId),
    ]).then(([dash, openAlerts, stats]) => {
      setIndicators(dash);
      setAlerts(openAlerts);
      setAlertStats(stats);
    }).catch(err => {
      console.error('[ExecutiveDashboard]', err);
      toast.error('Erro ao carregar dados do painel executivo');
    }).finally(() => setLoading(false));
  }, [tenantId]);

  const radarData = useMemo(() => {
    const turnover = indicators.turnover_risk?.score ?? 0;
    const stability = indicators.stability?.score ?? 0;
    const legal = indicators.legal_exposure?.score ?? 0;
    const org = indicators.org_risk_map?.score ?? 0;

    return [
      { axis: 'Turnover', value: turnover },
      { axis: 'Estabilidade', value: 100 - stability },
      { axis: 'Exposição Jurídica', value: legal },
      { axis: 'Risco Geral', value: org },
    ];
  }, [indicators]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await getAlertEngine().acknowledgeAlert(alertId, 'current_user');
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      setAlertStats(prev => ({ ...prev, total_open: Math.max(0, prev.total_open - 1) }));
      toast.success('Alerta reconhecido');
    } catch {
      toast.error('Erro ao reconhecer alerta');
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      await getAlertEngine().dismissAlert(alertId, 'current_user');
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      setAlertStats(prev => ({ ...prev, total_open: Math.max(0, prev.total_open - 1) }));
      toast.success('Alerta descartado');
    } catch {
      toast.error('Erro ao descartar alerta');
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Painel Executivo</h1>
            <p className="text-sm text-muted-foreground">Carregando indicadores...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Painel Executivo</h1>
            <p className="text-sm text-muted-foreground">Governança organizacional e indicadores estruturais</p>
          </div>
        </div>
        {alertStats.total_open > 0 && (
          <Badge variant={alertStats.critical > 0 ? 'destructive' : 'default'} className="gap-1.5 px-3 py-1.5">
            <Bell className="h-3.5 w-3.5" />
            {alertStats.total_open} alerta{alertStats.total_open > 1 ? 's' : ''} ativo{alertStats.total_open > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <IndicatorCard
          title="Risco de Turnover"
          indicator={indicators.turnover_risk}
          icon={TrendingUp}
          description="Probabilidade de rotatividade elevada"
        />
        <IndicatorCard
          title="Índice de Estabilidade"
          indicator={indicators.stability}
          icon={Building2}
          description="Saúde da retenção e tenure"
          inverted
        />
        <IndicatorCard
          title="Exposição Jurídica"
          indicator={indicators.legal_exposure}
          icon={Scale}
          description="Passivo disciplinar acumulado"
        />
        <IndicatorCard
          title="Risco Organizacional"
          indicator={indicators.org_risk_map}
          icon={Shield}
          description="Score composto de risco"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart — Risk Map */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Mapa de Risco Organizacional</CardTitle>
            <CardDescription>Visão multidimensional dos 4 indicadores</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar name="Risco" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Component Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Componentes por Indicador</CardTitle>
            <CardDescription>Fatores que contribuem para cada score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {Object.entries(indicators).map(([key, ind]) => {
                if (!ind) return null;
                const label = key === 'turnover_risk' ? 'Turnover' : key === 'stability' ? 'Estabilidade' : key === 'legal_exposure' ? 'Jurídico' : 'Geral';
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: RISK_COLORS[ind.risk_level] }}>
                          {ind.score.toFixed(1)}
                        </span>
                        <Badge variant="outline" className="text-xs" style={{ borderColor: RISK_COLORS[ind.risk_level], color: RISK_COLORS[ind.risk_level] }}>
                          {RISK_LABELS[ind.risk_level]}
                        </Badge>
                      </div>
                    </div>
                    <Progress value={ind.score} className="h-2" />
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(ind.components).slice(0, 4).map(([factor, value]) => (
                        <Tooltip key={factor}>
                          <TooltipTrigger asChild>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground cursor-default">
                              {factor.replace(/_/g, ' ')}: {(Number(value) * 100).toFixed(0)}%
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{factor.replace(/_/g, ' ')}: {(Number(value) * 100).toFixed(1)}%</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-display flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Alertas Preditivos Ativos
              </CardTitle>
              <CardDescription>
                {alertStats.total_open === 0
                  ? 'Nenhum alerta ativo no momento'
                  : `${alertStats.critical} crítico${alertStats.critical !== 1 ? 's' : ''}, ${alertStats.high} alto${alertStats.high !== 1 ? 's' : ''}, ${alertStats.medium} médio${alertStats.medium !== 1 ? 's' : ''}`
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-primary/50" />
              <p className="text-sm">Nenhum alerta ativo. Tudo sob controle.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div
                    className="mt-0.5 h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: RISK_COLORS[alert.severity] }}
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{alert.title}</span>
                      <Badge variant={SEVERITY_VARIANT[alert.severity] ?? 'default'} className="text-[10px]">
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Score: {alert.risk_score}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{alert.description}</p>
                    {alert.recommended_actions.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <ChevronRight className="h-3 w-3" />
                        <span className="truncate">{alert.recommended_actions[0]}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleAcknowledge(alert.id)}>
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Reconhecer</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDismiss(alert.id)}>
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Descartar</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Indicator Card Component ──

function IndicatorCard({
  title,
  indicator,
  icon: Icon,
  description,
  inverted,
}: {
  title: string;
  indicator: IndicatorResult | null;
  icon: React.ElementType;
  description: string;
  inverted?: boolean;
}) {
  if (!indicator) {
    return (
      <Card className="relative overflow-hidden">
        <CardContent className="pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-3xl font-bold font-display text-muted-foreground/50">—</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const color = RISK_COLORS[indicator.risk_level];
  const isGood = inverted ? indicator.score >= 50 : indicator.score < 50;

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 left-0 h-1 w-full" style={{ backgroundColor: color }} />
      <CardContent className="pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold font-display text-card-foreground">{indicator.score.toFixed(1)}</p>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px]" style={{ borderColor: color, color }}>
                {RISK_LABELS[indicator.risk_level]}
              </Badge>
              <span className="text-xs text-muted-foreground">{description}</span>
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}15` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
