/**
 * PlatformModulesCatalog — Full listing of all platform modules
 * with function descriptions, events, and usage context.
 * Derives from the unified PLATFORM_MODULES registry.
 */
import { useState, useMemo } from 'react';
import {
  Users, DollarSign, BarChart3, Activity, Megaphone, Building2,
  HelpCircle, X, ChevronDown, ChevronRight, Zap, Layers,
  RefreshCw, Package, Heart, Shield, FileText, Calculator,
  FileSignature, Brain, Scale, GraduationCap, Key, Settings,
  CreditCard, Monitor, Headphones, Rocket, Layout, Globe,
  TrendingUp, Briefcase, Server, Puzzle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { scanForNewItems, getNewItemIds } from '@/lib/new-items-tracker';
import { PLATFORM_MODULES, getDomainModules, getPlatformModules } from '@/domains/platform/platform-modules';

const ICON_MAP: Record<string, React.ElementType> = {
  Users, DollarSign, Heart, Shield, Activity, FileText, Calculator,
  FileSignature, Brain, Scale, GraduationCap, Key, Settings, CreditCard,
  Zap: Zap, Monitor, BarChart3, Headphones, Megaphone, Rocket, Layout, Globe,
  TrendingUp, Building2,
};

/* ─── Rich metadata for modules that have detailed info ─── */
interface ModuleEvent { key: string; label: string; description: string; }
interface ModuleRichMeta {
  purpose: string;
  events: ModuleEvent[];
  usedIn: string[];
  status: 'active' | 'beta' | 'planned';
}

const RICH_META: Record<string, ModuleRichMeta> = {
  core_hr: {
    purpose: 'Coração do sistema de RH. Gerencia o ciclo de vida completo do colaborador — desde a admissão até o desligamento — e serve como fonte primária de dados para todos os outros módulos.',
    events: [
      { key: 'employee_created', label: 'Employee Created', description: 'Emitido quando um novo colaborador é cadastrado.' },
      { key: 'employee_updated', label: 'Employee Updated', description: 'Emitido quando dados cadastrais são alterados.' },
      { key: 'employee_terminated', label: 'Employee Terminated', description: 'Emitido no desligamento de um colaborador.' },
      { key: 'department_changed', label: 'Department Changed', description: 'Emitido quando um colaborador muda de departamento.' },
      { key: 'org_chart_refreshed', label: 'Org Chart Refreshed', description: 'Emitido quando o organograma é recalculado.' },
    ],
    usedIn: ['Sidebar de Funcionários', 'Organograma', 'Compliance', 'eSocial', 'Remuneração'],
    status: 'active',
  },
  compensation_engine: {
    purpose: 'Responsável por calcular simulações de folha, aplicar reajustes salariais em massa e manter o histórico de contratos salariais. Integra com regras trabalhistas (CLT/CCT) para garantir compliance.',
    events: [
      { key: 'salary_updated', label: 'Salary Updated', description: 'Emitido quando o salário de um colaborador é atualizado.' },
      { key: 'simulation_created', label: 'Simulation Created', description: 'Emitido quando uma simulação de folha é gerada.' },
      { key: 'mass_adjustment', label: 'Mass Adjustment', description: 'Emitido em reajustes salariais em massa.' },
    ],
    usedIn: ['Dashboard de Remuneração', 'Simulador de Folha', 'Contratos Salariais', 'eSocial S-2206'],
    status: 'active',
  },
  compensation: {
    purpose: 'Estrutura salarial, adicionais e histórico de remuneração dos colaboradores.',
    events: [
      { key: 'salary_structure_created', label: 'Salary Structure Created', description: 'Nova estrutura salarial registrada.' },
      { key: 'additional_added', label: 'Additional Added', description: 'Adicional salarial registrado para colaborador.' },
    ],
    usedIn: ['Contratos', 'Simulação Folha', 'eSocial'],
    status: 'active',
  },
  benefits: {
    purpose: 'Gestão de planos de benefícios (VR, VA, plano de saúde, etc.) com controle de elegibilidade, coparticipação e descontos por colaborador.',
    events: [
      { key: 'benefit_enrolled', label: 'Benefit Enrolled', description: 'Colaborador inscrito em plano de benefício.' },
      { key: 'benefit_cancelled', label: 'Benefit Cancelled', description: 'Benefício cancelado para colaborador.' },
    ],
    usedIn: ['Painel de Benefícios', 'Folha de Pagamento', 'Admissão'],
    status: 'active',
  },
  compliance: {
    purpose: 'Avaliação contínua de conformidade trabalhista e regulatória com detecção automática de violações e sugestões de remediação.',
    events: [
      { key: 'violation_detected', label: 'Violation Detected', description: 'Violação de compliance detectada.' },
      { key: 'evaluation_completed', label: 'Evaluation Completed', description: 'Ciclo de avaliação de compliance concluído.' },
    ],
    usedIn: ['Dashboard de Compliance', 'Auditoria', 'Alertas'],
    status: 'active',
  },
  health: {
    purpose: 'Gestão do PCMSO, ASOs, exames periódicos e programas de saúde ocupacional com rastreamento de validade e alertas automáticos.',
    events: [
      { key: 'exam_registered', label: 'Exam Registered', description: 'Exame ocupacional registrado.' },
      { key: 'exam_expiring', label: 'Exam Expiring', description: 'Exame próximo da data de vencimento.' },
    ],
    usedIn: ['Saúde Ocupacional', 'Compliance', 'eSocial S-2220'],
    status: 'active',
  },
  esocial: {
    purpose: 'Geração e transmissão de eventos do eSocial (S-1000, S-2200, S-2205, S-2206, S-2220, S-2240) com mapeamento automático a partir de triggers do banco.',
    events: [
      { key: 'event_generated', label: 'Event Generated', description: 'Evento eSocial gerado a partir de trigger.' },
      { key: 'event_transmitted', label: 'Event Transmitted', description: 'Evento eSocial transmitido com sucesso.' },
    ],
    usedIn: ['Painel eSocial', 'Admissão', 'Reajuste Salarial', 'SST'],
    status: 'active',
  },
  payroll_sim: {
    purpose: 'Simulação completa de folha de pagamento com cálculo progressivo de INSS, IRRF, FGTS e proventos/descontos customizáveis.',
    events: [
      { key: 'simulation_run', label: 'Simulation Run', description: 'Simulação de folha executada.' },
    ],
    usedIn: ['Simulador de Folha', 'Planejamento Financeiro'],
    status: 'active',
  },
  agreements: {
    purpose: 'Gestão de termos, contratos e documentos com versionamento, assinatura digital e vault de documentos imutável para compliance.',
    events: [
      { key: 'agreement_sent', label: 'Agreement Sent', description: 'Termo enviado para assinatura.' },
      { key: 'agreement_signed', label: 'Agreement Signed', description: 'Termo assinado digitalmente.' },
    ],
    usedIn: ['Admissão', 'Vault de Documentos', 'Compliance'],
    status: 'active',
  },
  workforce_intel: {
    purpose: 'Analytics avançado de workforce com projeções de headcount, turnover, custo de pessoal e insights preditivos.',
    events: [
      { key: 'insight_generated', label: 'Insight Generated', description: 'Insight de workforce gerado.' },
    ],
    usedIn: ['Dashboard Executivo', 'Relatórios', 'Planejamento'],
    status: 'active',
  },
  labor_rules: {
    purpose: 'Gestão de regras trabalhistas CLT, CCT, pisos salariais, jornadas e regras sindicais com aplicação automática em cálculos.',
    events: [
      { key: 'rule_applied', label: 'Rule Applied', description: 'Regra trabalhista aplicada em cálculo.' },
      { key: 'agreement_linked', label: 'Agreement Linked', description: 'CCT vinculada a empresa.' },
    ],
    usedIn: ['Remuneração', 'Folha', 'Compliance'],
    status: 'active',
  },
  nr_training: {
    purpose: 'Gestão de treinamentos normativos (NR-1, NR-5, NR-10, NR-35, etc.) com controle de validade, carga horária e obrigatoriedade por grau de risco.',
    events: [
      { key: 'training_assigned', label: 'Training Assigned', description: 'Treinamento atribuído a colaborador.' },
      { key: 'training_expired', label: 'Training Expired', description: 'Treinamento vencido.' },
    ],
    usedIn: ['SST', 'Compliance', 'Admissão'],
    status: 'active',
  },
  customer_support: {
    purpose: 'Sistema de atendimento com modo agente (SaaS) e modo cliente (tenant). Inclui tickets, chat ao vivo estilo WhatsApp, base de conhecimento e protocolos automáticos.',
    events: [
      { key: 'ticket_created', label: 'Ticket Created', description: 'Novo ticket de suporte criado.' },
      { key: 'chat_session_started', label: 'Chat Session Started', description: 'Sessão de chat ao vivo iniciada.' },
      { key: 'ticket_resolved', label: 'Ticket Resolved', description: 'Ticket resolvido pelo atendente.' },
    ],
    usedIn: ['Portal do Cliente', 'Console de Suporte', 'Chat ao Vivo'],
    status: 'active',
  },
  analytics: {
    purpose: 'Centraliza relatórios, dashboards e alertas baseados em dados. Detecta anomalias e dispara eventos para reação automática.',
    events: [
      { key: 'report_ready', label: 'Report Ready', description: 'Relatório gerado e pronto.' },
      { key: 'anomaly_detected', label: 'Anomaly Detected', description: 'Anomalia estatística identificada.' },
      { key: 'dashboard_refreshed', label: 'Dashboard Refreshed', description: 'Dados do dashboard atualizados.' },
    ],
    usedIn: ['Dashboard Principal', 'Relatórios', 'Automação de Alertas'],
    status: 'active',
  },
  observability: {
    purpose: 'Visibilidade total sobre saúde da plataforma — health checks, captura de erros, métricas de performance e logs estruturados.',
    events: [
      { key: 'health_check_completed', label: 'Health Check Completed', description: 'Ciclo de health check finalizado.' },
      { key: 'error_captured', label: 'Error Captured', description: 'Erro capturado e registrado.' },
      { key: 'metrics_exported', label: 'Metrics Exported', description: 'Métricas exportadas para análise.' },
    ],
    usedIn: ['Painel de Monitoramento', 'Incidentes', 'Performance'],
    status: 'active',
  },
  ads: {
    purpose: 'Gestão de campanhas publicitárias e comunicação com relatórios de alcance e engajamento.',
    events: [
      { key: 'campaign_created', label: 'Campaign Created', description: 'Nova campanha criada.' },
      { key: 'campaign_paused', label: 'Campaign Paused', description: 'Campanha pausada.' },
      { key: 'report_generated', label: 'Report Generated', description: 'Relatório de campanha gerado.' },
    ],
    usedIn: ['Comunicação', 'Gamificação', 'Revenue Intelligence'],
    status: 'beta',
  },
  tenant_admin: {
    purpose: 'Módulo central de governança do tenant. Gerencia convites, atribuição de roles, toggle de módulos e configurações do workspace.',
    events: [
      { key: 'user_invited', label: 'User Invited', description: 'Convite enviado a novo usuário.' },
      { key: 'role_assigned', label: 'Role Assigned', description: 'Cargo atribuído a usuário.' },
      { key: 'module_toggled', label: 'Module Toggled', description: 'Módulo habilitado/desabilitado.' },
    ],
    usedIn: ['Onboarding', 'IAM', 'Planos & Billing', 'Governança'],
    status: 'active',
  },
  iam: {
    purpose: 'Gestão de usuários, roles customizados, permissões granulares e políticas de acesso por escopo (tenant, grupo, empresa).',
    events: [
      { key: 'role_created', label: 'Role Created', description: 'Novo role customizado criado.' },
      { key: 'permission_granted', label: 'Permission Granted', description: 'Permissão concedida a role.' },
    ],
    usedIn: ['Controle de Acesso', 'Tenant Admin', 'Auditoria'],
    status: 'active',
  },
  billing: {
    purpose: 'Planos SaaS, faturas, cupons, ajustes e cobrança baseada em uso com ciclo de vida completo de subscription.',
    events: [
      { key: 'invoice_generated', label: 'Invoice Generated', description: 'Fatura gerada.' },
      { key: 'payment_received', label: 'Payment Received', description: 'Pagamento recebido.' },
      { key: 'subscription_changed', label: 'Subscription Changed', description: 'Plano alterado.' },
    ],
    usedIn: ['Planos', 'Faturas', 'Cupons', 'Revenue Intelligence'],
    status: 'active',
  },
  automation: {
    purpose: 'Regras de automação baseadas em eventos com condições lógicas e ações programáticas (notificações, webhooks, mutations).',
    events: [
      { key: 'rule_triggered', label: 'Rule Triggered', description: 'Regra de automação disparada.' },
      { key: 'rule_executed', label: 'Rule Executed', description: 'Ações da regra executadas.' },
    ],
    usedIn: ['Workflows', 'Notificações', 'Compliance Automática'],
    status: 'active',
  },
  growth: {
    purpose: 'Motor de crescimento com landing pages, A/B testing, referral program, FAB content e tracking de conversões.',
    events: [
      { key: 'landing_page_published', label: 'Landing Page Published', description: 'Landing page publicada.' },
      { key: 'conversion_tracked', label: 'Conversion Tracked', description: 'Conversão registrada.' },
      { key: 'experiment_completed', label: 'Experiment Completed', description: 'Experimento A/B concluído.' },
    ],
    usedIn: ['Landing Pages', 'Conversões', 'Referral Program', 'GTM'],
    status: 'active',
  },
  landing_engine: {
    purpose: 'Construtor de landing pages com drag-and-drop, versionamento por snapshots e A/B testing integrado.',
    events: [
      { key: 'page_created', label: 'Page Created', description: 'Nova landing page criada.' },
      { key: 'page_published', label: 'Page Published', description: 'Landing page publicada.' },
    ],
    usedIn: ['Marketing', 'Growth', 'Onboarding'],
    status: 'active',
  },
  website_engine: {
    purpose: 'Gestão de páginas institucionais, blog e conteúdo com SEO automático e sitemap gerado.',
    events: [
      { key: 'content_updated', label: 'Content Updated', description: 'Conteúdo institucional atualizado.' },
    ],
    usedIn: ['Website', 'Blog', 'SEO'],
    status: 'active',
  },
};

const CATEGORY_META = {
  domain: { label: 'RH / Gestão de Pessoas', icon: Briefcase, badgeClass: 'bg-primary/10 text-primary border-primary/20' },
  platform: { label: 'Infraestrutura SaaS', icon: Server, badgeClass: 'bg-accent/60 text-accent-foreground border-accent/30' },
} as const;

const statusMap = {
  active: { label: 'Ativo', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  beta: { label: 'Beta', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  planned: { label: 'Planejado', className: 'bg-muted text-muted-foreground border-border' },
};

// Color palette for modules
const MODULE_COLORS: Record<string, string> = {
  core_hr: 'hsl(265 80% 55%)', compensation: 'hsl(145 60% 42%)', compensation_engine: 'hsl(145 60% 42%)',
  benefits: 'hsl(340 75% 55%)', compliance: 'hsl(220 70% 55%)', health: 'hsl(170 60% 45%)',
  esocial: 'hsl(200 70% 50%)', payroll_sim: 'hsl(35 90% 55%)', agreements: 'hsl(280 75% 60%)',
  workforce_intel: 'hsl(300 60% 50%)', labor_rules: 'hsl(25 85% 55%)', nr_training: 'hsl(190 70% 45%)',
  customer_support: 'hsl(210 80% 55%)', iam: 'hsl(45 80% 50%)', tenant_admin: 'hsl(220 70% 55%)',
  billing: 'hsl(160 60% 45%)', automation: 'hsl(270 70% 55%)', analytics: 'hsl(200 70% 50%)',
  observability: 'hsl(35 90% 55%)', ads: 'hsl(340 75% 55%)', growth: 'hsl(340 75% 55%)',
  landing_engine: 'hsl(260 65% 55%)', website_engine: 'hsl(180 60% 45%)',
};

export default function PlatformModulesCatalog() {
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newModuleIds, setNewModuleIds] = useState<Set<string>>(() => getNewItemIds('modules'));

  const domainModules = getDomainModules();
  const platformModules = getPlatformModules();

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const allModuleIds = PLATFORM_MODULES.map(m => m.key);
      const newFound = scanForNewItems('modules', [...allModuleIds]);
      setNewModuleIds(getNewItemIds('modules'));
      setIsRefreshing(false);
      if (newFound.length > 0) {
        toast.success(`Varredura completa — ${newFound.length} novo(s) módulo(s) encontrado(s)!`);
      } else {
        toast.success(`Varredura completa — ${PLATFORM_MODULES.length} módulos, nenhum novo detectado`);
      }
    }, 400);
  };

  const totalEvents = PLATFORM_MODULES.reduce((a, m) => a + (RICH_META[m.key]?.events.length ?? 0), 0);
  const activeCount = PLATFORM_MODULES.filter(m => (RICH_META[m.key]?.status ?? 'active') === 'active').length;

  const renderModuleCard = (mod: typeof PLATFORM_MODULES[number]) => {
    const Icon = ICON_MAP[mod.icon] ?? Puzzle;
    const color = MODULE_COLORS[mod.key] ?? 'hsl(220 15% 50%)';
    const meta = RICH_META[mod.key];
    const isExpanded = expandedModule === mod.key;
    const status = meta?.status ?? 'active';
    const st = statusMap[status];

    return (
      <Card
        key={mod.key}
        className={cn(
          'border-border/60 bg-card/60 backdrop-blur-sm transition-all duration-300 overflow-hidden',
          isExpanded && 'ring-1 ring-primary/30',
        )}
      >
        <button
          type="button"
          onClick={() => setExpandedModule(isExpanded ? null : mod.key)}
          className="w-full text-left"
        >
          <CardContent className="p-5 flex items-center gap-4">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300"
              style={{ background: `${color}15`, boxShadow: isExpanded ? `0 0 20px ${color}20` : 'none' }}
            >
              <Icon className="h-6 w-6" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-base font-semibold text-foreground">{mod.label}</span>
                {newModuleIds.has(mod.key) && (
                  <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0 rounded-full font-bold animate-pulse shadow-sm shadow-emerald-500/30">
                    NOVO
                  </Badge>
                )}
                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 border', st.className)}>
                  {st.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1">{mod.description}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {meta && (
                <>
                  <div className="text-center">
                    <span className="block text-sm font-bold text-foreground">{meta.events.length}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Eventos</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-sm font-bold text-foreground">{meta.usedIn.length}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Uso</span>
                  </div>
                </>
              )}
              {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
            </div>
          </CardContent>
        </button>

        {isExpanded && meta && (
          <div className="border-t border-border/40 animate-fade-in">
            <div className="px-5 py-4 border-b border-border/30">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" style={{ color }} /> Função do Módulo
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{meta.purpose}</p>
            </div>
            <div className="px-5 py-4 border-b border-border/30">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" style={{ color }} /> Eventos ({meta.events.length})
              </h4>
              <div className="grid gap-2">
                {meta.events.map(ev => (
                  <div key={ev.key} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono font-semibold text-foreground">{ev.label}</code>
                        <span className="text-[10px] text-muted-foreground font-mono">module:{mod.key}:{ev.key}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">🔗 Onde são usados</h4>
                <div className="flex flex-wrap gap-1.5">
                  {meta.usedIn.map(u => (
                    <Badge key={u} variant="secondary" className="text-[11px] font-normal">{u}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">📁 Estrutura Canônica</h4>
                <div className="flex flex-wrap gap-1.5">
                  {['manifest/', 'gateway/', 'ui/', 'events/'].map(s => (
                    <Badge key={s} variant="outline" className="text-[11px] font-mono font-normal border-border/60">{s}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {isExpanded && !meta && (
          <div className="border-t border-border/40 px-5 py-4">
            <p className="text-sm text-muted-foreground italic">Detalhes avançados deste módulo serão documentados em breve.</p>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl gradient-platform-surface border border-platform p-6 md:p-8">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, hsl(265 80% 55%), transparent 70%)' }} />
        <div className="relative flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-platform-accent shadow-platform">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  Catálogo de Módulos
                </h1>
                <p className="text-sm text-muted-foreground">
                  Todos os {PLATFORM_MODULES.length} bounded contexts — {domainModules.length} domínio RH · {platformModules.length} plataforma SaaS.
                </p>
              </div>
              <button
                onClick={() => setShowHelp(prev => !prev)}
                className="ml-2 p-1.5 rounded-full hover:bg-accent/40 transition-colors text-muted-foreground hover:text-foreground"
                title="O que é este módulo?"
              >
                <HelpCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="shrink-0 border-platform hover:bg-accent/50">
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <Card className="border-primary/25 bg-primary/[0.04] animate-fade-in">
          <CardContent className="p-5 space-y-4 relative">
            <button onClick={() => setShowHelp(false)} className="absolute top-3 right-3 p-1 rounded-full hover:bg-accent/40 transition-colors text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <HelpCircle className="h-4.5 w-4.5 text-primary" /> O que é o Catálogo de Módulos?
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-muted-foreground">
              <div className="space-y-1.5">
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">📌 Função</p>
                <p>Lista todos os <strong className="text-foreground">bounded contexts (módulos)</strong> do sistema seguindo DDD modular.</p>
              </div>
              <div className="space-y-1.5">
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">⚡ Eventos</p>
                <p>Sinais emitidos quando algo relevante acontece. Outros módulos reagem automaticamente.</p>
              </div>
              <div className="space-y-1.5">
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🔗 Integrações</p>
                <p>Eventos alimentam automações, auditoria, eSocial e dashboards sem acoplamento.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Módulos', value: PLATFORM_MODULES.length, color: 'hsl(265 80% 55%)' },
          { label: 'Ativos', value: activeCount, color: 'hsl(145 60% 42%)' },
          { label: 'Eventos', value: totalEvents, color: 'hsl(200 70% 50%)' },
        ].map(s => (
          <Card key={s.label} className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: `${s.color}22` }}>
                <span className="text-lg font-bold" style={{ color: s.color }}>{s.value}</span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">{s.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Module Cards by Category */}
      {([
        { modules: domainModules, cat: 'domain' as const },
        { modules: platformModules, cat: 'platform' as const },
      ]).map(({ modules, cat }) => {
        const meta = CATEGORY_META[cat];
        const CatIcon = meta.icon;
        return (
          <section key={cat} className="space-y-3">
            <div className="flex items-center gap-2">
              <CatIcon className="h-4.5 w-4.5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">{meta.label}</h2>
              <Badge variant="outline" className={`ml-1 text-[10px] ${meta.badgeClass}`}>{modules.length}</Badge>
            </div>
            <div className="space-y-3">
              {modules.map(renderModuleCard)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
