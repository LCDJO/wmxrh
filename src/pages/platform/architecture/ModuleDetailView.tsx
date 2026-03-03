/**
 * ModuleDetailView — Rich detail panel shown when clicking a module.
 *
 * Sections:
 *  - Arquitetura interna
 *  - Dependências (grafo visual)
 *  - Eventos emitidos / consumidos
 *  - Métricas exportadas
 *  - SLA associado + RTO/RPO
 *  - Entregáveis esperados
 *  - Status atual
 */
import type { ArchModuleInfo } from '@/domains/architecture-intelligence';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  X, ArrowRight, Zap, BarChart3, Shield, Clock, Target,
  CheckCircle2, AlertTriangle, User, Calendar,
} from 'lucide-react';
import { statusColor, deliverableVariant } from './shared';

const lifecycleColor: Record<string, string> = {
  planning: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  development: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  stable: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  deprecated: 'bg-destructive/10 text-destructive border-destructive/20',
};

const slaTierColor: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  standard: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  low: 'bg-muted text-muted-foreground border-border',
};

interface Props {
  mod: ArchModuleInfo;
  allModules: ArchModuleInfo[];
  onClose: () => void;
}

export default function ModuleDetailView({ mod, allModules, onClose }: Props) {
  const dependencyModules = mod.dependencies.map(d => {
    const target = allModules.find(m => m.key === d.required_module_id);
    return { ...d, targetLabel: target?.label ?? d.required_module_id };
  });

  return (
    <Card className="border-primary/30 shadow-lg animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {mod.label}
              <Badge variant="outline" className="text-xs font-mono">{mod.key}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{mod.description}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="outline">{mod.version_tag}</Badge>
          <Badge variant="outline" className={lifecycleColor[mod.lifecycle_status]}>
            {mod.lifecycle_status}
          </Badge>
          <Badge variant="outline" className={`${statusColor[mod.status]} text-white`}>
            {mod.status}
          </Badge>
          <Badge variant="outline">{mod.domain === 'saas' ? 'SaaS Core' : 'Tenant'}</Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            <User className="h-3 w-3" /> {mod.owner}
            <span className="mx-1">·</span>
            <Calendar className="h-3 w-3" /> {mod.last_updated}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Arquitetura Interna ── */}
        <Section icon={<Shield className="h-4 w-4" />} title="Arquitetura Interna">
          <p className="text-sm text-muted-foreground leading-relaxed">{mod.architecture_description}</p>
        </Section>

        {/* ── Dependências ── */}
        {dependencyModules.length > 0 && (
          <Section icon={<ArrowRight className="h-4 w-4" />} title={`Dependências (${dependencyModules.length})`}>
            <div className="space-y-2">
              {dependencyModules.map((d, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm bg-accent/5">
                  <Badge variant="outline" className="font-mono text-xs">{mod.key}</Badge>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Badge variant="outline" className="font-mono text-xs">{d.required_module_id}</Badge>
                  <span className="text-xs text-muted-foreground">{d.targetLabel}</span>
                  <Badge variant={d.is_mandatory ? 'default' : 'secondary'} className="text-xs ml-auto">
                    {d.is_mandatory ? 'Obrigatória' : 'Opcional'}
                  </Badge>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Eventos ── */}
        <div className="grid md:grid-cols-2 gap-4">
          {mod.emits_events.length > 0 && (
            <Section icon={<Zap className="h-4 w-4 text-amber-500" />} title={`Eventos Emitidos (${mod.emits_events.length})`}>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {mod.emits_events.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 text-xs">
                    <code className="font-mono text-primary truncate flex-1">{ev.event_name}</code>
                  </div>
                ))}
              </div>
            </Section>
          )}
          <Section icon={<Zap className="h-4 w-4 text-blue-500" />} title={`Eventos Consumidos (${mod.consumes_events.length})`}>
            {mod.consumes_events.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum evento consumido declarado</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {mod.consumes_events.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 text-xs">
                    <code className="font-mono text-primary truncate flex-1">{ev.event_name}</code>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* ── Métricas ── */}
        {mod.monitoring_metrics.length > 0 && (
          <Section icon={<BarChart3 className="h-4 w-4" />} title={`Métricas Exportadas (${mod.monitoring_metrics.length})`}>
            <div className="grid md:grid-cols-2 gap-2">
              {mod.monitoring_metrics.map((m, i) => (
                <div key={i} className="rounded-lg border p-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-primary">{m.metric_name}</code>
                    <Badge variant="outline" className="text-[10px]">{m.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── SLA + RTO/RPO ── */}
        <Section icon={<Target className="h-4 w-4" />} title="SLA & Resiliência">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricBox label="Uptime Target" value={mod.sla.uptime_target} />
            <MetricBox label="P95 Latency" value={`${mod.sla.response_time_p95_ms}ms`} />
            {mod.sla.rto_minutes != null && (
              <MetricBox label="RTO" value={`${mod.sla.rto_minutes} min`} icon={<Clock className="h-3 w-3" />} />
            )}
            {mod.sla.rpo_minutes != null && (
              <MetricBox label="RPO" value={`${mod.sla.rpo_minutes} min`} icon={<AlertTriangle className="h-3 w-3" />} />
            )}
          </div>
          <div className="mt-2">
            <Badge variant="outline" className={`text-xs ${slaTierColor[mod.sla.tier]}`}>
              Tier: {mod.sla.tier.toUpperCase()}
            </Badge>
          </div>
        </Section>

        {/* ── Entregáveis ── */}
        {mod.expected_deliverables.length > 0 && (
          <Section icon={<CheckCircle2 className="h-4 w-4" />} title={`Entregáveis (${mod.expected_deliverables.length})`}>
            <div className="space-y-2">
              {mod.expected_deliverables.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant={deliverableVariant[d.status]} className="text-xs min-w-[80px] justify-center">
                      {d.status === 'done' ? 'Concluído' : d.status === 'in_progress' ? 'Em Progresso' : d.status === 'planned' ? 'Planejado' : 'Bloqueado'}
                    </Badge>
                    <div>
                      <span className="font-medium">{d.title}</span>
                      {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Changelog ── */}
        {mod.changelog_summary && (
          <div className="text-xs text-muted-foreground border-t pt-3">
            <span className="font-medium text-foreground">Changelog: </span>{mod.changelog_summary}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Helpers ──

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function MetricBox({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">{icon}{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
