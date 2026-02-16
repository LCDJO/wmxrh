/**
 * LaborCompliance — Unified Conformidade Trabalhista page
 * Tabs: Violações | Rubricas | Benefícios | Saúde (PCMSO/PPRA) | Riscos | eSocial
 */
import { useMemo, useState } from 'react';
import {
  ShieldAlert, FileText, ShieldCheck, Heart, AlertTriangle, Zap,
  CheckCircle2, Activity, Clock,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/shared/StatsCard';
import {
  useComplianceScan, useComplianceViolations, useResolveViolation,
  usePayrollCatalog, useBenefitPlans,
  useHealthPrograms, useHealthExams,
  usePcmsoAlertCounts, usePcmsoOverdueAlerts,
  useRiskExposuresTenant,
  useESocialEvents, useESocialStatusCounts,
} from '@/domains/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { STATUS_LABELS, CATEGORY_LABELS } from '@/domains/esocial/esocial-event.service';

// ── Labels ──
const INCIDENCE_LABELS: Record<string, string> = {
  all: 'INSS+IRRF+FGTS', inss: 'INSS', irrf: 'IRRF', fgts: 'FGTS',
  inss_irrf: 'INSS+IRRF', inss_fgts: 'INSS+FGTS', irrf_fgts: 'IRRF+FGTS', none: 'Nenhuma',
};
const BENEFIT_LABELS: Record<string, string> = {
  va: 'Vale Alimentação', vr: 'Vale Refeição', vt: 'Vale Transporte',
  health: 'Plano de Saúde', dental: 'Plano Odontológico',
};
const PROGRAM_LABELS: Record<string, string> = { pcmso: 'PCMSO', pgr: 'PGR', ltcat: 'LTCAT', ppra: 'PPRA' };
const EXAM_LABELS: Record<string, string> = {
  admissional: 'Admissional', periodico: 'Periódico', demissional: 'Demissional',
  mudanca_funcao: 'Mudança Função', retorno_trabalho: 'Retorno',
};
const RESULT_LABELS: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' }> = {
  apto: { label: 'Apto', variant: 'default' },
  inapto: { label: 'Inapto', variant: 'destructive' },
  apto_restricao: { label: 'Apto c/ Restrição', variant: 'secondary' },
};
const RISK_LEVEL_COLORS: Record<string, string> = {
  critico: 'bg-destructive/10 text-destructive',
  alto: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medio: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  baixo: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export default function LaborCompliance() {
  const { user } = useAuth();
  const { data: violations = [] } = useComplianceScan();
  const { data: trackedViolations = [] } = useComplianceViolations(true);
  const { mutate: resolveViolation } = useResolveViolation();
  const { data: catalog = [], isLoading: loadingCatalog } = usePayrollCatalog();
  const { data: plans = [], isLoading: loadingPlans } = useBenefitPlans();
  const { data: programs = [], isLoading: loadingPrograms } = useHealthPrograms();
  const { data: exams = [], isLoading: loadingExams } = useHealthExams();
  const { data: alertCounts } = usePcmsoAlertCounts();
  const { data: overdueAlerts = [] } = usePcmsoOverdueAlerts();
  const { data: riskExposures = [] } = useRiskExposuresTenant();
  const { data: esocialEvents = [] } = useESocialEvents({ limit: 50 });
  const { data: esocialCounts } = useESocialStatusCounts();

  const criticalCount = violations.filter(v => v.severity === 'critical').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Conformidade Trabalhista</h1>
        <p className="text-muted-foreground">LaborCompliance — Rubricas · Benefícios · PCMSO/PPRA · Riscos · eSocial</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatsCard title="Violações" value={violations.length} subtitle={`${criticalCount} críticas`} icon={ShieldAlert}
          className={criticalCount > 0 ? 'border-l-4 border-l-destructive' : ''} />
        <StatsCard title="Rubricas" value={catalog.length} icon={FileText} />
        <StatsCard title="Benefícios" value={plans.length} icon={ShieldCheck} />
        <StatsCard title="Exames Vencidos" value={alertCounts?.overdue ?? 0}
          subtitle={`${alertCounts?.expiring_soon ?? 0} vencendo`} icon={AlertTriangle}
          className={(alertCounts?.overdue ?? 0) > 0 ? 'border-l-4 border-l-destructive' : ''} />
        <StatsCard title="Riscos Ativos" value={riskExposures.length} icon={Activity} />
        <StatsCard title="eSocial Pendente" value={esocialCounts?.pending ?? 0} icon={Zap}
          className={(esocialCounts?.pending ?? 0) > 0 ? 'border-l-4 border-l-primary' : ''} />
      </div>

      <Tabs defaultValue="violations" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="violations" className="gap-1"><ShieldAlert className="h-3.5 w-3.5" /> Violações</TabsTrigger>
          <TabsTrigger value="catalog" className="gap-1"><FileText className="h-3.5 w-3.5" /> Rubricas</TabsTrigger>
          <TabsTrigger value="benefits" className="gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Benefícios</TabsTrigger>
          <TabsTrigger value="health" className="gap-1"><Heart className="h-3.5 w-3.5" /> Saúde</TabsTrigger>
          <TabsTrigger value="risks" className="gap-1"><Activity className="h-3.5 w-3.5" /> Riscos</TabsTrigger>
          <TabsTrigger value="esocial" className="gap-1"><Zap className="h-3.5 w-3.5" /> eSocial</TabsTrigger>
        </TabsList>

        {/* ── VIOLATIONS ── */}
        <TabsContent value="violations" className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Compliance Rule Engine</h2>
          {violations.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              Nenhuma violação detectada pelo motor de regras.
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {violations.map((v, i) => (
                <Card key={i} className={v.severity === 'critical' ? 'border-l-4 border-l-destructive' : 'border-l-4 border-l-yellow-500'}>
                  <CardContent className="py-4 flex items-start gap-3">
                    <ShieldAlert className={`h-5 w-5 shrink-0 mt-0.5 ${v.severity === 'critical' ? 'text-destructive' : 'text-yellow-500'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-card-foreground">{v.employee_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{v.description}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant={v.severity === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {v.severity === 'critical' ? 'Crítico' : 'Aviso'}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{v.violation_type}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {trackedViolations.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Violações Rastreadas (não resolvidas)</h3>
              <div className="space-y-2">
                {trackedViolations.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{v.violation_type}</p>
                      <p className="text-xs text-muted-foreground">{v.description}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => resolveViolation({ id: v.id, resolvedBy: user?.id || '' })}>
                      Resolver
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── CATALOG ── */}
        <TabsContent value="catalog" className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Catálogo de Rubricas</h2>
          {loadingCatalog ? <p className="text-muted-foreground">Carregando...</p> : catalog.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma rubrica cadastrada.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {catalog.map(item => (
                <Card key={item.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{item.code} — {item.name}</CardTitle>
                      <Badge variant={item.item_type === 'provento' ? 'default' : 'destructive'} className="text-[10px]">
                        {item.item_type === 'provento' ? 'Provento' : 'Desconto'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs text-muted-foreground">
                    <p>Natureza: {item.nature} | Incidência: {INCIDENCE_LABELS[item.incidence] || item.incidence}</p>
                    {item.esocial_code && <p>eSocial: {item.esocial_code}</p>}
                    {item.description && <p>{item.description}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── BENEFITS ── */}
        <TabsContent value="benefits" className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Benefits Engine</h2>
          {loadingPlans ? <p className="text-muted-foreground">Carregando...</p> : plans.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum plano de benefício cadastrado.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plans.map(plan => (
                <Card key={plan.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{plan.name}</CardTitle>
                      <Badge variant="outline" className="text-[10px]">{BENEFIT_LABELS[plan.benefit_type] || plan.benefit_type}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs text-muted-foreground">
                    {plan.provider && <p>Operadora: {plan.provider}</p>}
                    <p>Valor base: R$ {Number(plan.base_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p>Empresa paga: {plan.employer_percentage ?? 100}% | Desconto func.: {plan.employee_discount_percentage ?? 0}%</p>
                    <div className="flex gap-1 mt-1">
                      {plan.has_coparticipation && <Badge variant="secondary" className="text-[10px]">Coparticipação</Badge>}
                      {plan.integrates_salary && <Badge variant="secondary" className="text-[10px]">Integra Salário</Badge>}
                      {plan.is_indemnity && <Badge variant="secondary" className="text-[10px]">Indenizatório</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── HEALTH (PCMSO / PPRA) ── */}
        <TabsContent value="health" className="space-y-6">
          <h2 className="text-lg font-semibold text-foreground">PCMSO · PGR · PPRA</h2>

          {/* Overdue alerts */}
          {(alertCounts?.overdue ?? 0) > 0 && (
            <Card className="border-l-4 border-l-destructive">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  {alertCounts!.overdue} exame(s) vencido(s) · {alertCounts!.expiring_soon} vencendo em 30 dias
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                {overdueAlerts.slice(0, 5).map(a => (
                  <div key={a.exam_id} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                    <span className="text-card-foreground font-medium">{a.employee_name}</span>
                    <span className="text-muted-foreground">{EXAM_LABELS[a.exam_type]} — {a.next_exam_date ? new Date(a.next_exam_date).toLocaleDateString('pt-BR') : '—'}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Programs */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Programas ({programs.length})</h3>
            {loadingPrograms ? <p className="text-muted-foreground text-sm">Carregando...</p> : programs.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum programa cadastrado.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {programs.map(p => {
                  const isExpired = new Date(p.valid_until) < new Date();
                  return (
                    <Card key={p.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{p.name}</CardTitle>
                          <div className="flex gap-1">
                            <Badge variant="outline" className="text-[10px]">{PROGRAM_LABELS[p.program_type]}</Badge>
                            <Badge variant={isExpired ? 'destructive' : 'default'} className="text-[10px]">{isExpired ? 'Vencido' : 'Vigente'}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground space-y-1">
                        <p>Validade: {new Date(p.valid_from).toLocaleDateString('pt-BR')} — {new Date(p.valid_until).toLocaleDateString('pt-BR')}</p>
                        {p.responsible_name && <p>Responsável: {p.responsible_name} ({p.responsible_registration})</p>}
                        {p.generates_hazard_pay && <Badge variant="secondary" className="text-[10px] mt-1">Gera Adicional</Badge>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Exams */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Exames / ASOs ({exams.length})</h3>
            {loadingExams ? <p className="text-muted-foreground text-sm">Carregando...</p> : exams.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum exame registrado.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {exams.map(e => {
                  const r = RESULT_LABELS[e.result] || { label: e.result, variant: 'secondary' as const };
                  return (
                    <Card key={e.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{EXAM_LABELS[e.exam_type] || e.exam_type}</CardTitle>
                          <Badge variant={r.variant} className="text-[10px]">{r.label}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground space-y-1">
                        <p>Data: {new Date(e.exam_date).toLocaleDateString('pt-BR')}</p>
                        {e.next_exam_date && <p>Próximo: {new Date(e.next_exam_date).toLocaleDateString('pt-BR')}</p>}
                        {e.physician_name && <p>Médico: {e.physician_name} — CRM {e.physician_crm}</p>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── RISKS ── */}
        <TabsContent value="risks" className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Riscos Ambientais</h2>
          {riskExposures.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              Nenhuma exposição a risco ativa.
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {riskExposures.map((r: any) => (
                <Card key={r.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{r.employees?.name || 'Funcionário'}</CardTitle>
                      <Badge className={`text-[10px] ${RISK_LEVEL_COLORS[r.risk_level] || ''}`}>
                        {(r.risk_level || 'baixo').charAt(0).toUpperCase() + (r.risk_level || 'baixo').slice(1)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-1">
                    {r.occupational_risk_factors && <p>Fator: {r.occupational_risk_factors.name} ({r.occupational_risk_factors.category})</p>}
                    {r.exposure_groups && <p>GHE: {r.exposure_groups.code} — {r.exposure_groups.name}</p>}
                    <div className="flex gap-1 mt-1">
                      {r.requires_epi && <Badge variant="outline" className="text-[10px]">EPI Obrigatório</Badge>}
                      {r.generates_hazard_pay && <Badge variant="secondary" className="text-[10px]">Adicional {r.hazard_pay_type}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── ESOCIAL ── */}
        <TabsContent value="esocial" className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Fila eSocial / GFIP / SST</h2>

          {/* Status counters */}
          {esocialCounts && (
            <div className="flex flex-wrap gap-3">
              {(Object.entries(esocialCounts) as [string, number][]).filter(([, v]) => v > 0).map(([status, count]) => (
                <div key={status} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium text-card-foreground">{count}</span>
                  <span className="text-muted-foreground">{STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status}</span>
                </div>
              ))}
            </div>
          )}

          {esocialEvents.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Zap className="h-10 w-10 text-primary" />
              Nenhum evento eSocial na fila.
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {esocialEvents.map(evt => (
                <Card key={evt.id}>
                  <CardContent className="py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-card-foreground">{evt.event_type}</span>
                        <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[evt.category]}</Badge>
                        <Badge variant={evt.status === 'accepted' ? 'default' : evt.status === 'error' || evt.status === 'rejected' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {STATUS_LABELS[evt.status]}
                        </Badge>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                        {evt.reference_period && <span>Ref: {evt.reference_period}</span>}
                        {evt.entity_type && <span>{evt.entity_type} #{evt.entity_id?.slice(0, 8)}</span>}
                        <span>{new Date(evt.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {evt.error_message && <p className="text-xs text-destructive mt-1">{evt.error_message}</p>}
                    </div>
                    {evt.receipt_number && <span className="text-xs text-muted-foreground">Recibo: {evt.receipt_number}</span>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
