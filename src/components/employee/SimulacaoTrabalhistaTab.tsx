/**
 * Simulação Trabalhista Tab — Employee Profile
 * Shows: salário base, adicionais legais, encargos estimados, custo empresa
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Calculator, DollarSign, TrendingUp, Briefcase } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import { simulatePayroll } from '@/domains/payroll-simulation';
import { toEmployeeCostBreakdownView } from '@/domains/payroll-simulation/read-models';
import { buildStandardRuleDTOs } from '@/domains/labor-rules';
import type { SimulationInput } from '@/domains/payroll-simulation';
import type { LaborRuleDefinition } from '@/domains/labor-rules';

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CHART_COLORS = [
  'hsl(160, 84%, 29%)',
  'hsl(210, 100%, 52%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(280, 60%, 50%)',
  'hsl(160, 84%, 45%)',
  'hsl(200, 70%, 40%)',
];

function buildRules(): LaborRuleDefinition[] {
  return buildStandardRuleDTOs('t1', 'rs1').map((dto, i) => ({
    ...dto,
    id: `rule-${i}`,
    is_active: true,
    deleted_at: null,
    effective_from: '2024-01-01',
    effective_until: null,
    integra_salario: true,
    integra_dsr: dto.integra_dsr ?? false,
    aplica_reflexos: dto.aplica_reflexos ?? false,
    base_calculo: null,
    formula_expression: null,
    tiered_config: null,
    limite_horas: null,
    percentual_sobre_hora: null,
    oncall_tipo: null,
    created_at: '',
    updated_at: '',
  })) as unknown as LaborRuleDefinition[];
}

interface Props {
  employee: {
    id: string;
    name: string;
    base_salary?: number | null;
    current_salary?: number | null;
    departments?: { name: string } | null;
    companies?: { name: string } | null;
  };
}

export function SimulacaoTrabalhistaTab({ employee }: Props) {
  const salary = employee.current_salary || employee.base_salary || 0;

  const breakdown = useMemo(() => {
    if (salary <= 0) return null;
    const rules = buildRules();
    const input: SimulationInput = { salario_base: salary };
    const output = simulatePayroll(input, rules);
    return toEmployeeCostBreakdownView(output, {
      employee_id: employee.id,
      employee_name: employee.name,
      department: employee.departments?.name,
    });
  }, [salary, employee.id, employee.name, employee.departments?.name]);

  if (!breakdown) {
    return (
      <div className="bg-card rounded-xl shadow-card p-6 text-center">
        <p className="text-muted-foreground text-sm">Sem salário cadastrado para simular.</p>
      </div>
    );
  }

  const proventos = breakdown.line_items.filter(i => i.category === 'provento');
  const descontos = breakdown.line_items.filter(i => i.category === 'desconto');
  const encargos = breakdown.line_items.filter(i => i.category === 'encargo_patronal');
  const provisoes = breakdown.line_items.filter(i => i.category === 'provisao');

  return (
    <div className="space-y-5">
      {/* Disclaimer */}
      <div className="flex items-center gap-2 px-1">
        <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
        <p className="text-xs text-muted-foreground">
          SIMULAÇÃO — valores estimados para análise. NÃO substitui cálculos oficiais de folha.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign} label="Salário Base" value={fmt(breakdown.salario_base)} />
        <KpiCard icon={Calculator} label="Salário Líquido" value={fmt(breakdown.salario_liquido)} />
        <KpiCard icon={Briefcase} label="Custo Empresa" value={fmt(breakdown.custo_total_empregador)} accent />
        <KpiCard icon={TrendingUp} label="Fator Custo" value={`${breakdown.fator_custo.toFixed(2)}x`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Breakdown */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Decomposição de Custos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Section title="Proventos" items={proventos} />
            <Separator />
            <Section title="Descontos Empregado" items={descontos} negative />
            <Separator />
            <Section title="Encargos Patronais" items={encargos} />
            <Separator />
            <Section title="Provisões Mensais" items={provisoes} />
            <Separator />
            {/* Total */}
            <div className="flex items-center justify-between px-5 py-3 bg-accent/40">
              <span className="text-sm font-semibold text-foreground">Custo Total Empregador</span>
              <span className="text-sm font-bold font-mono text-foreground">{fmt(breakdown.custo_total_empregador)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Composição do Custo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={breakdown.composition}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  dataKey="value"
                  paddingAngle={2}
                  stroke="none"
                >
                  {breakdown.composition.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
                />
                <Tooltip
                  formatter={(value: number) => fmt(value)}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {breakdown.alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Alertas de Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {breakdown.alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <Badge variant={a.risk_level === 'critical' ? 'destructive' : 'outline'} className="text-[10px] shrink-0 mt-0.5">
                  {a.risk_level}
                </Badge>
                <span className="text-foreground">{a.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Encargos estimados */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Encargos Estimados (SIMULAÇÃO)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <EncField label="INSS Empregado" value={fmt(breakdown.encargos.valor_inss_estimado)} />
            <EncField label="IRRF" value={fmt(breakdown.encargos.valor_irrf_estimado)} />
            <EncField label="FGTS" value={fmt(breakdown.encargos.valor_fgts_estimado)} />
            <EncField label="Total Encargos" value={fmt(breakdown.encargos.total_encargos_estimados)} bold />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ──

function KpiCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-card rounded-xl shadow-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
      </div>
      <p className={`text-lg font-bold font-display ${accent ? 'text-primary' : 'text-card-foreground'}`}>{value}</p>
    </div>
  );
}

function Section({ title, items, negative }: { title: string; items: { label: string; value: number; percentage_of_base?: number }[]; negative?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground px-5 pt-3 pb-1 uppercase tracking-wide">{title}</p>
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between px-5 py-1.5 hover:bg-muted/30 transition-colors">
          <span className="text-sm text-foreground">{item.label}</span>
          <div className="flex items-center gap-3">
            {item.percentage_of_base != null && (
              <span className="text-[10px] text-muted-foreground">{item.percentage_of_base.toFixed(1)}%</span>
            )}
            <span className={`text-sm font-mono ${negative ? 'text-destructive' : 'text-foreground'}`}>
              {negative ? `- ${fmt(item.value)}` : fmt(item.value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function EncField({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm mt-0.5 ${bold ? 'font-bold text-foreground' : 'font-medium text-card-foreground'}`}>{value}</p>
    </div>
  );
}
