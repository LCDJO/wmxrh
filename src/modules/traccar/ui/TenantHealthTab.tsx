/**
 * TenantHealthTab — Tenant-scoped integration health + token owner display.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Activity, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Loader2, Server, ShieldCheck, Cpu, Radio, Layers, Clock,
  Gauge, User, ShieldAlert, Info, Bell, BellOff,
} from 'lucide-react';
import {
  getTenantHealthHistory,
  triggerHealthCheck,
  getTenantHealthAlerts,
  resolveHealthAlert,
  type HealthCheckResult,
  type CheckResult,
  type HealthAlert,
  type TraccarTokenOwner,
} from '../services/integration-health.service';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

const STATUS_CONFIG = {
  healthy: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Saudável', icon: CheckCircle2 },
  degraded: { color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Degradado', icon: AlertTriangle },
  critical: { color: 'text-destructive', bg: 'bg-destructive/10', label: 'Crítico', icon: XCircle },
  unknown: { color: 'text-muted-foreground', bg: 'bg-muted/30', label: 'Desconhecido', icon: Clock },
} as const;

const CHECK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  server_connection: Server,
  api_authentication: ShieldCheck,
  device_sync: Cpu,
  event_flow: Radio,
  queue_health: Layers,
  alert_generation: AlertTriangle,
};

const CHECK_LABELS: Record<string, string> = {
  server_connection: 'Conexão Servidor',
  api_authentication: 'Autenticação API',
  device_sync: 'Sincronização Dispositivos',
  event_flow: 'Fluxo de Eventos',
  queue_health: 'Saúde da Fila',
  alert_generation: 'Geração de Alertas',
};

function CheckStatusBadge({ check }: { check: CheckResult }) {
  const variants: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
    pass: 'default', fail: 'destructive', warn: 'secondary', unknown: 'outline',
  };
  const labels: Record<string, string> = { pass: '✓ OK', fail: '✗ Falha', warn: '⚠ Alerta', unknown: '? N/A' };
  return <Badge variant={variants[check.status] || 'outline'} className="text-xs">{labels[check.status] || check.status}</Badge>;
}

interface Props {
  tenantId: string | null;
}

export default function TenantHealthTab({ tenantId }: Props) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);

  // Latest health check for this tenant
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['tenant-health-history', tenantId],
    queryFn: () => getTenantHealthHistory(tenantId!, 20),
    enabled: !!tenantId,
  });

  const latestCheck = history[0] ?? null;

  // Token owner from sync status
  const { data: tokenOwner = null } = useQuery({
    queryKey: ['tenant-token-owner', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('traccar_sync_status')
        .select('metadata')
        .eq('tenant_id', tenantId)
        .eq('sync_type', 'polling')
        .maybeSingle();
      const meta = data?.metadata as { token_owner?: TraccarTokenOwner } | null;
      return meta?.token_owner ?? null;
    },
    enabled: !!tenantId,
  });

  // Alerts for this tenant
  const { data: alerts = [] } = useQuery({
    queryKey: ['tenant-health-alerts', tenantId],
    queryFn: () => getTenantHealthAlerts(tenantId!, 20),
    enabled: !!tenantId,
  });

  const activeAlerts = alerts.filter(a => !a.is_resolved);

  const handleRunCheck = async () => {
    if (!tenantId) return;
    setRunning(true);
    try {
      await triggerHealthCheck(tenantId);
      await queryClient.invalidateQueries({ queryKey: ['tenant-health-history', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['tenant-health-alerts', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['tenant-token-owner', tenantId] });
      toast.success('Verificação de saúde concluída');
    } catch {
      toast.error('Erro ao executar verificação');
    }
    setRunning(false);
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await resolveHealthAlert(alertId);
      await queryClient.invalidateQueries({ queryKey: ['tenant-health-alerts', tenantId] });
      toast.success('Alerta resolvido');
    } catch {
      toast.error('Erro ao resolver alerta');
    }
  };

  if (!tenantId) {
    return <p className="text-sm text-muted-foreground text-center py-8">Tenant não identificado.</p>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cfg = latestCheck ? STATUS_CONFIG[latestCheck.health_status] : STATUS_CONFIG.unknown;
  const StatusIcon = cfg.icon;

  return (
    <div className="space-y-4">
      {/* Token Owner Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Proprietário do Token (API Key)
          </CardTitle>
          <CardDescription>Identificação do usuário vinculado à chave de API configurada</CardDescription>
        </CardHeader>
        <CardContent>
          {tokenOwner ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Nome</span>
                <span className="font-medium text-foreground">{tokenOwner.name || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">E-mail</span>
                <span className="font-medium text-foreground">{tokenOwner.email}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Função</span>
                <Badge variant={tokenOwner.administrator ? 'default' : tokenOwner.readonly ? 'outline' : 'secondary'} className="text-xs mt-0.5">
                  {tokenOwner.administrator ? '🛡️ Administrador' : tokenOwner.readonly ? '👁️ Somente Leitura' : '👤 Usuário Padrão'}
                </Badge>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Acesso Total</span>
                {tokenOwner.administrator ? (
                  <span className="text-xs font-medium flex items-center gap-1 mt-0.5 text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Sim — vê todos os dispositivos
                  </span>
                ) : (
                  <span className="text-xs font-medium flex items-center gap-1 mt-0.5 text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" /> Não — acesso limitado
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Informação indisponível — execute uma verificação de saúde ou sincronização para identificar o proprietário do token.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Health Score + Run Button */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Saúde da Integração
            </CardTitle>
            <Button size="sm" onClick={handleRunCheck} disabled={running} className="gap-1.5">
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Verificar Agora
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {latestCheck ? (
            <div className="space-y-4">
              {/* Score + Status */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <Gauge className="h-6 w-6 text-muted-foreground" />
                  <span className="text-4xl font-bold">{latestCheck.health_score}</span>
                  <span className="text-sm text-muted-foreground">/100</span>
                </div>
                <div className={`flex items-center gap-1.5 ${cfg.color}`}>
                  <StatusIcon className="h-5 w-5" />
                  <span className="font-semibold">{cfg.label}</span>
                </div>
                <span className="text-xs text-muted-foreground ml-auto">
                  Última verificação: {new Date(latestCheck.checked_at).toLocaleString('pt-BR')}
                </span>
              </div>

              <Progress value={latestCheck.health_score} className="h-2.5" />

              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <div className="text-2xl font-bold">{latestCheck.devices_synced}</div>
                  <div className="text-xs text-muted-foreground">Dispositivos</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <div className="text-2xl font-bold">{latestCheck.events_last_24h}</div>
                  <div className="text-xs text-muted-foreground">Eventos (24h)</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <div className="text-2xl font-bold">{latestCheck.queue_lag}</div>
                  <div className="text-xs text-muted-foreground">Queue Lag</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <div className="text-2xl font-bold">{latestCheck.server_response_time_ms ?? '—'}<span className="text-xs font-normal">ms</span></div>
                  <div className="text-xs text-muted-foreground">Latência</div>
                </div>
              </div>

              {/* Individual Checks */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Testes de Saúde</h4>
                {Object.entries(CHECK_LABELS).map(([key, label]) => {
                  const checkData = (latestCheck as any)[key] as CheckResult | undefined;
                  const Icon = CHECK_ICONS[key] || Activity;
                  return (
                    <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground max-w-[250px] truncate">{checkData?.message}</span>
                        <CheckStatusBadge check={checkData || { status: 'unknown', message: '' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {latestCheck.error_summary && (
                <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
                  {latestCheck.error_summary}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 space-y-3">
              <Activity className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Nenhuma verificação registrada. Clique em "Verificar Agora" para executar a primeira.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-destructive" /> Alertas Ativos ({activeAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeAlerts.map(alert => (
              <div key={alert.id} className={`p-3 rounded border text-sm ${
                alert.severity === 'critical' ? 'bg-destructive/10 border-destructive/20' : 'bg-amber-500/10 border-amber-500/20'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                      {alert.severity === 'critical' ? '🔴 Crítico' : '🟡 Alerta'}
                    </Badge>
                    <span className="font-medium">{alert.message}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleResolveAlert(alert.id)}>
                    <BellOff className="h-3 w-3" /> Resolver
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{new Date(alert.created_at).toLocaleString('pt-BR')}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Histórico de Verificações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
              {history.map(h => {
                const hCfg = STATUS_CONFIG[h.health_status];
                return (
                  <div key={h.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0">
                    <span className="text-muted-foreground">{new Date(h.checked_at).toLocaleString('pt-BR')}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={h.health_score} className="h-1.5 w-20" />
                      <span className="font-mono w-6 text-right">{h.health_score}</span>
                      <span className={`${hCfg.color} text-xs w-20`}>{hCfg.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Legend */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h4 className="text-sm font-semibold text-foreground">Legenda — Níveis de Acesso do Token Traccar</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-[10px]">🛡️ Administrador</Badge>
                  <span>Acesso total a todos os dispositivos, grupos e relatórios.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">👤 Usuário Padrão</Badge>
                  <span>Acesso apenas a dispositivos vinculados ao seu perfil.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">👁️ Somente Leitura</Badge>
                  <span>Visualização sem permissão de alterações.</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/80 pt-1 flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                <strong>Importante:</strong> Apenas tokens vinculados a usuários <strong>Administradores</strong> possuem visibilidade completa de todos os dispositivos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
