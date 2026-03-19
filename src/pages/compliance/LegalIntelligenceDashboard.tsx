/**
 * LegalIntelligenceDashboard — "Inteligência Jurídica" dashboard
 *
 * Tenant level:
 *  - Mudanças legislativas recentes
 *  - Impacto por empresa
 *  - Nível médio de risco jurídico
 *
 * Company level (expandable):
 *  - Cargos afetados
 *  - Ações pendentes
 *  - Prazo de adequação
 */

import { useState, useMemo } from 'react';
import {
  Scale, Building2, AlertTriangle, Clock, Shield, Users,
  ChevronDown, ChevronRight, FileText, CheckCircle2, TrendingUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StatsCard } from '@/components/shared/StatsCard';
import { cn } from '@/lib/utils';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis,
} from 'recharts';

// ── Mock data (will be replaced by real queries when interpretation engine persists data) ──

interface LegalChange {
  id: string;
  norm_codigo: string;
  titulo: string;
  data_publicacao: string;
  gravidade: 'baixo' | 'medio' | 'alto' | 'critico';
  areas_impactadas: string[];
  status: 'novo' | 'em_analise' | 'plano_gerado' | 'concluido';
}

interface CompanyImpact {
  company_id: string;
  company_name: string;
  mudancas_afetadas: number;
  cargos_afetados: CargoImpact[];
  acoes_pendentes: number;
  acoes_concluidas: number;
  prazo_adequacao_dias: number;
  risco: 'baixo' | 'medio' | 'alto' | 'critico';
}

interface CargoImpact {
  cargo_nome: string;
  funcionarios: number;
  nrs_afetadas: string[];
  risco: 'baixo' | 'medio' | 'alto' | 'critico';
}

// Demo data
const DEMO_CHANGES: LegalChange[] = [
  { id: '1', norm_codigo: 'NR-01', titulo: 'Atualização do PGR — Riscos Psicossociais', data_publicacao: '2026-02-10', gravidade: 'critico', areas_impactadas: ['seguranca_trabalho', 'saude_ocupacional', 'treinamentos'], status: 'plano_gerado' },
  { id: '2', norm_codigo: 'NR-07', titulo: 'Novos parâmetros para PCMSO', data_publicacao: '2026-02-05', gravidade: 'alto', areas_impactadas: ['saude_ocupacional'], status: 'em_analise' },
  { id: '3', norm_codigo: 'NR-06', titulo: 'Revisão dos EPIs para trabalho em altura', data_publicacao: '2026-01-28', gravidade: 'medio', areas_impactadas: ['epi', 'seguranca_trabalho'], status: 'plano_gerado' },
  { id: '4', norm_codigo: 'NR-17', titulo: 'Atualização ergonômica para home office', data_publicacao: '2026-01-15', gravidade: 'baixo', areas_impactadas: ['seguranca_trabalho'], status: 'concluido' },
  { id: '5', norm_codigo: 'Portaria MTE 234', titulo: 'Obrigatoriedade de evento S-2240 atualizado', data_publicacao: '2026-02-18', gravidade: 'alto', areas_impactadas: ['esocial'], status: 'novo' },
];

const DEMO_COMPANY_IMPACTS: CompanyImpact[] = [
  {
    company_id: 'c1', company_name: 'Indústria Alpha Ltda', mudancas_afetadas: 3,
    cargos_afetados: [
      { cargo_nome: 'Operador de Máquinas', funcionarios: 45, nrs_afetadas: ['NR-01', 'NR-12'], risco: 'critico' },
      { cargo_nome: 'Soldador', funcionarios: 18, nrs_afetadas: ['NR-01', 'NR-06'], risco: 'alto' },
      { cargo_nome: 'Eletricista', funcionarios: 12, nrs_afetadas: ['NR-10', 'NR-01'], risco: 'alto' },
    ],
    acoes_pendentes: 8, acoes_concluidas: 2, prazo_adequacao_dias: 15, risco: 'critico',
  },
  {
    company_id: 'c2', company_name: 'Tech Solutions S.A.', mudancas_afetadas: 2,
    cargos_afetados: [
      { cargo_nome: 'Desenvolvedor', funcionarios: 60, nrs_afetadas: ['NR-17'], risco: 'baixo' },
      { cargo_nome: 'Analista de Suporte', funcionarios: 25, nrs_afetadas: ['NR-17'], risco: 'baixo' },
    ],
    acoes_pendentes: 3, acoes_concluidas: 1, prazo_adequacao_dias: 45, risco: 'medio',
  },
  {
    company_id: 'c3', company_name: 'Construtora Beta', mudancas_afetadas: 4,
    cargos_afetados: [
      { cargo_nome: 'Pedreiro', funcionarios: 80, nrs_afetadas: ['NR-01', 'NR-06', 'NR-18'], risco: 'critico' },
      { cargo_nome: 'Encarregado de Obra', funcionarios: 8, nrs_afetadas: ['NR-01', 'NR-18', 'NR-35'], risco: 'alto' },
      { cargo_nome: 'Auxiliar de Obra', funcionarios: 35, nrs_afetadas: ['NR-01', 'NR-06'], risco: 'alto' },
    ],
    acoes_pendentes: 12, acoes_concluidas: 0, prazo_adequacao_dias: 10, risco: 'critico',
  },
];

