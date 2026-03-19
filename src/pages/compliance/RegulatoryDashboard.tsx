/**
 * Dashboard Regulatório — Regulatory Intelligence Overview
 *
 * Two views:
 *  - Tenant: recent changes, impacted companies, pending actions
 *  - Empresa: impacted positions, changed NRs, compliance needs
 */

import { useState, useMemo } from 'react';
import {
  Shield, Building2, AlertTriangle, Clock, CheckCircle2,
  FileText, Users, Zap, ChevronRight, Activity, TrendingUp,
  HardHat, Stethoscope, DollarSign, Bell, Filter,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { StatsCard } from '@/components/shared/StatsCard';
import { useCompanies, useEmployees } from '@/domains/hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── Mock data (pure domain types — will come from engines in production) ──

interface RecentChange {
  id: string;
  document_code: string;
  titulo: string;
  gravidade: 'critica' | 'alta' | 'media' | 'baixa';
  data_publicacao: string;
  areas_impacto: string[];
  status: 'pendente' | 'em_analise' | 'resolvido';
}

interface PendingAction {
  id: string;
  action_type: string;
  titulo: string;
  document_code: string;
  gravidade: 'critica' | 'alta' | 'media' | 'baixa';
  prazo_dias: number;
  status: 'pending' | 'approved' | 'executed';
  entity_count: number;
}

interface ImpactedCompany {
  company_id: string;
  company_name: string;
  total_impacts: number;
  critical_count: number;
  pending_actions: number;
  areas: string[];
}

interface CompanyPositionImpact {
  cargo_id: string;
  cargo_nome: string;
  nr_alteradas: string[];
  motivos: string[];
  adequacao_necessaria: boolean;
  funcionarios_afetados: number;
}

// Seed data for demonstration
const MOCK_CHANGES: RecentChange[] = [
  {
    id: '1', document_code: 'NR-7', titulo: 'Alteração PCMSO — novos exames periódicos',
    gravidade: 'critica', data_publicacao: '2026-02-18',
    areas_impacto: ['saude_ocupacional', 'pcmso'], status: 'pendente',
  },
  {
    id: '2', document_code: 'NR-6', titulo: 'Atualização catálogo de EPIs aprovados',
    gravidade: 'alta', data_publicacao: '2026-02-15',
    areas_impacto: ['epi'], status: 'em_analise',
  },
  {
    id: '3', document_code: 'CLT Art. 59', titulo: 'Nova regra de compensação de jornada',
    gravidade: 'media', data_publicacao: '2026-02-10',
    areas_impacto: ['folha_pagamento', 'jornada'], status: 'resolvido',
  },
  {
    id: '4', document_code: 'NR-35', titulo: 'Requisitos trabalho em altura atualizados',
    gravidade: 'alta', data_publicacao: '2026-02-08',
    areas_impacto: ['treinamento', 'epi'], status: 'pendente',
  },
  {
    id: '5', document_code: 'Portaria 3214', titulo: 'Consolidação alterações NR-1',
    gravidade: 'media', data_publicacao: '2026-02-05',
    areas_impacto: ['pgr', 'treinamento'], status: 'em_analise',
  },
];

const MOCK_ACTIONS: PendingAction[] = [
  {
    id: 'a1', action_type: 'create_safety_workflow', titulo: 'Criar workflow SST: NR-7',
    document_code: 'NR-7', gravidade: 'critica', prazo_dias: 5, status: 'pending', entity_count: 12,
  },
  {
    id: 'a2', action_type: 'require_training', titulo: 'Exigir reciclagem: NR-35',
    document_code: 'NR-35', gravidade: 'alta', prazo_dias: 30, status: 'pending', entity_count: 8,
  },
  {
    id: 'a3', action_type: 'update_epi_requirements', titulo: 'Revisar EPIs: NR-6',
    document_code: 'NR-6', gravidade: 'alta', prazo_dias: 15, status: 'approved', entity_count: 24,
  },
  {
    id: 'a4', action_type: 'recalculate_payroll', titulo: 'Recalcular simulação: CLT Art. 59',
    document_code: 'CLT Art. 59', gravidade: 'media', prazo_dias: 10, status: 'pending', entity_count: 45,
  },
  {
    id: 'a5', action_type: 'update_salary_floor', titulo: 'Atualizar piso salarial: CCT 2026',
    document_code: 'CCT 2026', gravidade: 'alta', prazo_dias: 15, status: 'pending', entity_count: 30,
  },
];

const MOCK_COMPANY_IMPACTS: Record<string, CompanyPositionImpact[]> = {};

export default function RegulatoryDashboard() {
  const { data: companies = [] } = useCompanies();
  const { data: employees = [] } = useEmployees();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  // Build impacted companies from mock data + real companies
  const impactedCompanies: ImpactedCompany[] = useMemo(() => {
    return companies.slice(0, 5).map((c, i) => ({
      company_id: c.id,
      company_name: c.name,
      total_impacts: 3 + (i % 3),
      critical_count: i < 2 ? 1 : 0,
      pending_actions: 2 + (i % 2),
      areas: ['treinamento', 'epi', 'saude_ocupacional'].slice(0, 2 + (i % 2)),
    }));
  }, [companies]);

  // Position impacts for selected company
  const companyPositionImpacts: CompanyPositionImpact[] = useMemo(() => {
    if (!selectedCompanyId) return [];
    const companyEmps = employees.filter(e => e.company_id === selectedCompanyId);
    const positions = new Map<string, { nome: string; count: number }>();
    companyEmps.forEach(e => {
      const posId = e.position_id || e.id;
      const posName = e.positions?.title || e.name;
      if (!positions.has(posId)) positions.set(posId, { nome: posName, count: 0 });
      positions.get(posId)!.count++;
    });

    return Array.from(positions.entries()).slice(0, 8).map(([id, { nome, count }], i) => ({
      cargo_id: id,
      cargo_nome: nome,
      nr_alteradas: ['NR-7', 'NR-6', 'NR-35'].slice(0, 1 + (i % 3)),
      motivos: ['Exame periódico alterado', 'EPI atualizado', 'Treinamento reciclagem'].slice(0, 1 + (i % 2)),
      adequacao_necessaria: i < 4,
      funcionarios_afetados: count,
    }));
  }, [selectedCompanyId, employees]);

  // ── KPIs ──
  const totalPending = MOCK_ACTIONS.filter(a => a.status === 'pending').length;
  const criticalChanges = MOCK_CHANGES.filter(c => c.gravidade === 'critica').length;
  const resolvedChanges = MOCK_CHANGES.filter(c => c.status === 'resolvido').length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Dashboard Regulatório
        </h1>
        <p className="text-muted-foreground mt-1">
          Monitoramento de mudanças legislativas · Impactos · Ações automáticas
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard
          title="Mudanças Recentes"
          value={MOCK_CHANGES.length}
          subtitle={`${criticalChanges} crítica(s)`}
          icon={FileText}
          className={criticalChanges > 0 ? 'border-l-4 border-l-destructive' : ''}
        />
        <StatsCard
          title="Empresas Impactadas"
          value={impactedCompanies.length}
          subtitle={`${impactedCompanies.filter(c => c.critical_count > 0).length} com impacto crítico`}
          icon={Building2}
          className={impactedCompanies.some(c => c.critical_count > 0) ? 'border-l-4 border-l-warning' : ''}
        />
        <StatsCard
          title="Ações Pendentes"
          value={totalPending}
          subtitle={`${MOCK_ACTIONS.length} total geradas`}
          icon={Zap}
          className={totalPending > 0 ? 'border-l-4 border-l-warning' : ''}
        />
        <StatsCard
          title="Resolvidas"
          value={resolvedChanges}
          subtitle={`de ${MOCK_CHANGES.length} mudanças`}
          icon={CheckCircle2}
        />
      </div>

      {/* Tabs: Tenant vs Company */}
      <Tabs defaultValue="tenant" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tenant" className="gap-1.5">
            <Activity className="h-4 w-4" />
            Visão Tenant
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            Visão Empresa
          </TabsTrigger>
        </TabsList>

        {/* ═══ TENANT VIEW ═══ */}
        <TabsContent value="tenant" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Changes */}
            <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
              <div className="flex items-center gap-2 mb-5">
                <Clock className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold font-display text-card-foreground">Mudanças Recentes</h2>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {MOCK_CHANGES.map(change => (
                  <div key={change.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <div className="mt-1">
                      <SeverityDot gravidade={change.gravidade} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-primary">{change.document_code}</span>
                        <StatusBadge status={change.status} />
                      </div>
                      <p className="text-sm font-medium text-card-foreground mt-0.5">{change.titulo}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {change.areas_impacto.map(area => (
                          <Badge key={area} variant="outline" className="text-[10px] px-1.5 py-0">
                            {areaLabel(area)}
                          </Badge>
                        ))}
                        <span className="text-[10px] text-muted-foreground ml-auto">{formatDate(change.data_publicacao)}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            </div>

            {/* Impacted Companies */}
            <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
              <div className="flex items-center gap-2 mb-5">
                <Building2 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold font-display text-card-foreground">Empresas Impactadas</h2>
              </div>
              {impactedCompanies.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {impactedCompanies.map(company => (
                    <div key={company.company_id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <Building2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-card-foreground">{company.company_name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {company.total_impacts} impacto(s)
                          </span>
                          {company.critical_count > 0 && (
                            <span className="text-xs text-destructive font-semibold flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {company.critical_count} crítico
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {company.pending_actions} ação(ões)
                          </span>
                        </div>
                        <div className="flex gap-1.5 mt-1.5">
                          {company.areas.map(area => (
                            <Badge key={area} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {areaLabel(area)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={CheckCircle2} message="Nenhuma empresa impactada" />
              )}
            </div>
          </div>

          {/* Pending Actions */}
          <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-5">
              <Zap className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold font-display text-card-foreground">Ações Pendentes</h2>
              <Badge variant="outline" className="ml-auto">{totalPending} pendente(s)</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MOCK_ACTIONS.map(action => (
                <div
                  key={action.id}
                  className="p-4 rounded-lg border border-border hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ActionIcon type={action.action_type} />
                    <span className="text-xs font-mono text-primary font-bold">{action.document_code}</span>
                    <SeverityBadge gravidade={action.gravidade} />
                  </div>
                  <p className="text-sm font-medium text-card-foreground">{action.titulo}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {action.prazo_dias}d
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {action.entity_count}
                    </span>
                    <ActionStatusBadge status={action.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ═══ COMPANY VIEW ═══ */}
        <TabsContent value="company" className="space-y-6">
          <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-5">
              <Filter className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold font-display text-card-foreground">Selecione a Empresa</h2>
              <div className="ml-auto w-[280px]">
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma empresa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!selectedCompanyId ? (
              <EmptyState icon={Building2} message="Selecione uma empresa para ver os impactos regulatórios" />
            ) : (
              <div className="space-y-6">
                {/* Company KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border border-border bg-muted/30 text-center">
                    <p className="text-2xl font-bold text-card-foreground">{companyPositionImpacts.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Cargos Impactados</p>
                  </div>
                  <div className="p-4 rounded-lg border border-border bg-muted/30 text-center">
                    <p className="text-2xl font-bold text-card-foreground">
                      {new Set(companyPositionImpacts.flatMap(p => p.nr_alteradas)).size}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">NRs Alteradas</p>
                  </div>
                  <div className="p-4 rounded-lg border border-border bg-muted/30 text-center">
                    <p className="text-2xl font-bold text-destructive">
                      {companyPositionImpacts.filter(p => p.adequacao_necessaria).length}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Necessitam Adequação</p>
                  </div>
                </div>

                {/* Impacted Positions */}
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Cargos Impactados
                  </h3>
                  {companyPositionImpacts.length > 0 ? (
                    <div className="space-y-3">
                      {companyPositionImpacts.map(pos => (
                        <div key={pos.cargo_id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                          <div className="mt-1">
                            {pos.adequacao_necessaria ? (
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-card-foreground">{pos.cargo_nome}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {pos.nr_alteradas.map(nr => (
                                <Badge key={nr} variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                                  {nr}
                                </Badge>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                              <span>{pos.funcionarios_afetados} funcionário(s)</span>
                              <span>·</span>
                              <span>{pos.motivos.join(', ')}</span>
                            </div>
                          </div>
                          {pos.adequacao_necessaria && (
                            <Badge variant="destructive" className="text-[10px] shrink-0">
                              Adequação
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={CheckCircle2} message="Nenhum cargo impactado nesta empresa" />
                  )}
                </div>

                {/* NRs Changed Summary */}
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    NRs Alteradas
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(companyPositionImpacts.flatMap(p => p.nr_alteradas))].map(nr => (
                      <div key={nr} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
                        <span className="text-sm font-mono font-bold text-primary">{nr}</span>
                        <span className="text-xs text-muted-foreground">
                          {companyPositionImpacts.filter(p => p.nr_alteradas.includes(nr)).length} cargo(s)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Helper Components ──

function EmptyState({ icon: Icon, message }: { icon: typeof CheckCircle2; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
      <Icon className="h-10 w-10 mb-2 text-primary opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function SeverityDot({ gravidade }: { gravidade: string }) {
  const colors: Record<string, string> = {
    critica: 'bg-destructive',
    alta: 'bg-warning',
    media: 'bg-primary',
    baixa: 'bg-muted-foreground',
  };
  return <div className={`h-2.5 w-2.5 rounded-full ${colors[gravidade] || 'bg-muted-foreground'}`} />;
}

function SeverityBadge({ gravidade }: { gravidade: string }) {
  const variants: Record<string, 'destructive' | 'secondary' | 'outline'> = {
    critica: 'destructive',
    alta: 'secondary',
    media: 'outline',
    baixa: 'outline',
  };
  const labels: Record<string, string> = {
    critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa',
  };
  return (
    <Badge variant={variants[gravidade] || 'outline'} className="text-[10px] px-1.5 py-0 ml-auto">
      {labels[gravidade] || gravidade}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pendente: { label: 'Pendente', className: 'bg-warning/10 text-warning border-warning/30' },
    em_analise: { label: 'Em análise', className: 'bg-primary/10 text-primary border-primary/30' },
    resolvido: { label: 'Resolvido', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  };
  const c = config[status] || config.pendente;
  return <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${c.className}`}>{c.label}</Badge>;
}

function ActionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: 'Aguardando', className: 'text-warning' },
    approved: { label: 'Aprovada', className: 'text-primary' },
    executed: { label: 'Executada', className: 'text-emerald-600' },
  };
  const c = config[status] || config.pending;
  return <span className={`font-semibold ml-auto ${c.className}`}>{c.label}</span>;
}

function ActionIcon({ type }: { type: string }) {
  const icons: Record<string, typeof Zap> = {
    create_safety_workflow: Zap,
    require_training: Users,
    update_epi_requirements: HardHat,
    recalculate_payroll: DollarSign,
    update_salary_floor: TrendingUp,
    update_health_program: Stethoscope,
  };
  const Icon = icons[type] || Bell;
  return <Icon className="h-4 w-4 text-primary" />;
}

function areaLabel(area: string): string {
  const labels: Record<string, string> = {
    saude_ocupacional: 'Saúde Ocupacional',
    pcmso: 'PCMSO',
    pgr: 'PGR',
    epi: 'EPI',
    treinamento: 'Treinamento',
    folha_pagamento: 'Folha',
    jornada: 'Jornada',
    sindical: 'Sindical',
  };
  return labels[area] || area;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
}
