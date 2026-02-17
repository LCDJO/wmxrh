/**
 * PlatformEvents — Dashboard listing all domain events across modules.
 */
import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Zap, Filter, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// ── Aggregate all domain event catalogs ────────────────────────

interface EventCatalogEntry {
  domain: string;
  domainColor: string;
  eventName: string;
  description: string;
}

const EVENT_CATALOG: EventCatalogEntry[] = [
  // IAM
  { domain: 'IAM', domainColor: 'hsl(200 70% 50%)', eventName: 'UserInvited', description: 'Novo membro convidado para o tenant' },
  { domain: 'IAM', domainColor: 'hsl(200 70% 50%)', eventName: 'UserRoleAssigned', description: 'Role vinculada a um usuário + escopo' },
  { domain: 'IAM', domainColor: 'hsl(200 70% 50%)', eventName: 'UserRoleRemoved', description: 'Role desvinculada do usuário' },
  { domain: 'IAM', domainColor: 'hsl(200 70% 50%)', eventName: 'RolePermissionsUpdated', description: 'Conjunto de permissões alterado' },
  { domain: 'IAM', domainColor: 'hsl(200 70% 50%)', eventName: 'AccessGraphRebuilt', description: 'Cache do grafo de acesso invalidado' },

  // Billing
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'TenantPlanAssigned', description: 'Plano atribuído ao tenant' },
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'TenantPlanUpgraded', description: 'Upgrade de plano realizado' },
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'InvoiceGenerated', description: 'Fatura gerada para o tenant' },
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'RevenueUpdated', description: 'Receita atualizada (MRR/ARR)' },
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'UsageRecorded', description: 'Uso registrado (métrica + quantidade)' },
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'CouponCreated', description: 'Cupom criado na plataforma' },
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'CouponRedeemed', description: 'Cupom resgatado por um tenant' },
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'InvoiceDiscountApplied', description: 'Desconto aplicado em fatura' },
  { domain: 'Billing', domainColor: 'hsl(145 60% 42%)', eventName: 'UsageOverageCalculated', description: 'Excedente de uso calculado' },

  // Observability
  { domain: 'Observability', domainColor: 'hsl(35 90% 55%)', eventName: 'ModuleHealthChanged', description: 'Status de saúde do módulo alterado' },
  { domain: 'Observability', domainColor: 'hsl(35 90% 55%)', eventName: 'ApplicationErrorDetected', description: 'Erro de aplicação capturado' },
  { domain: 'Observability', domainColor: 'hsl(35 90% 55%)', eventName: 'LatencyThresholdExceeded', description: 'Latência p95 acima do threshold' },
  { domain: 'Observability', domainColor: 'hsl(35 90% 55%)', eventName: 'ErrorRateSpike', description: 'Pico na taxa de erros' },

  // Security
  { domain: 'Security', domainColor: 'hsl(0 70% 55%)', eventName: 'UnauthorizedAccessAttempt', description: 'Tentativa de acesso não autorizado' },
  { domain: 'Security', domainColor: 'hsl(0 70% 55%)', eventName: 'ScopeViolationDetected', description: 'Violação de escopo detectada' },
  { domain: 'Security', domainColor: 'hsl(0 70% 55%)', eventName: 'PermissionDenied', description: 'Permissão negada' },
  { domain: 'Security', domainColor: 'hsl(0 70% 55%)', eventName: 'SuspiciousActivityFlagged', description: 'Atividade suspeita sinalizada' },

  // Self-Healing
  { domain: 'Self-Healing', domainColor: 'hsl(280 60% 55%)', eventName: 'IncidentDetected', description: 'Incidente detectado automaticamente' },
  { domain: 'Self-Healing', domainColor: 'hsl(280 60% 55%)', eventName: 'SelfHealingTriggered', description: 'Auto-recuperação acionada' },
  { domain: 'Self-Healing', domainColor: 'hsl(280 60% 55%)', eventName: 'CircuitBreakerOpened', description: 'Circuit breaker aberto' },
  { domain: 'Self-Healing', domainColor: 'hsl(280 60% 55%)', eventName: 'CircuitBreakerClosed', description: 'Circuit breaker fechado' },
  { domain: 'Self-Healing', domainColor: 'hsl(280 60% 55%)', eventName: 'ModuleRecovered', description: 'Módulo recuperado com sucesso' },

  // Governance AI
  { domain: 'Governance AI', domainColor: 'hsl(320 60% 50%)', eventName: 'GovernanceRiskDetected', description: 'Risco de governança detectado por IA' },
  { domain: 'Governance AI', domainColor: 'hsl(320 60% 50%)', eventName: 'RoleOptimizationSuggested', description: 'Sugestão de otimização de role' },
  { domain: 'Governance AI', domainColor: 'hsl(320 60% 50%)', eventName: 'ComplianceViolation', description: 'Violação de compliance detectada' },
  { domain: 'Governance AI', domainColor: 'hsl(320 60% 50%)', eventName: 'PolicyRecommendation', description: 'Recomendação de política gerada' },

  // Onboarding
  { domain: 'Onboarding', domainColor: 'hsl(175 60% 45%)', eventName: 'TenantOnboardingStarted', description: 'Onboarding do tenant iniciado' },
  { domain: 'Onboarding', domainColor: 'hsl(175 60% 45%)', eventName: 'OnboardingStepCompleted', description: 'Etapa de onboarding concluída' },
  { domain: 'Onboarding', domainColor: 'hsl(175 60% 45%)', eventName: 'OnboardingCompleted', description: 'Onboarding finalizado' },
  { domain: 'Onboarding', domainColor: 'hsl(175 60% 45%)', eventName: 'OnboardingAbandoned', description: 'Onboarding abandonado' },

  // Payroll Simulation
  { domain: 'Payroll', domainColor: 'hsl(55 70% 45%)', eventName: 'PayrollSimulationCreated', description: 'Simulação de folha criada' },
  { domain: 'Payroll', domainColor: 'hsl(55 70% 45%)', eventName: 'EncargoEstimateUpdated', description: 'Estimativa de encargos atualizada' },
  { domain: 'Payroll', domainColor: 'hsl(55 70% 45%)', eventName: 'SimulationApproved', description: 'Simulação aprovada' },

  // Workforce Intelligence
  { domain: 'Workforce', domainColor: 'hsl(220 60% 55%)', eventName: 'WorkforceInsightCreated', description: 'Insight de workforce criado' },
  { domain: 'Workforce', domainColor: 'hsl(220 60% 55%)', eventName: 'RiskScoreUpdated', description: 'Score de risco atualizado' },

  // NR Training Lifecycle
  { domain: 'NR Training', domainColor: 'hsl(15 70% 50%)', eventName: 'TrainingAssigned', description: 'Treinamento atribuído ao colaborador' },
  { domain: 'NR Training', domainColor: 'hsl(15 70% 50%)', eventName: 'TrainingCompleted', description: 'Treinamento concluído' },
  { domain: 'NR Training', domainColor: 'hsl(15 70% 50%)', eventName: 'TrainingExpired', description: 'Treinamento expirado' },
  { domain: 'NR Training', domainColor: 'hsl(15 70% 50%)', eventName: 'TrainingBlocked', description: 'Treinamento bloqueado (blocking level)' },
  { domain: 'NR Training', domainColor: 'hsl(15 70% 50%)', eventName: 'TrainingRenewalDue', description: 'Renovação de treinamento próxima' },
  { domain: 'NR Training', domainColor: 'hsl(15 70% 50%)', eventName: 'TrainingStatusChanged', description: 'Status do treinamento alterado' },

  // Platform OS
  { domain: 'Platform OS', domainColor: 'hsl(265 60% 55%)', eventName: 'ModuleRegistered', description: 'Módulo registrado na plataforma' },
  { domain: 'Platform OS', domainColor: 'hsl(265 60% 55%)', eventName: 'ModuleEnabled', description: 'Módulo habilitado para tenant' },
  { domain: 'Platform OS', domainColor: 'hsl(265 60% 55%)', eventName: 'ModuleDisabled', description: 'Módulo desabilitado para tenant' },
  { domain: 'Platform OS', domainColor: 'hsl(265 60% 55%)', eventName: 'TenantCreated', description: 'Tenant criado na plataforma' },
  { domain: 'Platform OS', domainColor: 'hsl(265 60% 55%)', eventName: 'TenantSuspended', description: 'Tenant suspenso' },

  // Revenue Intelligence
  { domain: 'Revenue Intelligence', domainColor: 'hsl(160 60% 45%)', eventName: 'ReferralLinkCreated', description: 'Link de referral criado' },
  { domain: 'Revenue Intelligence', domainColor: 'hsl(160 60% 45%)', eventName: 'ReferralSignup', description: 'Signup via referral registrado' },
  { domain: 'Revenue Intelligence', domainColor: 'hsl(160 60% 45%)', eventName: 'ReferralConverted', description: 'Referral convertido em pagante' },
  { domain: 'Revenue Intelligence', domainColor: 'hsl(160 60% 45%)', eventName: 'RewardAwarded', description: 'Recompensa concedida ao referrer' },
  { domain: 'Revenue Intelligence', domainColor: 'hsl(160 60% 45%)', eventName: 'TierUpgraded', description: 'Tier de gamificação elevado' },
  { domain: 'Revenue Intelligence', domainColor: 'hsl(160 60% 45%)', eventName: 'ChurnRiskDetected', description: 'Risco de churn detectado' },
  { domain: 'Revenue Intelligence', domainColor: 'hsl(160 60% 45%)', eventName: 'UpgradeRecommended', description: 'Upgrade recomendado para tenant' },
];