// ── Helpers ──

const RISK_CONFIG: Record<string, { label: string; color: string; bgClass: string; textClass: string }> = {
  critico: { label: 'Crítico', color: 'hsl(0, 72%, 51%)', bgClass: 'bg-destructive/10', textClass: 'text-destructive' },
  alto:    { label: 'Alto', color: 'hsl(38, 92%, 50%)', bgClass: 'bg-warning/10', textClass: 'text-warning' },
  medio:   { label: 'Médio', color: 'hsl(210, 100%, 52%)', bgClass: 'bg-info/10', textClass: 'text-info' },
  baixo:   { label: 'Baixo', color: 'hsl(160, 84%, 29%)', bgClass: 'bg-primary/10', textClass: 'text-primary' },
};

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  novo:          { label: 'Novo', classes: 'bg-destructive/10 text-destructive border-destructive/30' },
  em_analise:    { label: 'Em Análise', classes: 'bg-warning/10 text-warning border-warning/30' },
  plano_gerado:  { label: 'Plano Gerado', classes: 'bg-info/10 text-info border-info/30' },
  concluido:     { label: 'Concluído', classes: 'bg-primary/10 text-primary border-primary/30' },
};

const AREA_LABELS: Record<string, string> = {
  seguranca_trabalho: 'SST',
  saude_ocupacional: 'Saúde',
  treinamentos: 'Treinamento',
  epi: 'EPI',
  esocial: 'eSocial',
  folha_pagamento: 'Folha',
  jornada: 'Jornada',
  sindical: 'Sindical',
};

const CHART_COLORS = [
  'hsl(0, 72%, 51%)',
  'hsl(38, 92%, 50%)',
  'hsl(210, 100%, 52%)',
  'hsl(160, 84%, 29%)',
];

