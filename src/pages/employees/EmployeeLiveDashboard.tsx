/**
 * EmployeeLiveDashboard — Ficha Viva do Colaborador
 *
 * Painel completo com:
 *   - Histórico completo (timeline de eventos)
 *   - QR Code (identificação rápida)
 *   - Eventos jurídicos
 *   - Performance (avaliações 90/180/360)
 *   - Riscos (indicadores estruturais + alertas)
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User, QrCode, Scale, TrendingUp, ShieldAlert, Clock,
  ArrowLeft, Star, AlertTriangle, CheckCircle2, FileText,
  Activity, Target, ChevronRight, Loader2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTenant } from '@/contexts/TenantContext';
import { employeeMasterRecordService } from '@/domains/employee-master-record/employee-master-record.service';
import { GovernanceEventStore } from '@/domains/governance/repositories/governance-event-store';
import { getPerformanceService } from '@/domains/employee-lifecycle-engine/performance';
import { getAlertEngine } from '@/domains/governance';
import type { ExecutiveAlert } from '@/domains/governance/services/alert-engine';
import type { GovernanceDomainEvent } from '@/domains/governance/events/governance-domain-event';
import type { EmployeeReview } from '@/domains/employee-lifecycle-engine/performance';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const eventStore = new GovernanceEventStore();
const performanceService = getPerformanceService();

export default function EmployeeLiveDashboard() {
  const { id: employeeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const [loading, setLoading] = useState(true);
  const [masterRecord, setMasterRecord] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<GovernanceDomainEvent[]>([]);
  const [legalEvents, setLegalEvents] = useState<GovernanceDomainEvent[]>([]);
  const [reviews, setReviews] = useState<EmployeeReview[]>([]);
  const [alerts, setAlerts] = useState<ExecutiveAlert[]>([]);

  useEffect(() => {
    if (!employeeId || !tenantId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, tenantId]);

  async function loadAll() {
    if (!employeeId || !tenantId) return;
    setLoading(true);
    try {
      const [record, allEvents, perfReviews, employeeAlerts] = await Promise.all([
        employeeMasterRecordService.loadFullRecord(employeeId, tenantId).catch(() => null),
        eventStore.loadStream(tenantId, 'employee', employeeId).catch(() => []),
        performanceService.getEmployeeHistory(tenantId, employeeId).catch(() => []),
        getAlertEngine().evaluateEmployee(tenantId, employeeId).catch(() => []),
      ]);

      setMasterRecord(record as unknown as Record<string, unknown>);
      setEvents(allEvents);
      setLegalEvents(allEvents.filter((e: GovernanceDomainEvent) =>
        e.event_type.includes('Legal') || e.event_type.includes('Warned') ||
        e.event_type.includes('Suspended') || e.event_type.includes('Terminated')
      ));
      setReviews(perfReviews);
      setAlerts(employeeAlerts);
    } catch (err) {
      console.error('[EmployeeLiveDashboard] Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const record = masterRecord?.record as Record<string, unknown> | undefined;
  const employeeName = (record?.nome_completo as string) ?? (record?.nome as string) ?? 'Colaborador';
  const employeeCargo = (record?.cargo as string) ?? '—';
  const employeeDept = (record?.departamento as string) ?? '—';
  const employeeStatus = (record?.status as string) ?? 'ativo';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Ficha Viva</h1>
          <p className="text-sm text-muted-foreground">Painel integrado do colaborador</p>
        </div>
        <Badge variant={employeeStatus === 'ativo' ? 'default' : 'secondary'} className="text-xs">
          {employeeStatus}
        </Badge>
      </div>

      {/* Identity + QR Code */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <h2 className="text-xl font-semibold text-foreground">{employeeName}</h2>
                <p className="text-sm text-muted-foreground">{employeeCargo} · {employeeDept}</p>
                <div className="flex gap-2 mt-3">
                  <SummaryBadge icon={<FileText className="h-3 w-3" />} label="Eventos" value={events.length} />
                  <SummaryBadge icon={<Scale className="h-3 w-3" />} label="Jurídicos" value={legalEvents.length} />
                  <SummaryBadge icon={<Star className="h-3 w-3" />} label="Avaliações" value={reviews.length} />
                  <SummaryBadge icon={<ShieldAlert className="h-3 w-3" />} label="Alertas" value={alerts.length} isAlert={alerts.length > 0} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex flex-col items-center justify-center gap-3">
            <QRCodeSVG
              value={`employee:${employeeId}`}
              size={120}
              level="M"
              bgColor="transparent"
              fgColor="hsl(var(--foreground))"
            />
            <p className="text-[10px] text-muted-foreground font-mono">{employeeId?.slice(0, 8)}</p>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <QrCode className="h-3 w-3" />
              <span>Identificação rápida</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Risk Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <RiskSummaryCard
          title="Eventos Totais"
          value={events.length}
          icon={<Activity className="h-4 w-4 text-primary" />}
        />
        <RiskSummaryCard
          title="Exposição Jurídica"
          value={legalEvents.length}
          icon={<Scale className="h-4 w-4 text-primary" />}
          isAlert={legalEvents.length > 2}
        />
        <RiskSummaryCard
          title="Alertas Ativos"
          value={alerts.filter(a => a.status === 'open').length}
          icon={<ShieldAlert className="h-4 w-4 text-primary" />}
          isAlert={alerts.filter(a => a.status === 'open').length > 0}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="timeline" className="gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="legal" className="gap-1.5 text-xs">
            <Scale className="h-3.5 w-3.5" /> Jurídico
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5 text-xs">
            <TrendingUp className="h-3.5 w-3.5" /> Performance
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5" /> Riscos
          </TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Linha do Tempo Completa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento registrado.</p>
                ) : (
                  <div className="space-y-1">
                    {events.map((event, i) => (
                      <TimelineItem key={event.id} event={event} isLast={i === events.length - 1} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Legal Tab */}
        <TabsContent value="legal">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                Eventos Jurídicos ({legalEvents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {legalEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem eventos jurídicos.</p>
                ) : (
                  <div className="space-y-3">
                    {legalEvents.map(event => (
                      <LegalEventCard key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Histórico de Avaliações ({reviews.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma avaliação completada.</p>
                ) : (
                  <div className="space-y-3">
                    {reviews.map(review => (
                      <ReviewCard key={review.id} review={review} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                Alertas ({alerts.filter(a => a.status === 'open').length} ativos)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {alerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum alerta registrado.</p>
                ) : (
                  <div className="space-y-3">
                    {alerts.map(alert => (
                      <AlertCard key={alert.id} alert={alert} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-Components ──

function SummaryBadge({ icon, label, value, isAlert }: {
  icon: React.ReactNode; label: string; value: number; isAlert?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${
      isAlert ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
    }`}>
      {icon}
      <span>{value}</span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

function RiskSummaryCard({ title, value, icon, isAlert }: {
  title: string; value: number; icon: React.ReactNode; isAlert?: boolean;
}) {
  return (
    <Card className={isAlert ? 'border-destructive/30' : ''}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {icon}
            {title}
          </div>
          <span className={`text-2xl font-bold ${isAlert ? 'text-destructive' : 'text-foreground'}`}>
            {value}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineItem({ event, isLast }: { event: GovernanceDomainEvent; isLast: boolean }) {
  const iconMap: Record<string, React.ReactNode> = {
    EmployeeHired: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
    EmployeeWarned: <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />,
    EmployeeSuspended: <ShieldAlert className="h-3.5 w-3.5 text-orange-500" />,
    EmployeeTerminated: <ShieldAlert className="h-3.5 w-3.5 text-destructive" />,
    PerformanceReviewCompleted: <Star className="h-3.5 w-3.5 text-primary" />,
    LegalEventRecorded: <Scale className="h-3.5 w-3.5 text-purple-500" />,
  };

  const eventLabels: Record<string, string> = {
    EmployeeHired: 'Admissão',
    EmployeeWarned: 'Advertência',
    EmployeeSuspended: 'Suspensão',
    EmployeeTerminated: 'Desligamento',
    PerformanceReviewCompleted: 'Avaliação',
    LegalEventRecorded: 'Evento Jurídico',
    EmployeePromoted: 'Promoção',
    EmployeeSalaryAdjusted: 'Reajuste Salarial',
    DevelopmentPlanCreated: 'PDI Criado',
  };

  const payload = event.payload as Record<string, unknown>;
  const description = (payload?.motivo as string) ??
    (payload?.title as string) ??
    (payload?.description as string) ?? '';

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
          {iconMap[event.event_type] ?? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
        {!isLast && <div className="w-px flex-1 bg-border" />}
      </div>
      <div className="pb-4 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {eventLabels[event.event_type] ?? event.event_type}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatDate(event.occurred_at)}
          </span>
        </div>
        {description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
        )}
      </div>
    </div>
  );
}

function LegalEventCard({ event }: { event: GovernanceDomainEvent }) {
  const payload = event.payload as Record<string, unknown>;
  const severity = (payload?.severity as string) ?? 'low';

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">{event.event_type}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={severity === 'high' || severity === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
            {severity}
          </Badge>
          <span className="text-[10px] text-muted-foreground">{formatDate(event.occurred_at)}</span>
        </div>
      </div>
      {payload?.motivo ? <p className="text-[11px] text-muted-foreground">{String(payload.motivo)}</p> : null}
      {payload?.title ? <p className="text-[11px] text-muted-foreground">{String(payload.title)}</p> : null}
      {payload?.base_legal ? (
        <p className="text-[10px] text-muted-foreground italic">Base Legal: {String(payload.base_legal)}</p>
      ) : null}
    </div>
  );
}

function ReviewCard({ review }: { review: EmployeeReview }) {
  const typeLabels: Record<string, string> = { '90': '90°', '180': '180°', '360': '360°' };
  const score = review.overall_score ?? 0;

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            Avaliação {typeLabels[review.review_type] ?? review.review_type}
          </span>
          <Badge variant="outline" className="text-[10px]">{review.status}</Badge>
        </div>
        <span className={`text-lg font-bold ${score >= 4 ? 'text-green-600' : score >= 3 ? 'text-yellow-600' : 'text-destructive'}`}>
          {score.toFixed(1)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Metas</p>
          <Progress value={review.goals_total > 0 ? (review.goals_achieved / review.goals_total) * 100 : 0} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground mt-0.5">{review.goals_achieved}/{review.goals_total}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Competências</p>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(n => (
              <Star
                key={n}
                className="h-3 w-3"
                fill={n <= score ? 'hsl(45 93% 47%)' : 'transparent'}
                stroke={n <= score ? 'hsl(45 93% 47%)' : 'hsl(var(--muted-foreground))'}
              />
            ))}
          </div>
        </div>
      </div>

      {review.strengths.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {review.strengths.slice(0, 3).map((s, i) => (
            <Badge key={i} variant="outline" className="text-[9px]">{s}</Badge>
          ))}
        </div>
      )}
      {review.submitted_at && (
        <p className="text-[10px] text-muted-foreground">{formatDate(review.submitted_at)}</p>
      )}
    </div>
  );
}

function AlertCard({ alert }: { alert: ExecutiveAlert }) {
  return (
    <div className={`border rounded-lg p-3 space-y-2 ${
      alert.severity === 'critical' ? 'border-destructive/30 bg-destructive/5' :
      alert.severity === 'high' ? 'border-orange-500/30 bg-orange-500/5' :
      'border-yellow-500/30 bg-yellow-500/5'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold text-foreground">{alert.alert_type.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
            {alert.severity}
          </Badge>
          <Badge variant={alert.status === 'open' ? 'default' : 'outline'} className="text-[10px]">
            {alert.status}
          </Badge>
        </div>
      </div>
      {alert.trigger_factors && alert.trigger_factors.length > 0 && (
        <div className="space-y-1">
          {alert.trigger_factors.slice(0, 3).map((f, i) => (
            <p key={i} className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Target className="h-2.5 w-2.5" />
              {f.description}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}
