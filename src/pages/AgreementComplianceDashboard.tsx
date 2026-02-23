/**
 * Dashboard Jurídico — Agreement Compliance
 *
 * Company level:
 *   - Termos pendentes
 *   - Termos por cargo
 *   - Termos expirando
 *   - Colaboradores bloqueados por ausência de assinatura
 *
 * Tenant level:
 *   - Ranking de conformidade
 *   - Risco jurídico
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Scale, Building2, AlertTriangle, Clock, Shield, Users,
  ChevronDown, ChevronRight, FileCheck, Ban, Briefcase,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StatsCard } from '@/components/shared/StatsCard';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { useTenant } from '@/contexts/TenantContext';
import {
  agreementComplianceDashboardService,
  type CompanyAgreementMetrics,
} from '@/domains/employee-agreement/agreement-compliance-dashboard.service';

// ── Risk config ──

const RISK_CONFIG: Record<string, { label: string; color: string; bgClass: string; textClass: string }> = {
  critico: { label: 'Crítico', color: 'hsl(0, 72%, 51%)', bgClass: 'bg-destructive/10', textClass: 'text-destructive' },
  alto:    { label: 'Alto', color: 'hsl(38, 92%, 50%)', bgClass: 'bg-warning/10', textClass: 'text-warning' },
  medio:   { label: 'Médio', color: 'hsl(210, 100%, 52%)', bgClass: 'bg-info/10', textClass: 'text-info' },
  baixo:   { label: 'Baixo', color: 'hsl(160, 84%, 29%)', bgClass: 'bg-primary/10', textClass: 'text-primary' },
};

const CHART_COLORS = [
  'hsl(0, 72%, 51%)',
  'hsl(38, 92%, 50%)',
  'hsl(210, 100%, 52%)',
  'hsl(160, 84%, 29%)',
];

export default function AgreementComplianceDashboard() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['agreement-compliance-dashboard', tenantId],
    queryFn: () => agreementComplianceDashboardService.getTenantDashboard(tenantId!),
    enabled: !!tenantId,
  });

  // ── Derived data ──
  const riskDistribution = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, number> = { critico: 0, alto: 0, medio: 0, baixo: 0 };
    data.companies.forEach(c => { counts[c.risk_level]++; });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: RISK_CONFIG[name].label, value, fill: RISK_CONFIG[name].color }));
  }, [data]);

  const complianceRanking = useMemo(() => {
    if (!data) return [];
    return data.companies.map(c => ({
      name: c.company_name.length > 20 ? c.company_name.slice(0, 20) + '…' : c.company_name,
      conformidade: c.compliance_rate,
      fill: RISK_CONFIG[c.risk_level].color,
    }));
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground animate-pulse">Carregando dashboard jurídico...</p>
      </div>
    );
  }

  const tenantRisk = RISK_CONFIG[data.tenant_risk_level];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Scale className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Dashboard Jurídico</h1>
          <p className="text-sm text-muted-foreground">
            Conformidade de termos e acordos por empresa
          </p>
        </div>
      </div>

      {/* ═══ TENANT-LEVEL KPIs ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard
          title="Conformidade Geral"
          value={`${data.tenant_compliance_rate}%`}
          subtitle="Taxa média do grupo"
          icon={Shield}
        />
        <StatsCard
          title="Termos Pendentes"
          value={data.total_pending}
          subtitle="Aguardando assinatura"
          icon={Clock}
        />
        <StatsCard
          title="Expirando em 30 dias"
          value={data.total_expiring}
          subtitle="Renovação necessária"
          icon={AlertTriangle}
        />
        <StatsCard
          title="Colaboradores Bloqueados"
          value={data.total_blocked_employees}
          subtitle="Sem assinatura obrigatória"
          icon={Ban}
        />
      </div>

      {/* ═══ CHARTS ROW ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk distribution pie */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold font-display text-card-foreground">Risco Jurídico por Empresa</h2>
            </div>
            {riskDistribution.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={riskDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} strokeWidth={2}>
                      {riskDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {riskDistribution.map(item => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                      <span className="text-card-foreground">{item.name}</span>
                      <span className="ml-auto font-semibold text-muted-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum dado disponível</p>
            )}
          </CardContent>
        </Card>

        {/* Compliance ranking bar */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold font-display text-card-foreground">Ranking de Conformidade</h2>
            </div>
            {complianceRanking.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={complianceRanking} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} />
                  <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 10, fill: 'hsl(215, 15%, 50%)' }} />
                  <Tooltip formatter={(value: number) => [`${value}%`, 'Conformidade']} />
                  <Bar dataKey="conformidade" radius={[0, 4, 4, 0]}>
                    {complianceRanking.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma empresa cadastrada</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ RISCO CONSOLIDADO ═══ */}
      <Card className={cn('border-l-4', `border-l-[${tenantRisk.color}]`)}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', tenantRisk.bgClass)}>
              <AlertTriangle className={cn('h-6 w-6', tenantRisk.textClass)} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Risco Jurídico Consolidado</p>
              <p className={cn('text-2xl font-bold font-display', tenantRisk.textClass)}>
                {tenantRisk.label}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm text-muted-foreground">Conformidade</p>
              <p className="text-2xl font-bold font-display text-card-foreground">{data.tenant_compliance_rate}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ DETALHAMENTO POR EMPRESA ═══ */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold font-display text-foreground">Detalhamento por Empresa</h2>
        </div>

        {data.companies.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma empresa encontrada.</p>
        )}

        {data.companies.map((company) => (
          <CompanyCard
            key={company.company_id}
            company={company}
            isExpanded={expandedCompany === company.company_id}
            onToggle={() => setExpandedCompany(
              expandedCompany === company.company_id ? null : company.company_id
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ── Company Card ──

function CompanyCard({
  company,
  isExpanded,
  onToggle,
}: {
  company: CompanyAgreementMetrics;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const riskCfg = RISK_CONFIG[company.risk_level];

  return (
    <Card className={cn('transition-all', isExpanded && 'ring-1 ring-primary/20')}>
      <CardContent className="p-0">
        {/* Header */}
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
        >
          {isExpanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          }
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', riskCfg.bgClass)}>
            <Building2 className={cn('h-4 w-4', riskCfg.textClass)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-card-foreground">{company.company_name}</p>
            <p className="text-xs text-muted-foreground">
              {company.total_agreements} termos · {company.pending_count} pendentes · {company.blocked_employees.length} bloqueados
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-sm font-bold text-card-foreground">{company.compliance_rate}%</p>
              <p className="text-[10px] text-muted-foreground">conformidade</p>
            </div>
            <Badge variant="outline" className={cn('text-[10px]', riskCfg.bgClass, riskCfg.textClass)}>
              {riskCfg.label}
            </Badge>
          </div>
        </button>

        {/* Expanded details */}
        {isExpanded && (
          <div className="border-t border-border px-4 pb-4 pt-3 space-y-5 animate-fade-in">
            {/* Compliance progress */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Taxa de conformidade</span>
                <span className="text-xs font-semibold text-card-foreground">{company.compliance_rate}%</span>
              </div>
              <Progress value={company.compliance_rate} className="h-2" />
            </div>

            {/* Metrics row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricPill icon={Clock} label="Pendentes" value={company.pending_count} variant="warning" />
              <MetricPill icon={FileCheck} label="Assinados" value={company.signed_count} variant="success" />
              <MetricPill icon={AlertTriangle} label="Expirando" value={company.expiring_soon_count} variant="danger" />
              <MetricPill icon={Ban} label="Bloqueados" value={company.blocked_employees.length} variant="danger" />
            </div>

            {/* By position */}
            {company.by_position.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-card-foreground">Termos por Cargo</span>
                </div>
                <div className="space-y-1">
                  {company.by_position.map(pos => (
                    <div key={pos.position_name} className="flex items-center gap-3 text-xs p-2 rounded-md bg-muted/30">
                      <span className="text-card-foreground font-medium flex-1 truncate">{pos.position_name}</span>
                      <Badge variant="secondary" className="text-[10px]">{pos.total} total</Badge>
                      <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">{pos.pending} pendentes</Badge>
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">{pos.signed} assinados</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Blocked employees */}
            {company.blocked_employees.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Ban className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-semibold text-destructive">Colaboradores Bloqueados</span>
                </div>
                <div className="space-y-1">
                  {company.blocked_employees.slice(0, 10).map(emp => (
                    <div key={emp.employee_id} className="flex items-center gap-3 text-xs p-2 rounded-md bg-destructive/5 border border-destructive/10">
                      <Users className="h-3.5 w-3.5 text-destructive shrink-0" />
                      <span className="text-card-foreground font-medium flex-1 truncate">{emp.employee_name}</span>
                      <span className="text-destructive font-semibold">{emp.pending_mandatory_count} termo{emp.pending_mandatory_count > 1 ? 's' : ''} faltante{emp.pending_mandatory_count > 1 ? 's' : ''}</span>
                    </div>
                  ))}
                  {company.blocked_employees.length > 10 && (
                    <p className="text-[10px] text-muted-foreground text-center pt-1">
                      + {company.blocked_employees.length - 10} colaboradores
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Metric Pill ──

function MetricPill({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: any;
  label: string;
  value: number;
  variant: 'warning' | 'success' | 'danger';
}) {
  const styles = {
    warning: 'bg-warning/10 text-warning',
    success: 'bg-primary/10 text-primary',
    danger: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-3">
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', styles[variant])}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-bold font-display text-card-foreground">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