export default function LegalIntelligenceDashboard() {
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  // ── Tenant-level KPIs ──
  const totalChanges = DEMO_CHANGES.length;
  const pendingChanges = DEMO_CHANGES.filter(c => c.status !== 'concluido').length;
  const totalAffectedEmployees = DEMO_COMPANY_IMPACTS.reduce(
    (s, c) => s + c.cargos_afetados.reduce((s2, ca) => s2 + ca.funcionarios, 0), 0
  );

  const avgRisk = useMemo(() => {
    const scores = { baixo: 1, medio: 2, alto: 3, critico: 4 };
    const total = DEMO_COMPANY_IMPACTS.reduce((s, c) => s + scores[c.risco], 0);
    const avg = total / DEMO_COMPANY_IMPACTS.length;
    if (avg >= 3.5) return 'critico';
    if (avg >= 2.5) return 'alto';
    if (avg >= 1.5) return 'medio';
    return 'baixo';
  }, []);

  const riskDistribution = useMemo(() => {
    const counts: Record<string, number> = { critico: 0, alto: 0, medio: 0, baixo: 0 };
    DEMO_COMPANY_IMPACTS.forEach(c => { counts[c.risco]++; });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: RISK_CONFIG[name].label, value, fill: RISK_CONFIG[name].color }));
  }, []);

  const impactByCompany = useMemo(() =>
    DEMO_COMPANY_IMPACTS.map(c => ({
      name: c.company_name.length > 18 ? c.company_name.slice(0, 18) + '…' : c.company_name,
      pendentes: c.acoes_pendentes,
      concluidas: c.acoes_concluidas,
    })),
  []);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Scale className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Inteligência Jurídica</h1>
          <p className="text-sm text-muted-foreground">
            Monitoramento de mudanças legislativas e impacto nas empresas do grupo
          </p>
        </div>
      </div>

      {/* ═══ TENANT-LEVEL KPIs ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard
          title="Mudanças Recentes"
          value={totalChanges}
          subtitle={`${pendingChanges} pendente${pendingChanges !== 1 ? 's' : ''}`}
          icon={FileText}
        />
        <StatsCard
          title="Empresas Impactadas"
          value={DEMO_COMPANY_IMPACTS.length}
          subtitle={`${totalAffectedEmployees} colaboradores`}
          icon={Building2}
        />
        <StatsCard
          title="Risco Médio"
          value={RISK_CONFIG[avgRisk].label}
          subtitle="Nível consolidado"
          icon={Shield}
          className={`border-l-4 border-l-[${RISK_CONFIG[avgRisk].color}]`}
        />
        <StatsCard
          title="Ações Pendentes"
          value={DEMO_COMPANY_IMPACTS.reduce((s, c) => s + c.acoes_pendentes, 0)}
          subtitle={`${DEMO_COMPANY_IMPACTS.reduce((s, c) => s + c.acoes_concluidas, 0)} concluídas`}
          icon={Clock}
        />
      </div>

      {/* ═══ CHARTS ROW ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk distribution pie */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold font-display text-card-foreground">Distribuição de Risco</h2>
            </div>
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
          </CardContent>
        </Card>

        {/* Actions by company bar */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold font-display text-card-foreground">Ações por Empresa</h2>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={impactByCompany}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215, 15%, 50%)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} />
                <Tooltip />
                <Bar dataKey="pendentes" name="Pendentes" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="concluidas" name="Concluídas" fill="hsl(160, 84%, 29%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ═══ MUDANÇAS RECENTES ═══ */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Mudanças Legislativas Recentes</h2>
          </div>
          <div className="space-y-2">
            {DEMO_CHANGES.map(change => {
              const riskCfg = RISK_CONFIG[change.gravidade];
              const statusCfg = STATUS_CONFIG[change.status];
              return (
                <div key={change.id} className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', riskCfg.bgClass)}>
                    <AlertTriangle className={cn('h-4 w-4', riskCfg.textClass)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-card-foreground">{change.norm_codigo}</span>
                      <span className="text-sm text-muted-foreground truncate">{change.titulo}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">{new Date(change.data_publicacao).toLocaleDateString('pt-BR')}</span>
                      <div className="flex gap-1">
                        {change.areas_impactadas.slice(0, 3).map(a => (
                          <Badge key={a} variant="secondary" className="text-[9px] px-1 py-0">{AREA_LABELS[a] ?? a}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('text-[10px] shrink-0', riskCfg.bgClass, riskCfg.textClass)}>
                    {riskCfg.label}
                  </Badge>
                  <Badge variant="outline" className={cn('text-[10px] shrink-0', statusCfg.classes)}>
                    {statusCfg.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═══ IMPACTO POR EMPRESA (expandable) ═══ */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold font-display text-foreground">Impacto por Empresa</h2>
        </div>

        {DEMO_COMPANY_IMPACTS.map(company => {
          const isExpanded = expandedCompany === company.company_id;
          const riskCfg = RISK_CONFIG[company.risco];
          const totalAcoes = company.acoes_pendentes + company.acoes_concluidas;
          const progressPct = totalAcoes > 0 ? Math.round((company.acoes_concluidas / totalAcoes) * 100) : 0;

          return (
            <Card key={company.company_id} className={cn(
              'transition-all',
              isExpanded && 'ring-1 ring-primary/20',
            )}>
              <CardContent className="p-0">
                {/* Company header (clickable) */}
                <button
                  onClick={() => setExpandedCompany(isExpanded ? null : company.company_id)}
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
                      {company.mudancas_afetadas} mudança{company.mudancas_afetadas > 1 ? 's' : ''} ·{' '}
                      {company.cargos_afetados.length} cargo{company.cargos_afetados.length > 1 ? 's' : ''} ·{' '}
                      {company.cargos_afetados.reduce((s, c) => s + c.funcionarios, 0)} colaboradores
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className={cn('text-xs font-semibold', company.prazo_adequacao_dias <= 15 ? 'text-destructive' : 'text-muted-foreground')}>
                          {company.prazo_adequacao_dias}d
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">prazo</p>
                    </div>
                    <Badge variant="outline" className={cn('text-[10px]', riskCfg.bgClass, riskCfg.textClass)}>
                      {riskCfg.label}
                    </Badge>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-4 animate-fade-in">
                    {/* Progress */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Progresso das ações</span>
                          <span className="text-xs font-semibold text-card-foreground">{progressPct}%</span>
                        </div>
                        <Progress value={progressPct} className="h-2" />
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span className="text-warning font-semibold">{company.acoes_pendentes} pendentes</span>
                        <span className="text-primary font-semibold">{company.acoes_concluidas} concluídas</span>
                      </div>
                    </div>

                    {/* Cargos afetados */}
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Cargos Afetados
                      </h4>
                      <div className="space-y-2">
                        {company.cargos_afetados.map((cargo, i) => {
                          const cargoRisk = RISK_CONFIG[cargo.risco];
                          return (
                            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
                              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-card-foreground">{cargo.cargo_nome}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground">{cargo.funcionarios} colaboradores</span>
                                  <div className="flex gap-1">
                                    {cargo.nrs_afetadas.map(nr => (
                                      <Badge key={nr} variant="secondary" className="text-[9px] px-1 py-0">{nr}</Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <Badge variant="outline" className={cn('text-[9px]', cargoRisk.bgClass, cargoRisk.textClass)}>
                                {cargoRisk.label}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Prazo de adequação */}
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/10">
                      <Clock className={cn('h-4 w-4', company.prazo_adequacao_dias <= 15 ? 'text-destructive' : 'text-warning')} />
                      <span className="text-sm text-card-foreground">
                        Prazo de adequação:{' '}
                        <strong className={company.prazo_adequacao_dias <= 15 ? 'text-destructive' : 'text-warning'}>
                          {company.prazo_adequacao_dias} dias
                        </strong>
                      </span>
                      {company.prazo_adequacao_dias <= 15 && (
                        <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30 ml-auto">
                          Urgente
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
