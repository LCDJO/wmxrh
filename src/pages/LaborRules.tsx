/**
 * Labor Rules Engine — Management Page
 * Tabs: Conjuntos de Regras | Regras CLT | Convenções Coletivas
 */
import { useState } from 'react';
import {
  Scale, BookOpen, FileText, Gavel, Plus, ChevronRight, CheckCircle2,
  Shield, AlertTriangle, Clock,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/shared/StatsCard';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  useLaborRuleSets, useCollectiveAgreements,
} from '@/domains/hooks';
import { RULE_CATEGORY_LABELS, CALC_TYPE_LABELS } from '@/domains/labor-rules/labor-rules.service';
import type { LaborRuleDefinition, LaborRuleSetWithRules, CollectiveAgreementWithClauses } from '@/domains/labor-rules/types';

// ── Helper badges ──
const incidenceBadges = (r: LaborRuleDefinition) => {
  const flags: string[] = [];
  if (r.integra_inss) flags.push('INSS');
  if (r.integra_irrf) flags.push('IRRF');
  if (r.integra_fgts) flags.push('FGTS');
  if (r.integra_ferias) flags.push('Férias');
  if (r.integra_13) flags.push('13º');
  return flags;
};

const statusColor = (status: string) => {
  switch (status) {
    case 'active': return 'default';
    case 'expired': return 'destructive';
    case 'pending': return 'secondary';
    default: return 'outline';
  }
};
const statusLabel = (s: string) => ({ active: 'Vigente', expired: 'Expirada', pending: 'Pendente', cancelled: 'Cancelada' }[s] || s);

