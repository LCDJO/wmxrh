import { useMemo } from 'react';
import { AlertTriangle, ShieldAlert, Activity, Utensils, Building2, Users, CheckCircle2 } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { usePcmsoAlertCounts, usePcmsoOverdueAlerts, useComplianceScan, useRiskExposuresTenant, useBenefitPlans } from '@/domains/hooks';
import { useCompanies } from '@/domains/hooks';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'hsl(0, 72%, 51%)',
  warning: 'hsl(38, 92%, 50%)',
  info: 'hsl(210, 100%, 52%)',
};

const RISK_COLORS: Record<string, string> = {
  critico: 'hsl(0, 72%, 51%)',
  alto: 'hsl(25, 95%, 53%)',
  medio: 'hsl(38, 92%, 50%)',
  baixo: 'hsl(160, 84%, 29%)',
};

const ALERT_LABELS: Record<string, string> = {
  overdue: 'Vencido',
  expiring_soon: 'Vence em 30d',
  upcoming: 'Próximo (60d)',
  ok: 'Em dia',
};

const ALERT_COLORS: Record<string, string> = {
  overdue: 'hsl(0, 72%, 51%)',
  expiring_soon: 'hsl(38, 92%, 50%)',
  upcoming: 'hsl(210, 100%, 52%)',
  ok: 'hsl(160, 84%, 29%)',
};

