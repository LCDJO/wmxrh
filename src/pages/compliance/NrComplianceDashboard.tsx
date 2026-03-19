/**
 * NR Compliance Dashboard
 *
 * Company view: expired NRs, expiring trainings, blocked employees
 * Tenant view:  compliance ranking by company
 */

import { useMemo } from 'react';
import {
  ShieldAlert, Clock, UserX, Building2, CheckCircle2,
  AlertTriangle, GraduationCap, TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StatsCard } from '@/components/shared/StatsCard';
import {
  useNrTrainingAssignments,
  useRestrictedEmployees,
  useCompaniesSimple,
} from '@/domains/hooks';
import { useScope } from '@/contexts/ScopeContext';

// ── Helpers ──

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const BLOCKING_LABELS: Record<string, { label: string; className: string }> = {
  hard_block: { label: 'Bloqueio Total', className: 'bg-destructive/10 text-destructive' },
  soft_block: { label: 'Restrição Parcial', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  warning: { label: 'Alerta', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  none: { label: 'OK', className: 'bg-accent text-accent-foreground' },
};

export default function NrComplianceDashboard() {
  const { scope } = useScope();
  const { data: assignments = [], isLoading } = useNrTrainingAssignments();
  const { data: restricted = [] } = useRestrictedEmployees();
  const { data: companies = [] } = useCompaniesSimple();

  // ── Computed stats ──

  const stats = useMemo(() => {
    const expired = assignments.filter((a: any) => a.status === 'expired');
    const overdue = assignments.filter((a: any) => a.status === 'overdue');
    const completed = assignments.filter((a: any) => a.status === 'completed');
    const total = assignments.length;

    // Expiring in 30/60/90 days
    const expiring30 = completed.filter((a: any) =>
      a.data_validade && daysUntil(a.data_validade) <= 30 && daysUntil(a.data_validade) > 0,
    );
    const expiring60 = completed.filter((a: any) =>
      a.data_validade && daysUntil(a.data_validade) <= 60 && daysUntil(a.data_validade) > 0,
    );

    const complianceRate = total > 0
      ? Math.round(((completed.length) / total) * 100)
      : 100;

    return {
      total,
      expired: expired.length,
      overdue: overdue.length,
      completed: completed.length,
      blocked: restricted.length,
      expiring30: expiring30.length,
      expiring60: expiring60.length,
      complianceRate,
      expiredList: expired,
      overdueList: overdue,
      expiring30List: expiring30,
    };
  }, [assignments, restricted]);

  // ── Company ranking (tenant-level view) ──

  const companyRanking = useMemo(() => {
    if (scope.level !== 'tenant' || companies.length === 0) return [];

    const companyMap = new Map<string, { name: string; total: number; compliant: number; expired: number; blocked: number }>();

    for (const c of companies) {
      companyMap.set(c.id, { name: c.name, total: 0, compliant: 0, expired: 0, blocked: 0 });
    }

    for (const a of assignments) {
      const cid = (a as any).company_id;
      if (!cid || !companyMap.has(cid)) continue;
      const entry = companyMap.get(cid)!;
      entry.total++;
      if ((a as any).status === 'completed') entry.compliant++;
      if ((a as any).status === 'expired') entry.expired++;
    }

    for (const r of restricted) {
      const cid = (r as any).company_id;
      if (cid && companyMap.has(cid)) companyMap.get(cid)!.blocked++;
    }

    return Array.from(companyMap.values())
      .map(c => ({
        ...c,
        rate: c.total > 0 ? Math.round((c.compliant / c.total) * 100) : 100,
      }))
      .sort((a, b) => a.rate - b.rate);
  }, [assignments, restricted, companies, scope.level]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">NR Compliance</h1>
        <p className="text-muted-foreground">
          Treinamentos obrigatórios · Vencimentos · Bloqueios funcionais
        </p>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatsCard
          title="Total Treinamentos"
          value={stats.total}
          icon={GraduationCap}
        />
        <StatsCard
          title="NRs Vencidas"
          value={stats.expired}
          subtitle={`${stats.overdue} em atraso`}
          icon={ShieldAlert}
          className={stats.expired > 0 ? 'border-l-4 border-l-destructive' : ''}
        />
        <StatsCard
          title="Vencendo 30d"
          value={stats.expiring30}
          subtitle={`${stats.expiring60} em 60d`}
          icon={Clock}
          className={stats.expiring30 > 0 ? 'border-l-4 border-l-yellow-500' : ''}
        />
        <StatsCard
          title="Bloqueados"
          value={stats.blocked}
          icon={UserX}
          className={stats.blocked > 0 ? 'border-l-4 border-l-destructive' : ''}
        />
        <StatsCard
          title="Compliance"
          value={`${stats.complianceRate}%`}
          icon={CheckCircle2}
          className={stats.complianceRate < 80 ? 'border-l-4 border-l-orange-500' : ''}
        />
        <StatsCard
          title="Empresas"
          value={companies.length}
          icon={Building2}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── NRs Vencidas ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              NRs Vencidas ({stats.expired})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.expiredList.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-primary" />
                <span className="text-sm">Nenhum treinamento vencido</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {stats.expiredList.slice(0, 20).map((a: any) => {
                  const bl = BLOCKING_LABELS[a.blocking_level] || BLOCKING_LABELS.none;
                  return (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {a.employees?.name || 'Funcionário'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          NR-{a.nr_number} · {a.training_name}
                        </p>
                        {a.data_validade && (
                          <p className="text-xs text-destructive">
                            Expirou: {new Date(a.data_validade).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                      <Badge className={`text-[10px] shrink-0 ${bl.className}`}>{bl.label}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Próximos do Vencimento ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              Vencendo em 30 dias ({stats.expiring30})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.expiring30List.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-primary" />
                <span className="text-sm">Nenhum treinamento próximo do vencimento</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {stats.expiring30List.slice(0, 20).map((a: any) => {
                  const days = daysUntil(a.data_validade);
                  return (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {a.employees?.name || 'Funcionário'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          NR-{a.nr_number} · {a.training_name}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {days}d restantes
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Funcionários Bloqueados ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserX className="h-4 w-4 text-destructive" />
              Operação Restrita ({restricted.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {restricted.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-primary" />
                <span className="text-sm">Nenhum funcionário bloqueado</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {restricted.map((emp: any) => {
                  const motivos = (emp.restricao_motivo as any[] | null) ?? [];
                  return (
                    <div key={emp.id} className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                      <p className="text-sm font-medium text-card-foreground">{emp.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {motivos.map((m: any, i: number) => (
                          <Badge key={i} variant="destructive" className="text-[10px]">
                            NR-{m.nr}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Ranking por Empresa (tenant-level) ── */}
        {scope.level === 'tenant' && companyRanking.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-primary" />
                Ranking Compliance por Empresa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[320px] overflow-y-auto">
                {companyRanking.map((c, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-card-foreground truncate">{c.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {c.blocked > 0 && (
                          <Badge variant="destructive" className="text-[10px]">
                            {c.blocked} bloqueado{c.blocked > 1 ? 's' : ''}
                          </Badge>
                        )}
                        {c.expired > 0 && (
                          <Badge className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                            {c.expired} vencida{c.expired > 1 ? 's' : ''}
                          </Badge>
                        )}
                        <span className={`text-xs font-bold ${c.rate >= 80 ? 'text-primary' : c.rate >= 50 ? 'text-yellow-600' : 'text-destructive'}`}>
                          {c.rate}%
                        </span>
                      </div>
                    </div>
                    <Progress
                      value={c.rate}
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
