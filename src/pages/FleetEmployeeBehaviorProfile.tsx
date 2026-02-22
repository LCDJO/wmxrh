/**
 * Fleet Employee Behavior Profile
 *
 * Painel dedicado por motorista com:
 * - Histórico completo de eventos
 * - Advertências
 * - Treinamentos
 * - EPI
 * - Score de risco (behavioral-score.engine)
 * - Tendência comportamental
 */
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';
import {
  User, Shield, AlertTriangle, TrendingUp, TrendingDown,
  FileText, HardHat, GraduationCap, Clock, CheckCircle2,
  XCircle, ChevronLeft, Activity, Gauge, Calendar,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import { computeBehavioralScore, type BehavioralScoreResult } from '@/domains/fleet-compliance/behavioral-score.engine';
import type { BehaviorSeverity } from '@/domains/fleet-compliance/types';

// ── Mock Data ──

const MOCK_EMPLOYEES = [
  { id: 'e1', name: 'Carlos Silva', department: 'Logística', position: 'Motorista Sênior', admissionDate: '2021-03-15', photo: null },
  { id: 'e2', name: 'Ana Oliveira', department: 'Entregas', position: 'Motorista', admissionDate: '2022-08-01', photo: null },
  { id: 'e3', name: 'Roberto Santos', department: 'Logística', position: 'Motorista Júnior', admissionDate: '2023-11-20', photo: null },
];

function generateMockEvents(employeeId: string) {
  const types = ['overspeed', 'geofence_violation', 'route_deviation', 'after_hours_use'] as const;
  const severities: BehaviorSeverity[] = ['low', 'medium', 'high', 'critical'];
  const events = [];
  const count = employeeId === 'e1' ? 8 : employeeId === 'e2' ? 3 : 15;
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 180);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    events.push({
      id: `evt-${employeeId}-${i}`,
      tenant_id: 't1',
      device_id: 'd1',
      employee_id: employeeId,
      company_id: 'c1',
      event_type: types[Math.floor(Math.random() * types.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      details: { speed: 80 + Math.floor(Math.random() * 40) },
      source_event_id: null,
      event_timestamp: date.toISOString(),
      created_at: date.toISOString(),
    });
  }
  return events.sort((a, b) => new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime());
}

function generateMockWarnings(employeeId: string) {
  const types = ['verbal', 'written', 'suspension'] as const;
  const count = employeeId === 'e3' ? 4 : employeeId === 'e1' ? 2 : 0;
  const warnings = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 120) + 10;
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    warnings.push({
      id: `w-${employeeId}-${i}`,
      tenant_id: 't1',
      employee_id: employeeId,
      company_id: 'c1',
      incident_id: `inc-${i}`,
      warning_type: types[Math.min(i, types.length - 1)],
      description: `Advertência por infração recorrente #${i + 1}`,
      document_url: null,
      signature_request_id: null,
      signature_status: i === 0 ? 'signed' as const : 'pending' as const,
      signed_at: i === 0 ? date.toISOString() : null,
      issued_by: 'Gestor',
      issued_at: date.toISOString(),
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
    });
  }
  return warnings;
}

function generateMockTrainings(employeeId: string) {
  const trainings = [
    { name: 'Direção Defensiva', required: true },
    { name: 'Uso de Tacógrafo', required: true },
    { name: 'Primeiros Socorros', required: false },
    { name: 'Transporte de Cargas', required: true },
  ];
  return trainings.map((t, i) => ({
    id: `tr-${employeeId}-${i}`,
    name: t.name,
    required: t.required,
    completed: employeeId !== 'e3' || i < 2,
    completedAt: employeeId !== 'e3' || i < 2
      ? new Date(2024, i * 2, 15).toISOString()
      : null,
    expiresAt: new Date(2026, i * 3, 1).toISOString(),
    status: employeeId === 'e3' && i >= 2 ? 'pendente' : 'válido',
  }));
}

