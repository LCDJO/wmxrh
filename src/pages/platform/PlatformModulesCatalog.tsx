/**
 * PlatformModulesCatalog — Elegant listing of all platform modules
 * with function descriptions, events, and usage context.
 */
import { useState } from 'react';
import {
  Users, DollarSign, BarChart3, Activity, Megaphone, Building2,
  HelpCircle, X, ChevronDown, ChevronRight, Zap, Layers,
  RefreshCw, Package,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/* ─── Module catalog definition ─── */
interface ModuleEvent {
  key: string;
  label: string;
  description: string;
}

interface ModuleDef {
  id: string;
  name: string;
  icon: typeof Users;
  color: string;
  description: string;
  purpose: string;
  events: ModuleEvent[];
  usedIn: string[];
  structure: string[];
  status: 'active' | 'beta' | 'planned';
}

const MODULES: ModuleDef[] = [
  {
    id: 'core_hr',
    name: 'Core HR',
    icon: Users,
    color: 'hsl(265 80% 55%)',
    description: 'Gestão central de funcionários, departamentos, cargos e hierarquia organizacional.',
    purpose: 'Este módulo é o coração do sistema de RH. Ele gerencia o ciclo de vida completo do colaborador — desde a admissão até o desligamento — e serve como fonte primária de dados para todos os outros módulos.',
    events: [
      { key: 'employee_created', label: 'Employee Created', description: 'Emitido quando um novo colaborador é cadastrado no sistema.' },
      { key: 'employee_updated', label: 'Employee Updated', description: 'Emitido quando dados cadastrais de um colaborador são alterados.' },
      { key: 'employee_terminated', label: 'Employee Terminated', description: 'Emitido no desligamento de um colaborador.' },
      { key: 'department_changed', label: 'Department Changed', description: 'Emitido quando um colaborador muda de departamento.' },
      { key: 'org_chart_refreshed', label: 'Org Chart Refreshed', description: 'Emitido quando o organograma é recalculado.' },
    ],
    usedIn: ['Sidebar de Funcionários', 'Organograma', 'Compliance Trabalhista', 'eSocial', 'Remuneração'],
    structure: ['manifest/', 'gateway/', 'ui/', 'events/'],
    status: 'active',
  },
  {
    id: 'compensation_engine',
    name: 'Compensation Engine',
    icon: DollarSign,
    color: 'hsl(145 60% 42%)',
    description: 'Motor de simulação e gestão de remuneração, salários e reajustes.',
    purpose: 'Responsável por calcular simulações de folha, aplicar reajustes salariais em massa e manter o histórico de contratos salariais. Integra com regras trabalhistas (CLT/CCT) para garantir compliance.',
    events: [
      { key: 'salary_updated', label: 'Salary Updated', description: 'Emitido quando o salário de um colaborador é atualizado.' },
      { key: 'simulation_created', label: 'Simulation Created', description: 'Emitido quando uma nova simulação de folha é gerada.' },
      { key: 'mass_adjustment', label: 'Mass Adjustment', description: 'Emitido em reajustes salariais em massa (dissídio, mérito).' },
    ],
    usedIn: ['Dashboard de Remuneração', 'Simulador de Folha', 'Contratos Salariais', 'eSocial S-2206'],
    structure: ['manifest/', 'gateway/', 'ui/', 'events/'],
    status: 'active',
  },
  {
    id: 'analytics',
    name: 'Analytics',
    icon: BarChart3,
    color: 'hsl(200 70% 50%)',
    description: 'Inteligência analítica, relatórios automatizados e detecção de anomalias.',
    purpose: 'Centraliza a geração de relatórios, dashboards e alertas baseados em dados. Detecta anomalias (ex: pico de turnover) e dispara eventos para que outros módulos possam reagir automaticamente.',
    events: [
      { key: 'report_ready', label: 'Report Ready', description: 'Emitido quando um relatório é gerado e está pronto para download.' },
      { key: 'anomaly_detected', label: 'Anomaly Detected', description: 'Emitido quando uma anomalia estatística é identificada nos dados.' },
      { key: 'dashboard_refreshed', label: 'Dashboard Refreshed', description: 'Emitido quando os dados de um dashboard são atualizados.' },
    ],
    usedIn: ['Dashboard Principal', 'Relatórios', 'Automação de Alertas', 'Revenue Intelligence'],
    structure: ['manifest/', 'gateway/', 'ui/', 'events/'],
    status: 'active',
  },
  {
    id: 'observability',
    name: 'Observability',
    icon: Activity,
    color: 'hsl(35 90% 55%)',
    description: 'Monitoramento em tempo real, rastreamento de erros e profiling de performance.',
    purpose: 'Fornece visibilidade total sobre a saúde da plataforma — health checks de módulos, captura de erros, métricas de performance e exportação de logs estruturados para análise.',
    events: [
      { key: 'health_check_completed', label: 'Health Check Completed', description: 'Emitido quando um ciclo de health check é finalizado.' },
      { key: 'error_captured', label: 'Error Captured', description: 'Emitido quando um erro é capturado e registrado no sistema.' },
      { key: 'performance_sampled', label: 'Performance Sampled', description: 'Emitido quando métricas de performance são coletadas.' },
      { key: 'metrics_exported', label: 'Metrics Exported', description: 'Emitido quando métricas são exportadas para análise.' },
      { key: 'log_stream_flushed', label: 'Log Stream Flushed', description: 'Emitido quando o buffer de logs é descarregado.' },
    ],
    usedIn: ['Painel de Monitoramento', 'Incidentes', 'Performance Dashboard', 'Alertas Críticos'],
    structure: ['manifest/', 'gateway/', 'ui/', 'events/'],
    status: 'active',
  },
  {
    id: 'ads',
    name: 'Ads',
    icon: Megaphone,
    color: 'hsl(340 75% 55%)',
    description: 'Gestão de campanhas publicitárias internas e geração de relatórios de mídia.',
    purpose: 'Permite criar, pausar e analisar campanhas de comunicação interna e marketing. Gera relatórios automatizados sobre alcance e engajamento de cada campanha.',
    events: [
      { key: 'campaign_created', label: 'Campaign Created', description: 'Emitido quando uma nova campanha é criada.' },
      { key: 'campaign_paused', label: 'Campaign Paused', description: 'Emitido quando uma campanha é pausada.' },
      { key: 'report_generated', label: 'Report Generated', description: 'Emitido quando um relatório de campanha é gerado.' },
    ],
    usedIn: ['Comunicação', 'Gamificação', 'Revenue Intelligence'],
    structure: ['manifest/', 'gateway/', 'ui/', 'events/'],
    status: 'beta',
  },
  {
    id: 'tenant_admin',
    name: 'Tenant Admin',
    icon: Building2,
    color: 'hsl(220 70% 55%)',
    description: 'Administração do tenant — convites, cargos, módulos habilitados e configurações.',
    purpose: 'Módulo central de governança do tenant. Gerencia convites de usuários, atribuição de cargos customizados, toggle de módulos habilitados e configurações gerais do espaço de trabalho.',
    events: [
      { key: 'user_invited', label: 'User Invited', description: 'Emitido quando um convite é enviado a um novo usuário.' },
      { key: 'role_assigned', label: 'Role Assigned', description: 'Emitido quando um cargo é atribuído a um usuário.' },
      { key: 'module_toggled', label: 'Module Toggled', description: 'Emitido quando um módulo é habilitado/desabilitado no tenant.' },
      { key: 'settings_updated', label: 'Settings Updated', description: 'Emitido quando configurações do tenant são alteradas.' },
    ],
    usedIn: ['Onboarding', 'IAM', 'Planos & Billing', 'Governança'],
    structure: ['manifest/', 'gateway/', 'ui/', 'events/'],
    status: 'active',
  },
];

const statusMap = {
  active: { label: 'Ativo', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  beta: { label: 'Beta', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  planned: { label: 'Planejado', className: 'bg-muted text-muted-foreground border-border' },
};

export default function PlatformModulesCatalog() {
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success(`Catálogo atualizado — ${MODULES.length} módulos carregados`);
    }, 400);
  };

  const totalEvents = MODULES.reduce((a, m) => a + m.events.length, 0);
  const activeCount = MODULES.filter(m => m.status === 'active').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-xl gradient-platform-surface border border-platform p-6 md:p-8">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, hsl(265 80% 55%), transparent 70%)' }} />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, hsl(280 75% 60%), transparent 70%)' }} />

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
                  Todos os bounded contexts do sistema com seus eventos e integrações.
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="shrink-0 border-platform hover:bg-accent/50 transition-all duration-200"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* ── Help Panel ── */}
      {showHelp && (
        <Card className="border-[hsl(265_60%_50%/0.25)] bg-[hsl(265_60%_50%/0.04)] animate-fade-in">
          <CardContent className="p-5 space-y-4 relative">
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-accent/40 transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <HelpCircle className="h-4.5 w-4.5 text-[hsl(265_80%_60%)]" />
              O que é o Catálogo de Módulos?
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-muted-foreground">
              <div className="space-y-1.5">
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">📌 Função</p>
                <p>Este catálogo lista todos os <strong className="text-foreground">bounded contexts (módulos)</strong> do sistema, seguindo a arquitetura DDD modular. Cada módulo encapsula sua lógica de negócio de forma isolada.</p>
              </div>
              <div className="space-y-1.5">
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">⚡ O que são eventos?</p>
                <p>Eventos são <strong className="text-foreground">sinais emitidos por módulos</strong> quando algo relevante acontece (ex: colaborador criado, salário atualizado). Outros módulos podem ouvir e reagir a esses sinais.</p>
              </div>
              <div className="space-y-1.5">
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🔗 Onde são usados?</p>
                <p>Eventos alimentam <strong className="text-foreground">automações, auditoria, eSocial e dashboards</strong>. Eles permitem que módulos se comuniquem sem acoplamento direto — a base da arquitetura event-driven.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Módulos', value: MODULES.length, color: 'hsl(265 80% 55%)' },
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

      {/* ── Module Cards ── */}
      <div className="space-y-3">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          const isExpanded = expandedModule === mod.id;
          const st = statusMap[mod.status];

          return (
            <Card
              key={mod.id}
              className={cn(
                'border-border/60 bg-card/60 backdrop-blur-sm transition-all duration-300 overflow-hidden',
                isExpanded && 'ring-1 ring-[hsl(265_80%_55%/0.3)]',
              )}
            >
              <button
                type="button"
                onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                className="w-full text-left"
              >
                <CardContent className="p-5 flex items-center gap-4">
                  {/* Module icon */}
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300"
                    style={{
                      background: `${mod.color}15`,
                      boxShadow: isExpanded ? `0 0 20px ${mod.color}20` : 'none',
                    }}
                  >
                    <Icon className="h-6 w-6" style={{ color: mod.color }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base font-semibold text-foreground">{mod.name}</span>
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 border', st.className)}>
                        {st.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{mod.description}</p>
                  </div>

                  {/* Metrics */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <span className="block text-sm font-bold text-foreground">{mod.events.length}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Eventos</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-sm font-bold text-foreground">{mod.usedIn.length}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Uso</span>
                    </div>
                    {isExpanded
                      ? <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      : <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    }
                  </div>
                </CardContent>
              </button>

              {/* ── Expanded details ── */}
              {isExpanded && (
                <div className="border-t border-border/40 animate-fade-in">
                  {/* Purpose */}
                  <div className="px-5 py-4 border-b border-border/30">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5" style={{ color: mod.color }} />
                      Função do Módulo
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{mod.purpose}</p>
                  </div>

                  {/* Events */}
                  <div className="px-5 py-4 border-b border-border/30">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" style={{ color: mod.color }} />
                      Eventos ({mod.events.length})
                    </h4>
                    <div className="grid gap-2">
                      {mod.events.map((ev) => (
                        <div
                          key={ev.key}
                          className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ background: mod.color }} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono font-semibold text-foreground">{ev.label}</code>
                              <span className="text-[10px] text-muted-foreground font-mono">module:{mod.id}:{ev.key}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Usage & Structure */}
                  <div className="px-5 py-4 grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">🔗 Onde são usados</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {mod.usedIn.map((u) => (
                          <Badge key={u} variant="secondary" className="text-[11px] font-normal">
                            {u}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">📁 Estrutura Canônica</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {mod.structure.map((s) => (
                          <Badge key={s} variant="outline" className="text-[11px] font-mono font-normal border-border/60">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
