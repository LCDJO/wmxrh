/**
 * TimeTrackingPage — Controle de Ponto com banco de horas inteligente
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock, AlertTriangle, TrendingUp, Calendar, Timer, Plus, CheckCircle, Users, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployees } from '@/domains/hooks';
import { getTimeTrackingService, DEFAULT_TIME_RULES, type ClockEventType, type AlertSeverity } from '@/domains/workforce-operations-engine/time-tracking/time-tracking.service';
import { supabase } from '@/integrations/supabase/client';

const svc = getTimeTrackingService();

const EVENT_TYPE_LABELS: Record<ClockEventType, string> = {
  clock_in: 'Entrada',
  clock_out: 'Saída',
  break_start: 'Início de Intervalo',
  break_end: 'Fim de Intervalo',
};

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-yellow-100 text-yellow-800',
  critical: 'bg-red-100 text-red-800',
};

function fmtMinutes(m: number): string {
  const h = Math.floor(Math.abs(m) / 60);
  const min = Math.abs(m) % 60;
  const sign = m < 0 ? '-' : '';
  return `${sign}${h}h${min > 0 ? `${String(min).padStart(2, '0')}m` : ''}`;
}

function fmtTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

export default function TimeTrackingPage() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const tenantId = currentTenant?.id ?? '';
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState('overview');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<ClockEventType>('clock_in');
  const [notes, setNotes] = useState('');

  const { data: employees = [] } = useEmployees();

  // ── Metrics ──
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['time-tracking-metrics', tenantId],
    queryFn: () => svc.getMetrics(tenantId),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  // ── Recent clock events (today, all employees) ──
  const { data: recentEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['clock-events-today', tenantId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('clock_events' as any)
        .select('*, employees(name)')
        .eq('tenant_id', tenantId)
        .gte('timestamp', `${today}T00:00:00Z`)
        .order('timestamp', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!tenantId,
    refetchInterval: 15000,
  });

  // ── Alertas ──
  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['time-tracking-alerts', tenantId],
    queryFn: () => svc.getAlerts(tenantId, { unresolved_only: true, limit: 50 }),
    enabled: !!tenantId,
  });

  // ── Regras ──
  const { data: rules } = useQuery({
    queryKey: ['time-tracking-rules', tenantId],
    queryFn: () => svc.getEffectiveRules(tenantId),
    enabled: !!tenantId,
  });

  // ── Registro de ponto ──
  const registerClock = useMutation({
    mutationFn: () => svc.registerClock(tenantId, {
      employee_id: selectedEmployee,
      event_type: selectedEventType,
      source: 'manual',
      notes: notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Ponto registrado com sucesso!');
      qc.invalidateQueries({ queryKey: ['time-tracking-metrics', tenantId] });
      qc.invalidateQueries({ queryKey: ['clock-events-today', tenantId] });
      setRegisterOpen(false);
      setSelectedEmployee('');
      setNotes('');
    },
    onError: (e: Error) => toast.error(`Erro ao registrar ponto: ${e.message}`),
  });

  // ── Resolver alerta ──
  const resolveAlert = useMutation({
    mutationFn: (alertId: string) => svc.resolveAlert(alertId, user?.id ?? ''),
    onSuccess: () => {
      toast.success('Alerta resolvido.');
      qc.invalidateQueries({ queryKey: ['time-tracking-alerts', tenantId] });
      qc.invalidateQueries({ queryKey: ['time-tracking-metrics', tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeRules = rules ?? Object.fromEntries(
    Object.entries(DEFAULT_TIME_RULES).map(([k, v]) => [k, v.value])
  );

  const RULE_LABELS: Record<string, string> = {
    jornada_diaria: 'Jornada Diária',
    intervalo_intrajornada: 'Intervalo Intrajornada',
    hora_extra_limite: 'Limite de Horas Extras',
    adicional_noturno: 'Adicional Noturno',
    banco_horas: 'Banco de Horas',
    alertas: 'Configuração de Alertas',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Controle de Ponto</h1>
          <p className="text-muted-foreground">Banco de horas inteligente, regras configuráveis e alertas automáticos</p>
        </div>
        <Button className="gap-2" onClick={() => setRegisterOpen(true)}>
          <Plus className="h-4 w-4" />
          Registrar Ponto
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Presentes Hoje</p>
                <p className="text-2xl font-bold text-foreground">
                  {metricsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : metrics?.present_today ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-2/10">
                <Timer className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Banco de Horas Total</p>
                <p className="text-2xl font-bold text-foreground">
                  {metricsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : fmtMinutes(metrics?.total_bank_balance_minutes ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Alertas Ativos</p>
                <p className="text-2xl font-bold text-foreground">
                  {metricsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : metrics?.unresolved_alerts ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-4/10">
                <TrendingUp className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Com Horas Extras</p>
                <p className="text-2xl font-bold text-foreground">
                  {metricsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : metrics?.overtime_employees ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="bank">Banco de Horas</TabsTrigger>
          <TabsTrigger value="rules">Regras</TabsTrigger>
          <TabsTrigger value="alerts" className="relative">
            Alertas
            {(metrics?.unresolved_alerts ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground leading-none">
                {metrics!.unresolved_alerts}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Visão Geral ── */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Registros de Hoje
              </CardTitle>
              <CardDescription>Últimos registros de ponto dos colaboradores</CardDescription>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : recentEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mb-4 opacity-30" />
                  <p className="text-lg font-medium">Nenhum registro hoje</p>
                  <p className="text-sm">Use o botão "Registrar Ponto" para adicionar o primeiro.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentEvents.map((event: any) => (
                    <div key={event.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${event.event_type === 'clock_in' || event.event_type === 'break_end' ? 'bg-green-500' : 'bg-orange-400'}`} />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {event.employees?.name ?? 'Colaborador'}
                          </p>
                          <p className="text-xs text-muted-foreground">{event.notes ?? ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <Badge variant="secondary">{EVENT_TYPE_LABELS[event.event_type as ClockEventType] ?? event.event_type}</Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">{fmtTimestamp(event.timestamp)}</span>
                        {event.is_adjusted && <Badge variant="outline" className="text-xs">Ajustado</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary row */}
          {metrics && (
            <div className="grid grid-cols-3 gap-4 mt-4">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Ausentes</span>
                    <span className="ml-auto font-bold text-foreground">{metrics.absent_today}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Atrasados</span>
                    <span className="ml-auto font-bold text-foreground">{metrics.late_today}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Média trabalhada</span>
                    <span className="ml-auto font-bold text-foreground">{fmtMinutes(metrics.avg_worked_minutes)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── Banco de Horas ── */}
        <TabsContent value="bank">
          <Card>
            <CardHeader>
              <CardTitle>Banco de Horas Inteligente</CardTitle>
              <CardDescription>Créditos e débitos com expiração automática (CLT Art. 59)</CardDescription>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-lg border border-border p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-1">Saldo Total da Empresa</p>
                      <p className="text-3xl font-bold text-foreground">{fmtMinutes(metrics?.total_bank_balance_minutes ?? 0)}</p>
                    </div>
                    <div className="rounded-lg border border-border p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-1">Colaboradores com Horas Extras</p>
                      <p className="text-3xl font-bold text-chart-2">{metrics?.overtime_employees ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-border p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-1">Alertas de Expiração</p>
                      <p className="text-3xl font-bold text-destructive">
                        {alerts.filter(a => a.alert_type === 'bank_expiring').length}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
                    <Timer className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Para ver o saldo individual por colaborador, acesse o perfil do colaborador.</p>
                    <p className="text-xs mt-1 text-muted-foreground/70">As horas extras são creditadas automaticamente após o cálculo diário.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Regras ── */}
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Regras Configuráveis</CardTitle>
              <CardDescription>Jornada, tolerâncias, intervalos e banco de horas — baseados na CLT</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(DEFAULT_TIME_RULES).map(([key, def]) => {
                  const effective = activeRules[key] ?? def.value;
                  return (
                    <Card key={key} className="border-dashed">
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-foreground">{RULE_LABELS[key] ?? key}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{def.description}</p>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {Object.entries(effective).map(([k, v]) => (
                              <Badge key={k} variant="secondary" className="text-xs font-mono">
                                {k}: {typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Alertas ── */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Alertas Automáticos
              </CardTitle>
              <CardDescription>Irregularidades detectadas pelo motor de conformidade</CardDescription>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mb-4 opacity-30 text-green-500" />
                  <p className="text-lg font-medium">Nenhum alerta ativo</p>
                  <p className="text-sm">Todos os colaboradores estão em conformidade.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert: any) => (
                    <div key={alert.id} className="flex items-start justify-between rounded-lg border border-border p-4 gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${alert.severity === 'critical' ? 'text-destructive' : alert.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{alert.message}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Referência: {alert.reference_date} · {new Date(alert.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${SEVERITY_COLORS[alert.severity as AlertSeverity]}`}>
                          {alert.severity}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveAlert.mutate(alert.id)}
                          disabled={resolveAlert.isPending}
                        >
                          Resolver
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog: Registrar Ponto ── */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Ponto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador *</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Registro *</Label>
              <Select value={selectedEventType} onValueChange={(v) => setSelectedEventType(v as ClockEventType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Registro manual via painel de RH..."
                rows={2}
              />
            </div>

            <Button
              className="w-full"
              disabled={!selectedEmployee || registerClock.isPending}
              onClick={() => registerClock.mutate()}
            >
              {registerClock.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registrando...</>
              ) : (
                'Confirmar Registro'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