function generateMockEpi(employeeId: string) {
  const items = [
    { name: 'Luvas de Proteção', ca: 'CA-12345' },
    { name: 'Óculos de Segurança', ca: 'CA-23456' },
    { name: 'Colete Refletivo', ca: 'CA-34567' },
    { name: 'Calçado de Segurança', ca: 'CA-45678' },
  ];
  return items.map((item, i) => {
    const delivered = new Date(2025, 0, 15 + i * 7);
    const expires = new Date(delivered);
    expires.setMonth(expires.getMonth() + (employeeId === 'e3' && i === 0 ? -1 : 6));
    return {
      id: `epi-${employeeId}-${i}`,
      name: item.name,
      ca: item.ca,
      deliveredAt: delivered.toISOString(),
      expiresAt: expires.toISOString(),
      status: expires < new Date() ? 'vencido' : 'válido',
      signed: employeeId !== 'e3' || i < 2,
    };
  });
}

function generateTrendData(employeeId: string) {
  const months = ['Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev'];
  const base = employeeId === 'e1' ? 82 : employeeId === 'e2' ? 92 : 55;
  return months.map((m, i) => ({
    month: m,
    score: Math.max(0, Math.min(100, base + (employeeId === 'e3' ? -i * 3 : i * 2) + Math.floor(Math.random() * 8 - 4))),
    incidents: Math.max(0, Math.floor(Math.random() * (employeeId === 'e3' ? 6 : 3))),
  }));
}

// ── Helpers ──

const SEVERITY_COLORS: Record<BehaviorSeverity, string> = {
  low: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  high: 'bg-orange-500/15 text-orange-700 border-orange-500/30',
  critical: 'bg-red-500/15 text-red-700 border-red-500/30',
};

const EVENT_LABELS: Record<string, string> = {
  overspeed: 'Excesso de Velocidade',
  geofence_violation: 'Violação de Cerca',
  route_deviation: 'Desvio de Rota',
  after_hours_use: 'Uso Fora do Horário',
};

const WARNING_LABELS: Record<string, string> = {
  verbal: 'Verbal',
  written: 'Escrita',
  suspension: 'Suspensão',
  termination: 'Demissão',
};

function gradeColor(grade: string) {
  switch (grade) {
    case 'A': return 'text-emerald-500';
    case 'B': return 'text-blue-500';
    case 'C': return 'text-amber-500';
    case 'D': return 'text-orange-500';
    default: return 'text-red-500';
  }
}

function riskBadge(level: string) {
  switch (level) {
    case 'low': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">Baixo</Badge>;
    case 'medium': return <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">Médio</Badge>;
    case 'high': return <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/30">Alto</Badge>;
    default: return <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">Crítico</Badge>;
  }
}

// ── Main Component ──