// ── Unique domains ─────────────────────────────────────────────

const ALL_DOMAINS = [...new Set(EVENT_CATALOG.map(e => e.domain))];

export default function PlatformEvents() {
  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setRefreshKey(k => k + 1);
      setIsRefreshing(false);
      toast.success(`Catálogo atualizado — ${EVENT_CATALOG.length} eventos carregados`);
    }, 400);
  }, []);

  const filtered = useMemo(() => {
    void refreshKey; // dependency to force re-compute
    return EVENT_CATALOG.filter(e => {
      const matchesDomain = selectedDomain === 'all' || e.domain === selectedDomain;
      const matchesSearch =
        !search ||
        e.eventName.toLowerCase().includes(search.toLowerCase()) ||
        e.description.toLowerCase().includes(search.toLowerCase()) ||
        e.domain.toLowerCase().includes(search.toLowerCase());
      return matchesDomain && matchesSearch;
    });
  }, [search, selectedDomain, refreshKey]);

  const groupedByDomain = useMemo(() => {
    const map = new Map<string, EventCatalogEntry[]>();
    for (const entry of filtered) {
      const list = map.get(entry.domain) ?? [];
      list.push(entry);
      map.set(entry.domain, list);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catálogo de Eventos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Todos os eventos de domínio emitidos pelo sistema, organizados por módulo.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-foreground">{EVENT_CATALOG.length}</div>
            <div className="text-xs text-muted-foreground">Total de Eventos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-foreground">{ALL_DOMAINS.length}</div>
            <div className="text-xs text-muted-foreground">Domínios</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-foreground">{filtered.length}</div>
            <div className="text-xs text-muted-foreground">Filtrados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-foreground">{groupedByDomain.size}</div>
            <div className="text-xs text-muted-foreground">Domínios Visíveis</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar evento ou domínio..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedDomain} onValueChange={setSelectedDomain}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar domínio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Domínios</SelectItem>
            {ALL_DOMAINS.map(d => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Event list grouped by domain */}
      <ScrollArea className="h-[calc(100vh-380px)]">
        <div className="space-y-6">
          {[...groupedByDomain.entries()].map(([domain, events]) => {
            const color = events[0]?.domainColor ?? 'hsl(0 0% 50%)';
            return (
              <Card key={domain} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-base">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {domain}
                    <Badge variant="secondary" className="ml-auto text-xs font-normal">
                      {events.length} evento{events.length > 1 ? 's' : ''}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="divide-y divide-border">
                    {events.map(ev => (
                      <div
                        key={ev.eventName}
                        className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <Zap className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <code className="text-sm font-semibold text-foreground">
                            {ev.eventName}
                          </code>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {ev.description}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px]"
                          style={{ borderColor: color, color }}
                        >
                          {ev.domain}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {groupedByDomain.size === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum evento encontrado para o filtro aplicado.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
