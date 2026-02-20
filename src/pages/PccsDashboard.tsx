/**
 * PCCS Dashboard — Career & Legal Intelligence overview
 */
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Building2, Users, Route, AlertTriangle, ShieldAlert,
  DollarSign, Briefcase, TrendingUp, Plus,
} from 'lucide-react';

interface PccsDashboardStats {
  total_positions: number;
  total_paths: number;
  total_tracks: number;
  total_companies: number;
  total_departments: number;
  positions_with_risk: number;
  positions_with_adicional: number;
  positions_without_cbo: number;
  alerts_by_severity: Record<string, number>;
  total_open_alerts: number;
  financial_impact_monthly: number;
  positions_by_level: Record<string, number>;
}

const LEVEL_LABELS: Record<string, string> = {
  junior: 'Júnior',
  pleno: 'Pleno',
  senior: 'Sênior',
  lider: 'Líder',
  especialista: 'Especialista',
};

const SEVERITY_COLORS: Record<string, string> = {
  critico: 'bg-destructive text-destructive-foreground',
  alto: 'bg-orange-500/90 text-white',
  medio: 'bg-amber-500/90 text-white',
  baixo: 'bg-primary/80 text-primary-foreground',
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PccsDashboard() {
  const { currentTenant } = useTenant();
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery<PccsDashboardStats>({
    queryKey: ['pccs-dashboard', currentTenant?.id],
    enabled: !!currentTenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pccs_dashboard_stats', {
        p_tenant_id: currentTenant!.id,
      });
      if (error) throw error;
      return data as unknown as PccsDashboardStats;
    },
    staleTime: 30_000,
  });

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard PCCS</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="h-14 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard PCCS</h1>
          <p className="text-sm text-muted-foreground">
            Plano de Cargos, Carreiras e Salários — Visão consolidada
          </p>
        </div>
        <Button onClick={() => navigate('/pccs-wizard')}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Cargo
        </Button>
      </div>

      {/* ── KPI Row 1: Org Structure ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Estrutura Organizacional
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={Building2} label="Empresas" value={stats.total_companies} />
          <StatCard icon={Users} label="Departamentos" value={stats.total_departments} />
          <StatCard icon={Briefcase} label="Cargos Ativos" value={stats.total_positions} />
          <StatCard icon={Route} label="Trilhas de Carreira" value={stats.total_paths} />
          <StatCard icon={TrendingUp} label="Progressões" value={stats.total_tracks} />
        </div>
      </section>

      <Separator />

      {/* ── KPI Row 2: Risk & Compliance ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Risco & Compliance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={ShieldAlert}
            label="Cargos com Risco"
            value={stats.positions_with_risk}
            sub={`${stats.positions_with_risk > 0 ? Math.round((stats.positions_with_risk / Math.max(stats.total_positions, 1)) * 100) : 0}% do total`}
          />
          <StatCard
            icon={DollarSign}
            label="Cargos com Adicional Legal"
            value={stats.positions_with_adicional}
            sub="Insalubridade / Periculosidade"
          />
          <StatCard
            icon={AlertTriangle}
            label="Cargos sem CBO"
            value={stats.positions_without_cbo}
            sub="Necessário para eSocial"
          />
          <StatCard
            icon={DollarSign}
            label="Impacto Financeiro (mensal)"
            value={fmt(stats.financial_impact_monthly)}
            sub="Base salarial em cargos com adicional"
          />
        </div>
      </section>

      <Separator />

      {/* ── Bottom Row: Alerts + Distribution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts by severity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Alertas Abertos ({stats.total_open_alerts})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.total_open_alerts === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum alerta pendente ✔</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.alerts_by_severity).map(([sev, count]) => (
                  <Badge key={sev} className={`${SEVERITY_COLORS[sev] ?? 'bg-muted text-muted-foreground'} text-xs`}>
                    {sev.charAt(0).toUpperCase() + sev.slice(1)}: {count as number}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Positions by level */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Cargos por Nível
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.positions_by_level).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cargo cadastrado</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(stats.positions_by_level).map(([level, count]) => {
                  const pct = Math.round(((count as number) / Math.max(stats.total_positions, 1)) * 100);
                  return (
                    <div key={level} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-24">{LEVEL_LABELS[level] ?? level}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-foreground w-8 text-right">{count as number}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
