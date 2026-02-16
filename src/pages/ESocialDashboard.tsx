/**
 * eSocial Dashboard — Transmission Monitoring
 *
 * Displays event lifecycle stats, pending/error lists,
 * and allows manual queue/cancel actions.
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send, CheckCircle2, XCircle, AlertTriangle, Clock, FileText,
  BarChart3, RefreshCw, Ban, Zap,
} from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { cn } from '@/lib/utils';
import { useQueryScope } from '@/domains/hooks';
import { esocialEngineService } from '@/domains/esocial-engine';
import { EVENT_TYPE_REGISTRY } from '@/domains/esocial-engine/types';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
  draft: { label: 'Rascunho', variant: 'default' },
  validated: { label: 'Validado', variant: 'info' },
  queued: { label: 'Na Fila', variant: 'warning' },
  transmitting: { label: 'Transmitindo', variant: 'warning' },
  accepted: { label: 'Aceito', variant: 'success' },
  rejected: { label: 'Rejeitado', variant: 'error' },
  error: { label: 'Erro', variant: 'error' },
  cancelled: { label: 'Cancelado', variant: 'default' },
};

const VARIANT_CLASSES: Record<string, string> = {
  success: 'bg-primary/10 text-primary',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
  default: 'bg-muted text-muted-foreground',
};

function TransmissionBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, variant: 'default' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', VARIANT_CLASSES[cfg.variant] || VARIANT_CLASSES.default)}>
      {cfg.label}
    </span>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  tabelas: 'Tabelas',
  nao_periodicos: 'Não Periódicos',
  periodicos: 'Periódicos',
  sst: 'SST',
  gfip_fgts: 'GFIP/FGTS',
};

export default function ESocialDashboard() {
  const qs = useQueryScope();
  const qc = useQueryClient();

  const { data: envelopes = [], isLoading } = useQuery({
    queryKey: ['esocial-envelopes', qs?.tenantId],
    queryFn: () => qs ? esocialEngineService.listEnvelopes(qs) : [],
    enabled: !!qs,
  });

  const queueMutation = useMutation({
    mutationFn: () => qs ? esocialEngineService.queueValidated(qs) : Promise.resolve(0),
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['esocial-envelopes'] });
      toast.success(`${count} evento(s) enfileirado(s) para transmissão`);
    },
    onError: () => toast.error('Erro ao enfileirar eventos'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => esocialEngineService.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['esocial-envelopes'] });
      toast.success('Evento cancelado');
    },
  });

  // Stats
  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    for (const e of envelopes) {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      byCategory[e.category] = (byCategory[e.category] || 0) + 1;
    }
    const pending = (byStatus['draft'] || 0) + (byStatus['validated'] || 0) + (byStatus['queued'] || 0);
    const errors = (byStatus['error'] || 0) + (byStatus['rejected'] || 0);
    const accepted = byStatus['accepted'] || 0;
    const rate = envelopes.length > 0 ? ((accepted / envelopes.length) * 100).toFixed(0) : '0';
    return { byStatus, byCategory, pending, errors, accepted, rate, total: envelopes.length };
  }, [envelopes]);

  const pendingEvents = envelopes.filter(e => ['draft', 'validated', 'queued'].includes(e.status));
  const errorEvents = envelopes.filter(e => ['error', 'rejected'].includes(e.status));
  const recentAccepted = envelopes.filter(e => e.status === 'accepted').slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">eSocial — Painel de Transmissão</h1>
          <p className="text-muted-foreground mt-1">Monitoramento de eventos e comunicação com o governo</p>
        </div>
        <button
          onClick={() => queueMutation.mutate()}
          disabled={queueMutation.isPending || pendingEvents.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition disabled:opacity-50"
        >
          <Zap className="h-4 w-4" />
          Enfileirar Validados
        </button>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard title="Total de Eventos" value={stats.total} subtitle="registrados" icon={FileText} />
        <StatsCard
          title="Pendentes"
          value={stats.pending}
          subtitle="aguardando transmissão"
          icon={Clock}
          className={stats.pending > 0 ? 'border-l-4 border-l-warning' : ''}
        />
        <StatsCard
          title="Erros / Rejeitados"
          value={stats.errors}
          subtitle="requerem atenção"
          icon={AlertTriangle}
          className={stats.errors > 0 ? 'border-l-4 border-l-destructive' : ''}
        />
        <StatsCard
          title="Taxa de Aceite"
          value={`${stats.rate}%`}
          subtitle={`${stats.accepted} aceitos`}
          icon={CheckCircle2}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Events */}
        <div className="bg-card rounded-xl shadow-card p-6 border-t-4 border-t-warning/60">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Eventos Pendentes</h2>
            <span className="ml-auto text-xs text-muted-foreground">{pendingEvents.length}</span>
          </div>
          {pendingEvents.length > 0 ? (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {pendingEvents.slice(0, 10).map(env => (
                <div key={env.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate">
                      {EVENT_TYPE_REGISTRY[env.event_type]?.name || env.event_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[env.category]} · v{env.layout_version} · {env.created_at.slice(0, 10)}
                    </p>
                  </div>
                  <TransmissionBadge status={env.status} />
                  <button onClick={() => cancelMutation.mutate(env.id)} className="text-muted-foreground hover:text-destructive transition" title="Cancelar">
                    <Ban className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-muted-foreground">Nenhum evento pendente.</p>
            </div>
          )}
        </div>

        {/* Errors / Rejected */}
        <div className="bg-card rounded-xl shadow-card p-6 border-t-4 border-t-destructive/60">
          <div className="flex items-center gap-2 mb-5">
            <XCircle className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Erros e Rejeições</h2>
            <span className="ml-auto text-xs text-muted-foreground">{errorEvents.length}</span>
          </div>
          {errorEvents.length > 0 ? (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {errorEvents.slice(0, 10).map(env => (
                <div key={env.id} className="p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                  <div className="flex items-center gap-2 mb-1">
                    <TransmissionBadge status={env.status} />
                    <span className="text-xs font-medium text-card-foreground">
                      {EVENT_TYPE_REGISTRY[env.event_type]?.name || env.event_type}
                    </span>
                  </div>
                  {env.error_message && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{env.error_message}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Tentativa {env.retry_count} · {env.created_at.slice(0, 10)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-muted-foreground">Nenhum erro registrado. ✓</p>
            </div>
          )}
        </div>
      </div>

      {/* Category breakdown + Recent accepted */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Category */}
        <div className="bg-card rounded-xl shadow-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Por Categoria</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
              const count = stats.byCategory[key] || 0;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-32 truncate">{label}</span>
                  <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-card-foreground w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Accepted */}
        <div className="bg-card rounded-xl shadow-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold font-display text-card-foreground">Últimos Aceitos</h2>
          </div>
          {recentAccepted.length > 0 ? (
            <div className="space-y-2.5">
              {recentAccepted.map(env => (
                <div key={env.id} className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate">
                      {EVENT_TYPE_REGISTRY[env.event_type]?.name || env.event_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {env.receipt_number ? `Recibo: ${env.receipt_number}` : 'Sem recibo'} · {env.accepted_at?.slice(0, 10) || ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-muted-foreground">Nenhum evento aceito ainda.</p>
            </div>
          )}
        </div>
      </div>

      {/* Full Event Log */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Send className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold font-display text-card-foreground">Log de Eventos</h2>
          <span className="ml-auto text-xs text-muted-foreground">{envelopes.length} evento(s)</span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : envelopes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 text-muted-foreground font-medium">Evento</th>
                  <th className="pb-3 text-muted-foreground font-medium">Categoria</th>
                  <th className="pb-3 text-muted-foreground font-medium">Versão</th>
                  <th className="pb-3 text-muted-foreground font-medium">Status</th>
                  <th className="pb-3 text-muted-foreground font-medium">Tentativas</th>
                  <th className="pb-3 text-muted-foreground font-medium">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {envelopes.slice(0, 20).map(env => (
                  <tr key={env.id} className="border-b border-border/50 hover:bg-secondary/20 transition">
                    <td className="py-3 text-card-foreground font-medium">
                      {EVENT_TYPE_REGISTRY[env.event_type]?.name || env.event_type}
                    </td>
                    <td className="py-3 text-muted-foreground">{CATEGORY_LABELS[env.category] || env.category}</td>
                    <td className="py-3 text-muted-foreground">{env.layout_version}</td>
                    <td className="py-3">
                      <TransmissionBadge status={env.status} />
                    </td>
                    <td className="py-3 text-muted-foreground text-center">{env.retry_count}</td>
                    <td className="py-3 text-muted-foreground">{env.created_at.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground">Nenhum evento eSocial registrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
