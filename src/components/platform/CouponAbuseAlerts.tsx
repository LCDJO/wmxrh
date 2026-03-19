/**
 * CouponAbuseAlerts — Governance AI alerts for coupon abuse detection
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Shield, ShieldAlert, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useCouponGovernance } from '@/hooks/billing/use-coupon-governance';

const RISK_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Shield }> = {
  low: { label: 'Baixo', variant: 'secondary', icon: CheckCircle2 },
  medium: { label: 'Médio', variant: 'outline', icon: Shield },
  high: { label: 'Alto', variant: 'destructive', icon: AlertTriangle },
  critical: { label: 'Crítico', variant: 'destructive', icon: ShieldAlert },
};

export function CouponAbuseAlerts() {
  const { analysis, loading, error, analyze } = useCouponGovernance();

  if (!analysis && !loading && !error) {
    return (
      <Card>
        <CardContent className="pt-5 flex flex-col items-center gap-3 py-8">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Análise de governança de cupons não executada.</p>
          <Button variant="outline" size="sm" className="gap-2" onClick={analyze}>
            <RefreshCw className="h-3.5 w-3.5" /> Analisar Agora
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Governança de Cupons
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-5 flex flex-col items-center gap-3 py-8">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="gap-2" onClick={analyze}>
            <RefreshCw className="h-3.5 w-3.5" /> Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  const riskCfg = RISK_CONFIG[analysis.risk_level] ?? RISK_CONFIG.low;
  const RiskIcon = riskCfg.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Governança de Cupons
            <Badge variant={riskCfg.variant} className="text-[10px] ml-1 gap-1">
              <RiskIcon className="h-3 w-3" /> {riskCfg.label}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={analyze}>
            <RefreshCw className="h-3 w-3" /> Reanalisar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{analysis.summary}</p>

        {/* Abusive Coupons */}
        {analysis.abusive_coupons.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cupons Suspeitos ({analysis.abusive_coupons.length})
            </h4>
            {analysis.abusive_coupons.map((c, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono font-medium">{c.coupon_code}</span>
                  <Badge
                    variant={c.severity === 'critical' ? 'destructive' : 'outline'}
                    className="text-[10px]"
                  >
                    {c.severity === 'critical' ? 'Crítico' : 'Atenção'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{c.reason}</p>
                <p className="text-xs text-primary">↳ {c.recommendation}</p>
              </div>
            ))}
          </div>
        )}

        {/* Excessive Discount Tenants */}
        {analysis.excessive_discount_tenants.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tenants com Desconto Excessivo ({analysis.excessive_discount_tenants.length})
            </h4>
            {analysis.excessive_discount_tenants.map((t, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t.tenant_name ?? t.tenant_id.slice(0, 8)}</span>
                  <Badge
                    variant={t.severity === 'critical' ? 'destructive' : 'outline'}
                    className="text-[10px]"
                  >
                    R$ {t.total_discount_brl.toFixed(2).replace('.', ',')} — {t.coupon_count} cupom(ns)
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{t.reason}</p>
                <p className="text-xs text-primary">↳ {t.recommendation}</p>
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recomendações
            </h4>
            <ul className="space-y-1">
              {analysis.recommendations.map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="text-primary mt-0.5">•</span> {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
