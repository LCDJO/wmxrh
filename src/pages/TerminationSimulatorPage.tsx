/**
 * TerminationSimulatorPage — Simulador de Rescisão com LegalRiskScore
 *
 * Connects to rescission-calculator.engine for all CLT calculations.
 * Three scenarios rendered side-by-side: aviso trabalhado, indenizado,
 * and estimated judicial reversal cost.
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, ShieldAlert, Scale, FileText, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useEmployeesSimple, useEmployee } from '@/domains/hooks';
import { useTenant } from '@/contexts/TenantContext';
import {
  calculateRescission,
  calculateAvisoPrevioDays,
  calculateProportionalMonths,
} from '@/domains/automated-offboarding/rescission-calculator.engine';
import type { OffboardingType, AvisoPrevioType } from '@/domains/automated-offboarding/types';
import { OFFBOARDING_TYPE_LABELS } from '@/domains/automated-offboarding/types';

// ── Helpers ──

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function daysWorkedInMonth(terminationDate: Date): number {
  return terminationDate.getDate();
}

// ── LegalRiskScore heuristic (based on available employee data) ──

interface RiskFactor {
  label: string;
  ok: boolean;
  detail: string;
}

function computeRiskFactors(employee: any, terminationType: OffboardingType): RiskFactor[] {
  const tenure = employee.hire_date
    ? (new Date().getTime() - new Date(employee.hire_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    : 0;

  return [
    {
      label: 'Estabilidade Gestante',
      ok: true,
      detail: 'Verificação manual necessária',
    },
    {
      label: 'CIPA',
      ok: true,
      detail: 'Verificação manual necessária',
    },
    {
      label: 'Dirigente Sindical',
      ok: true,
      detail: 'Verificação manual necessária',
    },
    {
      label: 'Estabilidade Acidentária',
      ok: employee.status !== 'on_leave',
      detail: employee.status === 'on_leave' ? 'Colaborador afastado — verificar causa' : 'Sem afastamento ativo',
    },
    {
      label: 'Exame Demissional (NR-7)',
      ok: false,
      detail: 'Agendar exame demissional antes do desligamento',
    },
    {
      label: 'EPIs Pendentes',
      ok: true,
      detail: 'Verificar entrega de EPIs pendentes',
    },
    {
      label: 'Gradação Disciplinar',
      ok: terminationType !== 'justa_causa',
      detail: terminationType === 'justa_causa'
        ? 'Justa causa requer advertências e suspensões documentadas'
        : 'Não aplicável para este tipo de desligamento',
    },
    {
      label: 'Documentação Completa',
      ok: !!(employee.cpf && employee.email),
      detail: employee.cpf && employee.email ? 'CPF e e-mail cadastrados' : 'Dados cadastrais incompletos',
    },
  ];
}

function riskScore(factors: RiskFactor[]): number {
  const ok = factors.filter(f => f.ok).length;
  return Math.round((ok / factors.length) * 100);
}

// ── Component ──

export default function TerminationSimulatorPage() {
  const [activeTab, setActiveTab] = useState('simulator');
  const { currentTenant } = useTenant();

  // Form state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [terminationType, setTerminationType] = useState<OffboardingType>('sem_justa_causa');
  const [terminationDate, setTerminationDate] = useState(today());
  const [saldoFgts, setSaldoFgts] = useState('');
  const [descontos, setDescontos] = useState('');
  const [dependentes, setDependentes] = useState('0');
  const [acordoMutuo, setAcordoMutuo] = useState(false);

  const { data: employees = [] } = useEmployeesSimple();
  const { data: employee } = useEmployee(selectedEmployeeId);

  // ── Compute rescission scenarios ──
  const scenarios = useMemo(() => {
    if (!employee || !employee.hire_date || !terminationDate) return null;

    const salario = employee.current_salary ?? employee.base_salary ?? 0;
    if (salario <= 0) return null;

    const termDate = new Date(terminationDate);
    const avisoDays = calculateAvisoPrevioDays(employee.hire_date, terminationDate);
    const diasNoMes = daysInMonth(termDate);
    const diasTrabalhados = daysWorkedInMonth(termDate);
    const mesesFerias = calculateProportionalMonths(employee.hire_date, terminationDate) % 12;
    const meses13 = calculateProportionalMonths(
      `${new Date(terminationDate).getFullYear()}-01-01`,
      terminationDate,
    );
    const fgts = parseFloat(saldoFgts) || 0;
    const desc = parseFloat(descontos) || 0;
    const deps = parseInt(dependentes) || 0;

    const baseInput = {
      salario_base: salario,
      data_admissao: employee.hire_date,
      data_desligamento: terminationDate,
      aviso_previo_days: avisoDays,
      dias_trabalhados_mes: diasTrabalhados,
      dias_no_mes: diasNoMes,
      ferias_vencidas_periodos: 0,
      meses_ferias_proporcionais: mesesFerias,
      meses_13_proporcional: meses13,
      saldo_fgts: fgts,
      dependentes_irrf: deps,
      descontos_diversos: desc,
      acordo_mutuo: acordoMutuo,
    };

    const trabalhado = calculateRescission({
      ...baseInput,
      offboarding_type: terminationType,
      aviso_previo_type: 'trabalhado' as AvisoPrevioType,
    });

    const indenizado = calculateRescission({
      ...baseInput,
      offboarding_type: terminationType,
      aviso_previo_type: 'indenizado' as AvisoPrevioType,
    });

    // Judicial reversal: if justa_causa is reversed → sem_justa_causa + indenized + 50% extra moral damage estimate
    const reversao = calculateRescission({
      ...baseInput,
      offboarding_type: 'sem_justa_causa',
      aviso_previo_type: 'indenizado' as AvisoPrevioType,
    });
    const danomoral = salario * 3; // conservative estimate: 3 salaries

    return { trabalhado, indenizado, reversao, danomoral, avisoDays };
  }, [employee, terminationDate, terminationType, saldoFgts, descontos, dependentes, acordoMutuo]);

  const riskFactors = useMemo(() => {
    if (!employee) return [];
    return computeRiskFactors(employee, terminationType);
  }, [employee, terminationType]);

  const score = riskScore(riskFactors);
  const scoreLabel = score >= 80 ? 'Seguro' : score >= 60 ? 'Moderado' : score >= 40 ? 'Atenção' : 'Alto Risco';
  const scoreVariant = score >= 80 ? 'default' : score >= 60 ? 'secondary' : 'destructive';

  const hasEmployee = !!employee;
  const hasResult = !!scenarios;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Simulador de Rescisão</h1>
        <p className="text-muted-foreground">Simule cenários de desligamento com análise de risco jurídico</p>
      </div>

      {/* ── Input Form ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da Simulação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Colaborador *</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {(employees as any[]).map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Desligamento *</Label>
              <Select value={terminationType} onValueChange={v => setTerminationType(v as OffboardingType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(OFFBOARDING_TYPE_LABELS) as [OffboardingType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data de Desligamento *</Label>
              <Input type="date" value={terminationDate} onChange={e => setTerminationDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Saldo FGTS (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={saldoFgts}
                onChange={e => setSaldoFgts(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Descontos Diversos (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Adiantamentos, empréstimos..."
                value={descontos}
                onChange={e => setDescontos(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Dependentes IRRF</Label>
              <Input
                type="number"
                min="0"
                max="20"
                value={dependentes}
                onChange={e => setDependentes(e.target.value)}
              />
            </div>
          </div>

          {hasEmployee && (
            <div className="mt-4 p-3 rounded-lg bg-muted/40 text-sm flex flex-wrap gap-4">
              <span><strong>Salário:</strong> R$ {fmt(employee.current_salary ?? employee.base_salary ?? 0)}</span>
              <span><strong>Admissão:</strong> {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('pt-BR') : '—'}</span>
              {scenarios && <span><strong>Aviso prévio:</strong> {scenarios.avisoDays} dias</span>}
              {terminationType === 'sem_justa_causa' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acordoMutuo}
                    onChange={e => setAcordoMutuo(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span>Acordo Mútuo (CLT 484-A)</span>
                </label>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="simulator">Simulador</TabsTrigger>
          <TabsTrigger value="risk">Risco Jurídico</TabsTrigger>
          <TabsTrigger value="report">Relatório Pré-Demissão</TabsTrigger>
        </TabsList>

        {/* ══════════ SIMULATOR TAB ══════════ */}
        <TabsContent value="simulator">
          {!hasEmployee && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">
                  Selecione um colaborador para iniciar a simulação de rescisão com cálculos automáticos baseados na CLT.
                </p>
              </CardContent>
            </Card>
          )}

          {hasEmployee && !hasResult && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">
                  Colaborador sem salário cadastrado. Atualize o salário na ficha do colaborador e tente novamente.
                </p>
              </CardContent>
            </Card>
          )}

          {hasResult && scenarios && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Aviso Prévio Trabalhado */}
                <Card className="border-chart-2/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calculator className="h-5 w-5 text-chart-2" />
                      Aviso Prévio Trabalhado
                    </CardTitle>
                    <CardDescription>O colaborador cumpre o período trabalhando</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ScenarioLines result={scenarios.trabalhado} accentClass="text-chart-2" />
                  </CardContent>
                </Card>

                {/* Aviso Prévio Indenizado */}
                <Card className="border-primary/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Scale className="h-5 w-5 text-primary" />
                      Aviso Prévio Indenizado
                    </CardTitle>
                    <CardDescription>O colaborador é dispensado imediatamente</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ScenarioLines result={scenarios.indenizado} accentClass="text-primary" />
                  </CardContent>
                </Card>

                {/* Reversão Judicial */}
                <Card className="border-destructive/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ShieldAlert className="h-5 w-5 text-destructive" />
                      Reversão Judicial
                    </CardTitle>
                    <CardDescription>Custo estimado se Justa Causa for revertida</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Verbas Rescisórias</span>
                        <span className="font-medium text-foreground">R$ {fmt(scenarios.reversao.valor_liquido)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">FGTS + Multa</span>
                        <span className="font-medium text-foreground">R$ {fmt(scenarios.reversao.total_fgts_a_receber)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Dano Moral (estimado)</span>
                        <span className="font-medium text-foreground">R$ {fmt(scenarios.danomoral)}</span>
                      </div>
                      <hr className="border-border" />
                      <div className="flex justify-between font-bold">
                        <span>Risco Total</span>
                        <span className="text-destructive">
                          R$ {fmt(scenarios.reversao.valor_liquido + scenarios.reversao.total_fgts_a_receber + scenarios.danomoral)}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="w-full justify-center text-[10px] border-destructive/30 text-destructive">
                      ESTIMATIVA — consulte jurídico
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Itemized breakdown */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Verbas Rescisórias — Detalhamento (Aviso Indenizado)</CardTitle>
                  <CardDescription className="text-[11px]">{scenarios.indenizado.disclaimer}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {scenarios.indenizado.linhas.map(l => (
                      <div key={l.codigo} className="flex justify-between text-sm py-1 border-b border-border/50">
                        <div>
                          <span className="font-medium text-card-foreground">{l.descricao}</span>
                          {l.referencia && <span className="text-muted-foreground ml-2 text-xs">({l.referencia})</span>}
                          <span className="text-muted-foreground ml-2 text-[10px]">{l.base_legal}</span>
                        </div>
                        <span className={l.tipo === 'desconto' ? 'text-destructive font-medium' : 'text-card-foreground font-medium'}>
                          {l.tipo === 'desconto' ? '−' : '+'} R$ {fmt(l.valor)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm pt-2 font-bold">
                      <span>Valor Líquido</span>
                      <span className="text-primary">R$ {fmt(scenarios.indenizado.valor_liquido)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">FGTS a receber</span>
                      <span className="font-semibold text-card-foreground">R$ {fmt(scenarios.indenizado.total_fgts_a_receber)}</span>
                    </div>
                    {scenarios.indenizado.multa_fgts > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">  Multa FGTS ({scenarios.indenizado.multa_fgts_percentual}%)</span>
                        <span className="text-card-foreground">R$ {fmt(scenarios.indenizado.multa_fgts)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ══════════ RISK TAB ══════════ */}
        <TabsContent value="risk">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                LegalRiskScore
              </CardTitle>
              <CardDescription>Avaliação de fatores de risco baseados na CLT e NRs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!hasEmployee ? (
                <p className="text-sm text-muted-foreground text-center py-4">Selecione um colaborador para ver a análise de risco.</p>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-bold text-foreground">{score}</div>
                    <div className="flex-1">
                      <Progress value={score} className="h-3" />
                      <p className="text-xs text-muted-foreground mt-1">Score de 0 a 100 (quanto maior, mais seguro)</p>
                    </div>
                    <Badge variant={scoreVariant}>{scoreLabel}</Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {riskFactors.map(factor => (
                      <div key={factor.label} className="flex items-start gap-3 p-3 rounded-md border border-border">
                        {factor.ok
                          ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        }
                        <div>
                          <p className="text-sm font-medium text-card-foreground">{factor.label}</p>
                          <p className="text-xs text-muted-foreground">{factor.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-lg border border-warning/30 bg-warning/5">
                    <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Fatores marcados como "verificação manual necessária" (gestante, CIPA, sindical) devem ser confirmados com o departamento jurídico antes do desligamento.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════ PRE-TERMINATION REPORT TAB ══════════ */}
        <TabsContent value="report">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Relatório Pré-Demissão
              </CardTitle>
              <CardDescription>Resumo do colaborador e exposição trabalhista estimada</CardDescription>
            </CardHeader>
            <CardContent>
              {!hasEmployee ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4 opacity-30" />
                  <p>Selecione um colaborador para gerar o relatório.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard
                      label="Tipo Desligamento"
                      value={OFFBOARDING_TYPE_LABELS[terminationType]}
                      colorClass="text-primary"
                    />
                    <StatCard
                      label="Aviso Prévio"
                      value={scenarios ? `${scenarios.avisoDays} dias` : '—'}
                      colorClass="text-chart-2"
                    />
                    <StatCard
                      label="Risco Jurídico"
                      value={`${score}/100`}
                      colorClass={score >= 80 ? 'text-primary' : score >= 60 ? 'text-warning' : 'text-destructive'}
                    />
                    <StatCard
                      label="Custo Estimado (Ind.)"
                      value={scenarios ? `R$ ${fmt(scenarios.indenizado.valor_liquido + scenarios.indenizado.total_fgts_a_receber)}` : '—'}
                      colorClass="text-card-foreground"
                    />
                  </div>

                  {/* Employee data */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados do Colaborador</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <ReportRow label="Nome" value={employee.name} />
                      <ReportRow label="CPF" value={employee.cpf ?? '—'} />
                      <ReportRow label="Cargo" value={employee.positions?.title ?? '—'} />
                      <ReportRow label="Empresa" value={employee.companies?.name ?? '—'} />
                      <ReportRow label="Departamento" value={employee.departments?.name ?? '—'} />
                      <ReportRow label="Admissão" value={employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('pt-BR') : '—'} />
                      <ReportRow label="Salário Atual" value={`R$ ${fmt(employee.current_salary ?? employee.base_salary ?? 0)}`} />
                      <ReportRow label="Status" value={employee.status} />
                    </div>
                  </div>

                  {hasResult && scenarios && (
                    <div className="mt-6 space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Resumo Financeiro</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div className="p-3 rounded-lg border border-border">
                          <p className="text-xs text-muted-foreground mb-1">Aviso Trabalhado</p>
                          <p className="font-bold text-chart-2">R$ {fmt(scenarios.trabalhado.valor_liquido + scenarios.trabalhado.total_fgts_a_receber)}</p>
                          <p className="text-[10px] text-muted-foreground">líquido + FGTS</p>
                        </div>
                        <div className="p-3 rounded-lg border border-primary/30">
                          <p className="text-xs text-muted-foreground mb-1">Aviso Indenizado</p>
                          <p className="font-bold text-primary">R$ {fmt(scenarios.indenizado.valor_liquido + scenarios.indenizado.total_fgts_a_receber)}</p>
                          <p className="text-[10px] text-muted-foreground">líquido + FGTS</p>
                        </div>
                        <div className="p-3 rounded-lg border border-destructive/30">
                          <p className="text-xs text-muted-foreground mb-1">Risco Judicial Máx.</p>
                          <p className="font-bold text-destructive">
                            R$ {fmt(scenarios.reversao.valor_liquido + scenarios.reversao.total_fgts_a_receber + scenarios.danomoral)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">estimativa conservadora</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-start gap-2 p-3 rounded-lg border border-border bg-muted/10">
                    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Este relatório é uma simulação para apoio à decisão. Os valores reais dependem de homologação sindical, exames demissionais e confirmação de benefícios/descontos. Consulte o departamento jurídico antes de qualquer desligamento.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ──

function ScenarioLines({ result, accentClass }: { result: ReturnType<typeof calculateRescission>; accentClass: string }) {
  const proventos = result.linhas.filter(l => l.tipo === 'provento');
  const hasAviso = proventos.some(l => l.codigo === 'AVISO_PREVIO_IND');

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Saldo Salário</span>
        <span className="font-medium text-foreground">
          R$ {fmt(result.linhas.find(l => l.codigo === 'SALDO_SALARIO')?.valor ?? 0)}
        </span>
      </div>
      {hasAviso && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Aviso Indenizado</span>
          <span className="font-medium text-foreground">
            R$ {fmt(result.linhas.find(l => l.codigo === 'AVISO_PREVIO_IND')?.valor ?? 0)}
          </span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-muted-foreground">13º Proporcional</span>
        <span className="font-medium text-foreground">
          R$ {fmt(result.linhas.find(l => l.codigo === 'DECIMO_TERCEIRO_PROP')?.valor ?? 0)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Férias Proporcionais</span>
        <span className="font-medium text-foreground">
          R$ {fmt(result.linhas.find(l => l.codigo === 'FERIAS_PROPORCIONAIS')?.valor ?? 0)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">
          FGTS{result.multa_fgts_percentual > 0 ? ` + Multa ${result.multa_fgts_percentual}%` : ''}
        </span>
        <span className="font-medium text-foreground">R$ {fmt(result.total_fgts_a_receber)}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>INSS + IRRF</span>
        <span>− R$ {fmt(result.inss_desconto + result.irrf_desconto)}</span>
      </div>
      <hr className="border-border" />
      <div className="flex justify-between font-bold">
        <span>Total Estimado</span>
        <span className={accentClass}>
          R$ {fmt(result.valor_liquido + result.total_fgts_a_receber)}
        </span>
      </div>
    </div>
  );
}

function StatCard({ label, value, colorClass }: { label: string; value: string; colorClass: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="pt-4 text-center">
        <p className={`text-lg font-bold ${colorClass} leading-tight`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-card-foreground">{value}</span>
    </div>
  );
}
