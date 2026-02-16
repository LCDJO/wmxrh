/**
 * Payroll Simulation Dashboard
 * 
 * Company View: custo total folha simulada, custo por grupo, ranking por custo
 * Employee View: breakdown completo, gráfico de composição salarial
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatsCard } from '@/components/shared/StatsCard';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DollarSign, Users, TrendingUp, Calculator, BarChart3,
  AlertTriangle, Building2, ArrowUpDown, Search,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { simulatePayroll } from '@/domains/payroll-simulation';
import { buildStandardRuleDTOs } from '@/domains/labor-rules';
import type { SimulationInput, PayrollSimulationOutput } from '@/domains/payroll-simulation';
import type { LaborRuleDefinition } from '@/domains/labor-rules';

// ── Mock data for demo ──

const MOCK_EMPLOYEES = [
  { id: '1', name: 'Ana Silva', department: 'Engenharia', group: 'Grupo Alpha', salary: 12000, extras50: 15, noturnas: 0 },
  { id: '2', name: 'Carlos Souza', department: 'Comercial', group: 'Grupo Alpha', salary: 8500, extras50: 8, noturnas: 0 },
  { id: '3', name: 'Maria Santos', department: 'Engenharia', group: 'Grupo Beta', salary: 15000, extras50: 0, noturnas: 0 },
  { id: '4', name: 'João Oliveira', department: 'Operações', group: 'Grupo Beta', salary: 4500, extras50: 20, noturnas: 40 },
  { id: '5', name: 'Luísa Ferreira', department: 'RH', group: 'Grupo Alpha', salary: 7200, extras50: 0, noturnas: 0 },
  { id: '6', name: 'Pedro Lima', department: 'Operações', group: 'Grupo Beta', salary: 5800, extras50: 25, noturnas: 60 },
  { id: '7', name: 'Beatriz Costa', department: 'Financeiro', group: 'Grupo Alpha', salary: 9500, extras50: 5, noturnas: 0 },
  { id: '8', name: 'Rafael Mendes', department: 'Engenharia', group: 'Grupo Beta', salary: 11000, extras50: 10, noturnas: 0 },
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

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CHART_COLORS = [
  'hsl(160, 84%, 29%)',
  'hsl(210, 100%, 52%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(280, 60%, 50%)',
  'hsl(160, 84%, 45%)',
];

// ── Company Dashboard Tab ──

function CompanyDashboard({
  simulations,
}: {
  simulations: { name: string; group: string; department: string; output: PayrollSimulationOutput }[];
}) {
  const [sortBy, setSortBy] = useState<'cost' | 'factor'>('cost');

  const totalCost = simulations.reduce((s, e) => s + e.output.employerCost.custo_total_empregador, 0);
  const avgFactor = simulations.reduce((s, e) => s + e.output.employerCost.fator_custo, 0) / simulations.length;
  const totalInss = simulations.reduce((s, e) => s + e.output.encargos.valor_inss_estimado, 0);
  const totalFgts = simulations.reduce((s, e) => s + e.output.encargos.valor_fgts_estimado, 0);

  // Group by group
  const byGroup = useMemo(() => {
    const map = new Map<string, number>();
    simulations.forEach(s => {
      map.set(s.group, (map.get(s.group) ?? 0) + s.output.employerCost.custo_total_empregador);
    });
    return Array.from(map, ([name, value]) => ({ name, value: Math.round(value) }));
  }, [simulations]);

  // Ranking
  const ranking = useMemo(() => {
    const sorted = [...simulations].sort((a, b) =>
      sortBy === 'cost'
        ? b.output.employerCost.custo_total_empregador - a.output.employerCost.custo_total_empregador
        : b.output.employerCost.fator_custo - a.output.employerCost.fator_custo
    );
    return sorted;
  }, [simulations, sortBy]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Custo Total Folha (Simulado)" value={fmt(totalCost)} icon={DollarSign} subtitle="⚠️ SIMULAÇÃO" />
        <StatsCard title="Fator Custo Médio" value={`${avgFactor.toFixed(2)}x`} icon={TrendingUp} subtitle="sobre salário base" />
        <StatsCard title="INSS Total Estimado" value={fmt(totalInss)} icon={Calculator} subtitle="empregado + patronal" />
        <StatsCard title="FGTS Total Estimado" value={fmt(totalFgts)} icon={BarChart3} subtitle="depósito mensal" />
      </div>

      <div className="flex items-center gap-2 px-1">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <p className="text-xs text-muted-foreground">
          SIMULAÇÃO — valores estimados para análise financeira. NÃO substitui cálculos oficiais de folha.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost by Group */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Custo por Grupo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byGroup}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => fmt(value)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Custo Total" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ranking */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-primary" />
                Ranking por Custo
              </CardTitle>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'cost' | 'factor')}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cost">Custo Total</SelectItem>
                  <SelectItem value="factor">Fator Custo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border max-h-[260px] overflow-y-auto">
              {ranking.map((emp, i) => (
                <div key={emp.name} className="flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.department}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{fmt(emp.output.employerCost.custo_total_empregador)}</p>
                    <Badge variant="outline" className="text-[10px] mt-0.5">
                      {emp.output.employerCost.fator_custo.toFixed(2)}x
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Employee View Tab ──

function EmployeeView({
  simulations,
}: {
  simulations: { name: string; group: string; department: string; output: PayrollSimulationOutput }[];
}) {
  const [selectedId, setSelectedId] = useState(0);
  const [search, setSearch] = useState('');

  const filtered = simulations.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const selected = filtered[selectedId] ?? filtered[0];
  const sim = selected?.output;

  if (!sim) return <p className="text-muted-foreground text-sm p-6">Nenhum funcionário encontrado.</p>;

  // Pie chart composition
  const pieData = [
    { name: 'Salário Líquido', value: sim.employerCost.salario_liquido },
    { name: 'INSS Empregado', value: sim.taxes.inss },
    { name: 'IRRF', value: sim.taxes.irrf },
    { name: 'FGTS', value: sim.taxes.fgts },
    { name: 'Encargos Patronais', value: sim.employerCost.inss_patronal + sim.employerCost.rat + sim.employerCost.terceiros },
    { name: 'Provisões', value: sim.reflections.total_provisoes },
  ].filter(d => d.value > 0);

  const breakdownRows = [
    { label: 'Salário Base', value: sim.input.salario_base },
    { label: 'Total Proventos', value: sim.summary.totalProventos },
    { label: 'Total Descontos', value: sim.summary.totalDescontos, negative: true },
    null,
    { label: 'INSS Empregado', value: sim.taxes.inss, negative: true },
    { label: 'IRRF', value: sim.taxes.irrf, negative: true },
    { label: 'Salário Líquido', value: sim.employerCost.salario_liquido, highlight: true },
    null,
    { label: 'FGTS (8%)', value: sim.taxes.fgts },
    { label: 'INSS Patronal (20%)', value: sim.employerCost.inss_patronal },
    { label: 'RAT (2%)', value: sim.employerCost.rat },
    { label: 'Terceiros (5,8%)', value: sim.employerCost.terceiros },
    null,
    { label: 'Férias + 1/3 (provisão)', value: sim.reflections.ferias_terco },
    { label: '13º Salário (provisão)', value: sim.reflections.decimo_terceiro },
    { label: 'Multa FGTS (provisão)', value: sim.reflections.provisao_multa_fgts },
    null,
    { label: 'Benefícios', value: sim.employerCost.beneficios },
    { label: 'Custo Total Empregador', value: sim.employerCost.custo_total_empregador, highlight: true },
    { label: 'Fator Custo', value: sim.employerCost.fator_custo, suffix: 'x' },
  ];

  return (
    <div className="space-y-6">
      {/* Employee selector */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar funcionário..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedId(0); }}
            className="pl-9"
          />
        </div>
        <Select value={String(selectedId)} onValueChange={(v) => setSelectedId(Number(v))}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filtered.map((s, i) => (
              <SelectItem key={i} value={String(i)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 px-1">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <p className="text-xs text-muted-foreground">
          SIMULAÇÃO — valores estimados. NÃO substitui cálculos oficiais.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Breakdown table */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Breakdown — {selected.name}</CardTitle>
            <CardDescription>{selected.department} · {selected.group}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {breakdownRows.map((row, i) => {
                if (!row) return <Separator key={`sep-${i}`} className="my-0" />;
                return (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between px-6 py-2.5 ${row.highlight ? 'bg-accent/40 font-semibold' : ''}`}
                  >
                    <span className="text-sm text-foreground">{row.label}</span>
                    <span className={`text-sm font-mono ${row.negative ? 'text-destructive' : 'text-foreground'}`}>
                      {row.suffix ? `${row.value}${row.suffix}` : (row.negative ? `- ${fmt(row.value)}` : fmt(row.value))}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Composição Salarial</CardTitle>
            <CardDescription>Distribuição do custo total</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  dataKey="value"
                  paddingAngle={2}
                  stroke="none"
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
                />
                <Tooltip formatter={(value: number) => fmt(value)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Rubrics */}
      {sim.rubrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rubricas Calculadas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-6 py-2.5 text-left font-medium text-muted-foreground">Rubrica</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Categoria</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Valor</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">INSS</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">FGTS</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">IRRF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sim.rubrics.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-2.5 font-medium text-foreground">{r.rule_name}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="text-[10px]">{r.category}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmt(r.valor)}</td>
                      <td className="px-4 py-2.5 text-center">{r.integra_inss ? '✓' : '—'}</td>
                      <td className="px-4 py-2.5 text-center">{r.integra_fgts ? '✓' : '—'}</td>
                      <td className="px-4 py-2.5 text-center">{r.integra_irrf ? '✓' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Main Page ──

export default function PayrollSimulation() {
  const rules = useMemo(() => buildRules(), []);

  const simulations = useMemo(() => {
    return MOCK_EMPLOYEES.map(emp => {
      const input: SimulationInput = {
        salario_base: emp.salary,
        horas_extras_50: emp.extras50,
        horas_noturnas: emp.noturnas,
      };
      return {
        name: emp.name,
        group: emp.group,
        department: emp.department,
        output: simulatePayroll(input, rules),
      };
    });
  }, [rules]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Simulação de Folha</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Projeção financeira de custo de pessoal — análise preventiva
        </p>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList>
          <TabsTrigger value="company" className="gap-2">
            <Building2 className="h-4 w-4" />
            Visão Empresa
          </TabsTrigger>
          <TabsTrigger value="employee" className="gap-2">
            <Users className="h-4 w-4" />
            Visão Funcionário
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <CompanyDashboard simulations={simulations} />
        </TabsContent>

        <TabsContent value="employee">
          <EmployeeView simulations={simulations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