export default function FleetEmployeeBehaviorProfile() {
  const [selectedEmployee, setSelectedEmployee] = useState(MOCK_EMPLOYEES[0].id);

  const employee = MOCK_EMPLOYEES.find(e => e.id === selectedEmployee)!;
  const events = useMemo(() => generateMockEvents(selectedEmployee), [selectedEmployee]);
  const warnings = useMemo(() => generateMockWarnings(selectedEmployee), [selectedEmployee]);
  const trainings = useMemo(() => generateMockTrainings(selectedEmployee), [selectedEmployee]);
  const epiItems = useMemo(() => generateMockEpi(selectedEmployee), [selectedEmployee]);
  const trendData = useMemo(() => generateTrendData(selectedEmployee), [selectedEmployee]);

  const scoreResult: BehavioralScoreResult = useMemo(() => {
    const oldestEvent = events.length > 0
      ? events[events.length - 1]
      : null;
    const daysSinceLast = oldestEvent
      ? Math.floor((Date.now() - new Date(events[0].event_timestamp).getTime()) / 86_400_000)
      : 90;
    return computeBehavioralScore({
      employeeId: selectedEmployee,
      behaviorEvents: events,
      warnings,
      daysSinceLastIncident: Math.max(0, daysSinceLast),
      allAgreementsSigned: warnings.every(w => w.signature_status === 'signed'),
    });
  }, [selectedEmployee, events, warnings]);

  const radarData = useMemo(() => {
    const typeCount: Record<string, number> = {};
    for (const e of events) {
      typeCount[e.event_type] = (typeCount[e.event_type] || 0) + 1;
    }
    return Object.entries(EVENT_LABELS).map(([key, label]) => ({
      subject: label,
      value: typeCount[key] || 0,
      fullMark: 10,
    }));
  }, [events]);

  const trendDirection = trendData.length >= 2
    ? trendData[trendData.length - 1].score - trendData[trendData.length - 2].score
    : 0;

  const pendingTrainings = trainings.filter(t => !t.completed).length;
  const expiredEpi = epiItems.filter(e => e.status === 'vencido').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Perfil Comportamental</h1>
          <p className="text-muted-foreground text-sm">Análise detalhada do motorista</p>
        </div>
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MOCK_EMPLOYEES.map(emp => (
              <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Employee Card + Score Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Profile Card */}
        <Card className="md:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{employee.name}</h2>
                <p className="text-sm text-muted-foreground">{employee.position}</p>
                <p className="text-xs text-muted-foreground">{employee.department}</p>
              </div>
              <Separator />
              <div className="w-full space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Admissão</span>
                  <span>{new Date(employee.admissionDate).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Eventos (6m)</span>
                  <span className="font-medium">{events.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advertências</span>
                  <span className="font-medium">{warnings.length}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Card */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="h-4 w-4" /> Score Comportamental
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className={`text-6xl font-black ${gradeColor(scoreResult.grade)}`}>
                {scoreResult.score}
              </div>
              <div className={`absolute -top-1 -right-6 text-3xl font-bold ${gradeColor(scoreResult.grade)}`}>
                {scoreResult.grade}
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm">
              {trendDirection > 0 ? (
                <><ArrowUpRight className="h-4 w-4 text-emerald-500" /><span className="text-emerald-600">Melhorando</span></>
              ) : trendDirection < 0 ? (
                <><ArrowDownRight className="h-4 w-4 text-red-500" /><span className="text-red-600">Piorando</span></>
              ) : (
                <><Minus className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Estável</span></>
              )}
            </div>
            <div className="w-full">{riskBadge(scoreResult.riskLevel)}</div>
            <Separator />
            <div className="w-full space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Penalidade comportamento</span><span className="text-red-600">-{scoreResult.breakdown.behaviorPenalty}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Penalidade advertências</span><span className="text-red-600">-{scoreResult.breakdown.warningPenalty}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Bônus sem incidentes</span><span className="text-emerald-600">+{scoreResult.breakdown.recencyBonus}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Bônus termos assinados</span><span className="text-emerald-600">+{scoreResult.breakdown.agreementBonus}</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts Summary */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Alertas Ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scoreResult.factors.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
            <Separator />
            <div className="space-y-2">
              {pendingTrainings > 0 && (
                <div className="flex items-center gap-2 text-sm text-orange-600">
                  <GraduationCap className="h-4 w-4" />
                  {pendingTrainings} treinamento(s) pendente(s)
                </div>
              )}
              {expiredEpi > 0 && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <HardHat className="h-4 w-4" />
                  {expiredEpi} EPI(s) vencido(s)
                </div>
              )}
              {warnings.filter(w => w.signature_status === 'pending').length > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <FileText className="h-4 w-4" />
                  {warnings.filter(w => w.signature_status === 'pending').length} advertência(s) não assinada(s)
                </div>
              )}
              {pendingTrainings === 0 && expiredEpi === 0 && warnings.filter(w => w.signature_status === 'pending').length === 0 && (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Sem pendências
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Tendência Comportamental (6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" />
                <ReTooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="score" name="Score" stroke="hsl(var(--primary))" fill="url(#scoreGrad)" strokeWidth={2} />
                <Line type="monotone" dataKey="incidents" name="Incidentes" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detail Tabs */}
      <Tabs defaultValue="history" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm"><Clock className="h-3.5 w-3.5" /> Histórico</TabsTrigger>
          <TabsTrigger value="warnings" className="gap-1.5 text-xs sm:text-sm"><FileText className="h-3.5 w-3.5" /> Advertências</TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5 text-xs sm:text-sm"><GraduationCap className="h-3.5 w-3.5" /> Treinamentos</TabsTrigger>
          <TabsTrigger value="epi" className="gap-1.5 text-xs sm:text-sm"><HardHat className="h-3.5 w-3.5" /> EPI</TabsTrigger>
        </TabsList>

        {/* History Tab */}
        <TabsContent value="history">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Eventos Recentes</CardTitle>
                <CardDescription>{events.length} eventos nos últimos 6 meses</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  <div className="space-y-3">
                    {events.map(evt => (
                      <div key={evt.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                        <div className="shrink-0">
                          <Badge variant="outline" className={`text-xs ${SEVERITY_COLORS[evt.severity]}`}>
                            {evt.severity}
                          </Badge>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{EVENT_LABELS[evt.event_type]}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(evt.event_timestamp).toLocaleDateString('pt-BR')} às {new Date(evt.event_timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {evt.details.speed && (
                          <span className="text-xs text-muted-foreground">{String(evt.details.speed)} km/h</span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Perfil de Infrações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" className="text-xs" />
                      <PolarRadiusAxis angle={30} domain={[0, 10]} />
                      <Radar name="Ocorrências" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Warnings Tab */}
        <TabsContent value="warnings">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Histórico de Advertências</CardTitle>
              <CardDescription>{warnings.length} advertência(s) registrada(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {warnings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
                  <p className="text-muted-foreground">Nenhuma advertência registrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {warnings.map(w => (
                    <div key={w.id} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                      <div className="shrink-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          w.warning_type === 'suspension' ? 'bg-red-500/10 text-red-600' :
                          w.warning_type === 'written' ? 'bg-amber-500/10 text-amber-600' :
                          'bg-blue-500/10 text-blue-600'
                        }`}>
                          <FileText className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{WARNING_LABELS[w.warning_type]}</p>
                          <Badge variant={w.signature_status === 'signed' ? 'default' : 'secondary'} className="text-xs">
                            {w.signature_status === 'signed' ? 'Assinada' : 'Pendente'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{w.description}</p>
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        <div>{new Date(w.issued_at).toLocaleDateString('pt-BR')}</div>
                        <div>por {w.issued_by}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Training Tab */}
        <TabsContent value="training">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Treinamentos</CardTitle>
              <CardDescription>{trainings.filter(t => t.completed).length}/{trainings.length} concluídos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {trainings.map(t => (
                  <div key={t.id} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                      t.completed ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {t.completed ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{t.name}</p>
                        {t.required && <Badge variant="outline" className="text-xs">Obrigatório</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.completed ? `Concluído em ${new Date(t.completedAt!).toLocaleDateString('pt-BR')}` : 'Pendente de conclusão'}
                        {' · '}Validade: {new Date(t.expiresAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <Badge variant={t.status === 'válido' ? 'default' : 'destructive'} className="text-xs">
                      {t.status === 'válido' ? 'Válido' : 'Pendente'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EPI Tab */}
        <TabsContent value="epi">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Equipamentos de Proteção Individual</CardTitle>
              <CardDescription>{epiItems.length} item(ns) registrado(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {epiItems.map(item => (
                  <div key={item.id} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                      item.status === 'válido' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                    }`}>
                      <HardHat className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{item.name}</p>
                        <span className="text-xs text-muted-foreground">{item.ca}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Entregue: {new Date(item.deliveredAt).toLocaleDateString('pt-BR')} · Validade: {new Date(item.expiresAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.signed ? (
                        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700">Assinado</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700">Pendente</Badge>
                      )}
                      <Badge variant={item.status === 'válido' ? 'default' : 'destructive'} className="text-xs">
                        {item.status === 'válido' ? 'Válido' : 'Vencido'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
