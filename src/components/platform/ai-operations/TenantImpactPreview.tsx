import { Users, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DeployImpactAssessment } from '@/domains/autonomous-operations/types';

const verdictConfig: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  safe: { color: 'text-emerald-500', icon: CheckCircle2, label: 'Deploy Seguro' },
  caution: { color: 'text-amber-500', icon: AlertTriangle, label: 'Cautela' },
  risky: { color: 'text-destructive', icon: AlertTriangle, label: 'Risco Alto' },
  blocked: { color: 'text-destructive', icon: XCircle, label: 'Bloqueado' },
};

const levelColors: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive',
  high: 'bg-amber-500/10 text-amber-600',
  medium: 'bg-primary/10 text-primary',
  low: 'bg-muted text-muted-foreground',
  none: 'bg-muted/50 text-muted-foreground',
};

interface Props {
  assessment: DeployImpactAssessment;
}

export function TenantImpactPreview({ assessment }: Props) {
  const v = verdictConfig[assessment.verdict] ?? verdictConfig.safe;
  const VerdictIcon = v.icon;

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Impacto Pré-Deploy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Verdict */}
        <div className="flex items-center gap-2 rounded-lg border border-border p-3">
          <VerdictIcon className={cn('h-5 w-5 shrink-0', v.color)} />
          <div className="min-w-0 flex-1">
            <p className={cn('text-sm font-semibold', v.color)}>{v.label}</p>
            <p className="text-xs text-muted-foreground">{assessment.release_label}</p>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">{assessment.total_tenants_affected} afetados</Badge>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-5 gap-1.5">
          {(['critical', 'high', 'medium', 'low', 'none'] as const).map(level => (
            <div key={level} className={cn('rounded-md p-2 text-center', levelColors[level])}>
              <p className="text-lg font-bold">{assessment.impact_breakdown[level]}</p>
              <p className="text-[10px] capitalize">{level}</p>
            </div>
          ))}
        </div>

        {/* Automation + Billing */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-2.5 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Automações</p>
            <p className="text-sm font-bold text-foreground">{assessment.automation_impact.total_workflows_affected}</p>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span className="text-destructive font-medium">{assessment.automation_impact.workflows_breaking} quebrando</span>
              <span>{assessment.automation_impact.workflows_degraded} degradados</span>
            </div>
          </div>
          <div className="rounded-lg border border-border p-2.5 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Billing</p>
            <p className="text-sm font-bold text-foreground">R${assessment.billing_impact.estimated_revenue_delta_brl.toFixed(2)}</p>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span>{assessment.billing_impact.tenants_with_price_change} c/ preço</span>
              <span className="text-destructive font-medium">R${assessment.billing_impact.total_mrr_at_risk} MRR risco</span>
            </div>
          </div>
        </div>

        {/* Tenant list */}
        <div className="space-y-1">
          {assessment.tenant_impacts.map(t => (
            <div key={t.tenant_id} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
              <span className="font-medium text-foreground">{t.tenant_name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{t.plan}</Badge>
                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', levelColors[t.impact_level])}>
                  {t.impact_level}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
