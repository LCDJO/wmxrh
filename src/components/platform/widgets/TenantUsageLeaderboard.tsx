/**
 * TenantUsageLeaderboard — Ranking de tenants por engajamento com a plataforma.
 * Exibido no painel do platform admin.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp } from 'lucide-react';
import { getRevenueIntelligenceEngine } from '@/domains/revenue-intelligence';
import type { TenantUsageScore } from '@/domains/revenue-intelligence';

const MODULE_LABELS: Record<string, string> = {
  employees:   'Funcionários',
  companies:   'Empresas',
  departments: 'Departamentos',
  positions:   'Cargos',
  compensation:'Salários',
  ats:         'Recrutamento',
  performance: 'Performance',
  automation:  'Automação',
};

function AdoptionBar({ pct }: { pct: number }) {
  const pctDisplay = Math.round(pct * 100);
  const color =
    pctDisplay >= 75 ? 'bg-emerald-500' :
    pctDisplay >= 40 ? 'bg-amber-500' :
    'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pctDisplay}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground w-8 text-right">{pctDisplay}%</span>
    </div>
  );
}

export default function TenantUsageLeaderboard({ limit = 20 }: { limit?: number }) {
  const [data, setData] = useState<TenantUsageScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const engine = getRevenueIntelligenceEngine();
    engine.gamification.getTenantUsageRanking(limit)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [limit]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-5">
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-500" /> Ranking de Tenants — Adoção de Módulos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">Sem dados de engajamento ainda.</p>
        ) : (
          <div className="space-y-3">
            {data.map((row, idx) => (
              <div
                key={row.tenant_id}
                className={`p-3 rounded-lg border transition-colors ${
                  idx < 3 ? 'border-primary/30 bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Rank */}
                  <div className="flex items-center justify-center h-8 w-8 rounded-full border-2 border-muted text-sm font-bold text-muted-foreground shrink-0">
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Name + points */}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{row.tenant_name ?? row.tenant_id}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                        <span className="text-sm font-bold">{row.total_points} pts</span>
                      </div>
                    </div>

                    {/* Adoption bar */}
                    <AdoptionBar pct={row.adoption_pct} />

                    {/* Active modules */}
                    {row.active_modules.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {row.active_modules.map(mod => (
                          <Badge key={mod} variant="secondary" className="text-[10px] py-0 px-1.5">
                            {MODULE_LABELS[mod] ?? mod}
                          </Badge>
                        ))}
                        {row.plan_modules_count > 0 && (
                          <span className="text-[10px] text-muted-foreground self-center">
                            {row.active_modules.length}/{row.plan_modules_count} módulos
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