export default function LaborRulesPage() {
  const { data: ruleSets = [], isLoading: loadingRules } = useLaborRuleSets();
  const { data: agreements = [], isLoading: loadingAgreements } = useCollectiveAgreements();

  const totalRules = ruleSets.reduce((sum, rs) => sum + (rs.labor_rule_definitions?.length || 0), 0);
  const mandatoryRules = ruleSets.reduce(
    (sum, rs) => sum + (rs.labor_rule_definitions?.filter(r => r.is_mandatory).length || 0), 0
  );
  const activeAgreements = agreements.filter(a => a.status === 'active').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Labor Rules Engine</h1>
        <p className="text-muted-foreground">Regras jurídicas trabalhistas CLT · Adicionais legais · CCT/ACT · eSocial</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard title="Conjuntos" value={ruleSets.length} icon={BookOpen} />
        <StatsCard title="Regras Ativas" value={totalRules} subtitle={`${mandatoryRules} obrigatórias`} icon={Scale} />
        <StatsCard title="CCT/ACT" value={agreements.length} subtitle={`${activeAgreements} vigentes`} icon={Gavel} />
        <StatsCard title="Categorias" value={Object.keys(RULE_CATEGORY_LABELS).length} icon={FileText} />
      </div>

      <Tabs defaultValue="rule_sets" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="rule_sets" className="gap-1"><BookOpen className="h-3.5 w-3.5" /> Conjuntos de Regras</TabsTrigger>
          <TabsTrigger value="agreements" className="gap-1"><Gavel className="h-3.5 w-3.5" /> Convenções Coletivas</TabsTrigger>
        </TabsList>

        {/* ── RULE SETS ── */}
        <TabsContent value="rule_sets" className="space-y-4">
          {loadingRules ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : ruleSets.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              Nenhum conjunto de regras cadastrado. O seed automático é aplicado ao criar um tenant.
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              {ruleSets.map((rs: LaborRuleSetWithRules) => (
                <RuleSetCard key={rs.id} ruleSet={rs} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── COLLECTIVE AGREEMENTS ── */}
        <TabsContent value="agreements" className="space-y-4">
          {loadingAgreements ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : agreements.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Gavel className="h-10 w-10 text-primary" />
              Nenhuma convenção coletiva cadastrada.
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              {agreements.map((ag: CollectiveAgreementWithClauses) => (
                <AgreementCard key={ag.id} agreement={ag} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Rule Set Card with expandable rules ──
function RuleSetCard({ ruleSet }: { ruleSet: LaborRuleSetWithRules }) {
  const [open, setOpen] = useState(false);
  const rules = ruleSet.labor_rule_definitions || [];

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
                <div>
                  <CardTitle className="text-sm font-semibold">{ruleSet.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {rules.length} regras · {ruleSet.base_monthly_hours}h/mês
                    {ruleSet.union_name && ` · ${ruleSet.union_name}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {ruleSet.cct_number && <Badge variant="outline" className="text-[10px]">CCT {ruleSet.cct_number}</Badge>}
                <Badge variant={ruleSet.is_active ? 'default' : 'secondary'} className="text-[10px]">
                  {ruleSet.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2">
            {ruleSet.description && <p className="text-xs text-muted-foreground mb-3">{ruleSet.description}</p>}
            {rules.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma regra definida.</p>
            ) : (
              <div className="space-y-2">
                {rules.map(rule => (
                  <div key={rule.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-card-foreground">{rule.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {RULE_CATEGORY_LABELS[rule.category] || rule.category}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {CALC_TYPE_LABELS[rule.calc_type] || rule.calc_type}
                        </Badge>
                        {rule.is_mandatory && (
                          <Badge variant="destructive" className="text-[10px]">Obrigatória</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                        {rule.base_percentage != null && <span>Percentual: {rule.base_percentage}%</span>}
                        {rule.fixed_value != null && <span>Valor: R$ {Number(rule.fixed_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                        {rule.clt_article && <span className="flex items-center gap-0.5"><BookOpen className="h-3 w-3" /> {rule.clt_article}</span>}
                        {rule.esocial_rubric_code && <span>eSocial: {rule.esocial_rubric_code}</span>}
                      </div>
                      {rule.legal_basis && (
                        <p className="text-[11px] text-muted-foreground/70 mt-1 italic">{rule.legal_basis}</p>
                      )}
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {incidenceBadges(rule).map(flag => (
                          <Badge key={flag} variant="outline" className="text-[9px] px-1.5 py-0">
                            {flag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ── Agreement Card ──
function AgreementCard({ agreement }: { agreement: CollectiveAgreementWithClauses }) {
  const [open, setOpen] = useState(false);
  const clauses = agreement.collective_agreement_clauses || [];
  const isExpired = new Date(agreement.valid_until) < new Date();

  return (
    <Card className={isExpired ? 'opacity-70' : ''}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
                <div>
                  <CardTitle className="text-sm font-semibold">
                    {agreement.agreement_type.toUpperCase()} — {agreement.union_name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(agreement.valid_from).toLocaleDateString('pt-BR')} — {new Date(agreement.valid_until).toLocaleDateString('pt-BR')}
                    {agreement.registration_number && ` · Nº ${agreement.registration_number}`}
                    {clauses.length > 0 && ` · ${clauses.length} cláusula(s)`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {agreement.salary_floor && (
                  <Badge variant="outline" className="text-[10px]">
                    Piso: R$ {Number(agreement.salary_floor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Badge>
                )}
                {agreement.annual_readjustment_pct && (
                  <Badge variant="outline" className="text-[10px]">Reajuste: {agreement.annual_readjustment_pct}%</Badge>
                )}
                <Badge variant={statusColor(agreement.status) as any} className="text-[10px]">
                  {statusLabel(agreement.status)}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
              {agreement.union_cnpj && <div>CNPJ Sindicato: {agreement.union_cnpj}</div>}
              {agreement.employer_union_name && <div>Sindicato Patronal: {agreement.employer_union_name}</div>}
              {agreement.base_date_month && <div>Data-base: Mês {agreement.base_date_month}</div>}
              {agreement.salary_ceiling && <div>Teto: R$ {Number(agreement.salary_ceiling).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>}
              {agreement.labor_rule_sets?.name && <div>Conjunto: {agreement.labor_rule_sets.name}</div>}
            </div>
            {agreement.notes && <p className="text-xs text-muted-foreground italic">{agreement.notes}</p>}

            {clauses.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2">Cláusulas</h4>
                <div className="space-y-1.5">
                  {clauses.map(cl => (
                    <div key={cl.id} className="flex items-start gap-2 p-2 rounded border border-border/50">
                      <span className="text-xs font-mono text-muted-foreground shrink-0">{cl.clause_number}</span>
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-card-foreground">{cl.title}</span>
                        {cl.description && <p className="text-[11px] text-muted-foreground mt-0.5">{cl.description}</p>}
                        <div className="flex gap-1 mt-1">
                          {cl.category && <Badge variant="outline" className="text-[9px]">{RULE_CATEGORY_LABELS[cl.category]}</Badge>}
                          {cl.override_percentage != null && <Badge variant="secondary" className="text-[9px]">{cl.override_percentage}%</Badge>}
                          {cl.is_mandatory && <Badge variant="destructive" className="text-[9px]">Obrigatória</Badge>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
