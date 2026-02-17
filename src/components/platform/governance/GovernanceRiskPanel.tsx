/**
 * GovernanceRiskPanel — Summary panel with KPIs and severity distribution.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, XCircle, AlertTriangle, Info, CheckCircle2, Zap } from 'lucide-react';
import type { GovernanceInsight } from '@/domains/governance-ai/types';
import type { AccessRiskProfile } from '@/domains/governance-ai/access-risk-analyzer';
import { cn } from '@/lib/utils';

interface GovernanceRiskPanelProps {
  insights: GovernanceInsight[];
  riskProfiles: AccessRiskProfile[];
}

export function GovernanceRiskPanel({ insights, riskProfiles }: GovernanceRiskPanelProps) {
  const criticalCount = insights.filter(i => i.severity === 'critical').length;
  const warningCount = insights.filter(i => i.severity === 'warning').length;
  const infoCount = insights.filter(i => i.severity === 'info').length;
  const remediableCount = insights.filter(i => i.auto_remediable).length;

  const highRiskUsers = riskProfiles.filter(p => p.level === 'critical' || p.level === 'high');
  const avgScore = riskProfiles.length > 0
    ? Math.round(riskProfiles.reduce((sum, p) => sum + p.composite_score, 0) / riskProfiles.length)
    : 0;

  const overallLevel = criticalCount > 0 ? 'critical'
    : warningCount > 3 ? 'high'
    : warningCount > 0 ? 'medium'
    : 'low';

  const levelConfig = {
    critical: { label: 'Crítico', color: 'text-destructive', bg: 'bg-destructive/10' },
    high: { label: 'Alto', color: 'text-[hsl(25_95%_53%)]', bg: 'bg-[hsl(25_95%_53%)]/10' },
    medium: { label: 'Médio', color: 'text-[hsl(38_92%_50%)]', bg: 'bg-[hsl(38_92%_50%)]/10' },
    low: { label: 'Baixo', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  };

  const level = levelConfig[overallLevel];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      {/* Overall Risk Level */}
      <Card className="lg:col-span-2">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className={cn('p-3 rounded-xl', level.bg)}>
              <Shield className={cn('h-7 w-7', level.color)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Nível de Risco</p>
              <p className={cn('text-2xl font-bold', level.color)}>{level.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Score médio: {avgScore}/100 • {highRiskUsers.length} usuário(s) em risco
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">Críticos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(38_92%_50%)]/10">
              <AlertTriangle className="h-5 w-5 text-[hsl(38_92%_40%)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{warningCount}</p>
              <p className="text-xs text-muted-foreground">Alertas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{infoCount}</p>
              <p className="text-xs text-muted-foreground">Informativos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-remediable */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Zap className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{remediableCount}</p>
              <p className="text-xs text-muted-foreground">Auto-remediáveis</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