export default function LaborDashboard() {
  const { data: alertCounts } = usePcmsoAlertCounts();
  const { data: overdueAlerts = [] } = usePcmsoOverdueAlerts();
  const { data: violations = [] } = useComplianceScan();
  const { data: riskExposures = [] } = useRiskExposuresTenant();
  const { data: benefitPlans = [] } = useBenefitPlans();
  const { data: companies = [] } = useCompanies();

  // Companies without active PCMSO
  const companiesWithoutPcmso = useMemo(() => {
    // We don't have health_programs data loaded here, so we show company count as context
    return companies.length;
  }, [companies]);

  // Risk by category
  const riskByLevel = useMemo(() => {
    const map: Record<string, number> = { critico: 0, alto: 0, medio: 0, baixo: 0 };
    riskExposures.forEach(r => {
      const level = (r as any).risk_level || 'baixo';
      map[level] = (map[level] || 0) + 1;
    });
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([level, count]) => ({ name: level.charAt(0).toUpperCase() + level.slice(1), value: count, level }));
  }, [riskExposures]);

  // Food benefit costs
  const foodBenefitCost = useMemo(() => {
    const foodTypes = ['va', 'vr', 'cesta', 'flex'];
    const nameMap: Record<string, string> = { va: 'Vale Alimentação', vr: 'Vale Refeição', cesta: 'Cesta Básica', flex: 'Flex' };
    return benefitPlans
      .filter(p => foodTypes.includes(p.benefit_type) && p.is_active)
      .map(p => ({
        name: nameMap[p.benefit_type] || p.benefit_type.toUpperCase(),
        valor: p.base_value,
        empresa: p.employer_percentage || 100,
      }));
  }, [benefitPlans]);

  // Exam alert pie data
  const examAlertData = useMemo(() => {
    if (!alertCounts) return [];
    return (['overdue', 'expiring_soon', 'upcoming', 'ok'] as const)
      .filter(k => alertCounts[k] > 0)
      .map(k => ({ name: ALERT_LABELS[k], value: alertCounts[k], key: k }));
  }, [alertCounts]);

  const criticalViolations = violations.filter(v => v.severity === 'critical');
  const warningViolations = violations.filter(v => v.severity === 'warning');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Dashboard Trabalhista</h1>
        <p className="text-muted-foreground mt-1">Conformidade CLT · PCMSO · Riscos · Benefícios</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard
          title="Exames Vencidos"
          value={alertCounts?.overdue ?? '—'}
          subtitle={`${alertCounts?.expiring_soon ?? 0} vencendo em 30 dias`}
          icon={AlertTriangle}
          className={alertCounts?.overdue ? 'border-l-4 border-l-destructive' : ''}
        />
        <StatsCard
          title="Violações Críticas"
          value={criticalViolations.length}
          subtitle={`${warningViolations.length} avisos`}
          icon={ShieldAlert}
          className={criticalViolations.length > 0 ? 'border-l-4 border-l-destructive' : ''}
        />
        <StatsCard
          title="Exposições a Risco"
          value={riskExposures.length}
          subtitle={`${riskExposures.filter((r: any) => r.risk_level === 'critico' || r.risk_level === 'alto').length} alto/crítico`}
          icon={Activity}
        />
        <StatsCard
          title="Planos Alimentação"
          value={foodBenefitCost.length}
          subtitle={foodBenefitCost.length > 0 ? `R$ ${foodBenefitCost.reduce((s, f) => s + f.valor, 0).toLocaleString('pt-BR')}/mês base` : 'Nenhum ativo'}
          icon={Utensils}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PCMSO Exam Alerts Chart */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Situação Exames PCMSO</h2>
          </div>
          {examAlertData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={examAlertData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} strokeWidth={2}>
                    {examAlertData.map((entry) => (
                      <Cell key={entry.key} fill={ALERT_COLORS[entry.key]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} exames`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {examAlertData.map((item) => (
                  <div key={item.key} className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: ALERT_COLORS[item.key] }} />
                    <span className="text-card-foreground">{item.name}</span>
                    <span className="text-muted-foreground ml-auto font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mb-2 text-primary" />
              <p className="text-sm">Nenhum exame cadastrado</p>
            </div>
          )}
        </div>

        {/* Risk Exposure by Level */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Exposição a Risco por Grau</h2>
          </div>
          {riskByLevel.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={riskByLevel} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'hsl(215, 15%, 50%)' }} width={70} />
                <Tooltip formatter={(value: number) => [`${value} exposições`, '']} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {riskByLevel.map((entry) => (
                    <Cell key={entry.level} fill={RISK_COLORS[entry.level] || 'hsl(215, 15%, 50%)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mb-2 text-primary" />
              <p className="text-sm">Nenhuma exposição registrada</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Violations List */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Violações de Conformidade</h2>
          </div>
          {violations.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {violations.map((v, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <div
                    className="h-2.5 w-2.5 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: SEVERITY_COLORS[v.severity] || SEVERITY_COLORS.info }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-card-foreground">{v.employee_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{v.description}</p>
                    <span className="text-[10px] font-semibold uppercase tracking-wider mt-1 inline-block" style={{ color: SEVERITY_COLORS[v.severity] }}>
                      {v.severity === 'critical' ? 'Crítico' : v.severity === 'warning' ? 'Aviso' : 'Info'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mb-2 text-primary" />
              <p className="text-sm">Nenhuma violação detectada</p>
            </div>
          )}
        </div>

        {/* Food Benefit Costs */}
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <Utensils className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Custo Benefícios Alimentação</h2>
          </div>
          {foodBenefitCost.length > 0 ? (
            <div className="space-y-3">
              {foodBenefitCost.map((b, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{b.name}</p>
                    <p className="text-xs text-muted-foreground">Empresa paga {b.empresa}%</p>
                  </div>
                  <p className="text-sm font-semibold text-primary">R$ {b.valor.toLocaleString('pt-BR')}</p>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <p className="text-sm font-semibold text-card-foreground">Total Base/Mês</p>
                <p className="text-base font-bold text-primary">R$ {foodBenefitCost.reduce((s, f) => s + f.valor, 0).toLocaleString('pt-BR')}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Utensils className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Nenhum plano de alimentação ativo</p>
            </div>
          )}
        </div>
      </div>

      {/* Overdue Exams Detail */}
      {overdueAlerts.length > 0 && (
        <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Exames Vencidos / Vencendo</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Colaborador</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Tipo</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Último Exame</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Vencimento</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {overdueAlerts.slice(0, 10).map((alert) => {
                  const examLabels: Record<string, string> = {
                    admissional: 'Admissional', periodico: 'Periódico', demissional: 'Demissional',
                    mudanca_funcao: 'Mudança Função', retorno_trabalho: 'Retorno',
                  };
                  return (
                    <tr key={alert.exam_id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-2.5 font-medium text-card-foreground">{alert.employee_name}</td>
                      <td className="py-2.5 text-muted-foreground">{examLabels[alert.exam_type] || alert.exam_type}</td>
                      <td className="py-2.5 text-muted-foreground">{new Date(alert.exam_date).toLocaleDateString('pt-BR')}</td>
                      <td className="py-2.5 text-muted-foreground">{alert.next_exam_date ? new Date(alert.next_exam_date).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="py-2.5">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${ALERT_COLORS[alert.alert_status]}20`,
                            color: ALERT_COLORS[alert.alert_status],
                          }}
                        >
                          {alert.alert_status === 'overdue' ? 'Vencido' : 'Vencendo'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
