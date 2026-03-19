/**
 * PlatformBehaviorAI — Control Plane for the Behavioral AI Fraud Engine.
 *
 * Panels:
 *  1. Risk score médio por colaborador
 *  2. Anomalias recentes
 *  3. Clusters suspeitos
 *  4. Taxa de fraude detectada
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Brain, ShieldAlert, Activity, Users, AlertTriangle, TrendingUp,
  RefreshCw, Eye, Fingerprint, Cpu, Network, BarChart3,
} from 'lucide-react';

// ── Mock data (in production, wired to BehavioralAIEngine singleton) ──

const mockEmployeeRisks = [
  { employee_id: 'emp-001', name: 'Carlos Silva', risk_score: 82, risk_level: 'critical' as const, anomaly_count: 7, last_anomaly: '2026-03-02T08:12:00Z' },
  { employee_id: 'emp-002', name: 'Ana Souza', risk_score: 61, risk_level: 'high' as const, anomaly_count: 4, last_anomaly: '2026-03-01T14:30:00Z' },
  { employee_id: 'emp-003', name: 'João Pereira', risk_score: 38, risk_level: 'medium' as const, anomaly_count: 2, last_anomaly: '2026-02-28T09:15:00Z' },
  { employee_id: 'emp-004', name: 'Maria Oliveira', risk_score: 12, risk_level: 'low' as const, anomaly_count: 0, last_anomaly: '' },
  { employee_id: 'emp-005', name: 'Pedro Santos', risk_score: 74, risk_level: 'high' as const, anomaly_count: 5, last_anomaly: '2026-03-02T07:45:00Z' },
  { employee_id: 'emp-006', name: 'Lucia Fernandes', risk_score: 91, risk_level: 'critical' as const, anomaly_count: 9, last_anomaly: '2026-03-02T10:02:00Z' },
];

const mockRecentAnomalies = [
  { id: 'a1', employee: 'Lucia Fernandes', type: 'bot_behavior_detected', severity: 'critical' as const, score: 5.2, description: 'Variância impossibilitante baixa — automação suspeita', detected_at: '2026-03-02T10:02:00Z' },
  { id: 'a2', employee: 'Carlos Silva', type: 'pattern_replay_detected', severity: 'critical' as const, score: 6.0, description: 'Vetor quase idêntico a sessão anterior', detected_at: '2026-03-02T08:12:00Z' },
  { id: 'a3', employee: 'Pedro Santos', type: 'timing_anomaly', severity: 'high' as const, score: 3.8, description: 'Duração de toque fora do padrão (z=3.80)', detected_at: '2026-03-02T07:45:00Z' },
  { id: 'a4', employee: 'Ana Souza', type: 'pressure_anomaly', severity: 'medium' as const, score: 2.4, description: 'Pressão de toque fora do padrão (z=2.40)', detected_at: '2026-03-01T14:30:00Z' },
  { id: 'a5', employee: 'Carlos Silva', type: 'motion_anomaly', severity: 'high' as const, score: 3.2, description: 'Inclinação do dispositivo atípica (z=3.20)', detected_at: '2026-03-01T12:00:00Z' },
  { id: 'a6', employee: 'Lucia Fernandes', type: 'navigation_anomaly', severity: 'medium' as const, score: 2.8, description: 'Padrão de hesitação incomum (z=2.80)', detected_at: '2026-03-01T09:30:00Z' },
];

const mockClusters = [
  { id: 'cl-1', type: 'device' as const, employees: ['Carlos Silva', 'Pedro Santos'], sessions: 8, severity: 'high' as const, confidence: 0.94, anomaly_types: ['timing_anomaly', 'pressure_anomaly'], description: 'Mesmo dispositivo detectado com perfis comportamentais distintos', detected_at: '2026-03-01T06:00:00Z' },
  { id: 'cl-2', type: 'temporal' as const, employees: ['Lucia Fernandes', 'Ana Souza'], sessions: 5, severity: 'critical' as const, confidence: 0.88, anomaly_types: ['bot_behavior_detected', 'pattern_replay_detected'], description: 'Registros automatizados em janela temporal concentrada', detected_at: '2026-03-02T07:00:00Z' },
  { id: 'cl-3', type: 'behavioral' as const, employees: ['João Pereira'], sessions: 3, severity: 'medium' as const, confidence: 0.72, anomaly_types: ['navigation_anomaly'], description: 'Padrão de navegação anômalo recorrente', detected_at: '2026-02-28T08:00:00Z' },
];

const mockFraudStats = {
  total_sessions: 1240,
  flagged_sessions: 47,
  confirmed_fraud: 12,
  false_positives: 8,
  pending_review: 27,
  detection_rate: 3.8,
  precision: 0.60,
  recall: 0.92,
  f1_score: 0.74,
};

// ── Helpers ──

const severityColor = (s: string) => {
  switch (s) {
    case 'critical': return 'destructive';
    case 'high': return 'destructive';
    case 'medium': return 'secondary';
    default: return 'outline';
  }
};

const riskColor = (level: string) => {
  switch (level) {
    case 'critical': return 'text-red-500';
    case 'high': return 'text-orange-500';
    case 'medium': return 'text-yellow-500';
    default: return 'text-green-500';
  }
};

const clusterIcon = (type: string) => {
  switch (type) {
    case 'device': return Fingerprint;
    case 'temporal': return Activity;
    case 'behavioral': return Brain;
    case 'spatial': return Network;
    default: return Cpu;
  }
};

const formatDate = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export default function PlatformBehaviorAI() {
  const [refreshKey, setRefreshKey] = useState(0);

  const avgRisk = useMemo(
    () => Math.round(mockEmployeeRisks.reduce((s, e) => s + e.risk_score, 0) / mockEmployeeRisks.length),
    [],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Behavioral AI — Fraud Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento de anomalias comportamentais, clusters suspeitos e taxa de fraude
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /> Risk Score Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${avgRisk >= 50 ? 'text-destructive' : 'text-primary'}`}>
              {avgRisk}
            </div>
            <Progress value={avgRisk} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Anomalias Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{mockRecentAnomalies.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {mockRecentAnomalies.filter(a => a.severity === 'critical').length} críticas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Network className="h-4 w-4" /> Clusters Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{mockClusters.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {mockClusters.filter(c => c.severity === 'critical').length} severidade crítica
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" /> Taxa de Fraude
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{mockFraudStats.detection_rate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {mockFraudStats.confirmed_fraud} confirmadas / {mockFraudStats.flagged_sessions} flagged
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees" className="gap-1.5">
            <Users className="h-4 w-4" /> Risk por Colaborador
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Anomalias
          </TabsTrigger>
          <TabsTrigger value="clusters" className="gap-1.5">
            <Network className="h-4 w-4" /> Clusters
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5">
            <TrendingUp className="h-4 w-4" /> Estatísticas
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Risk por Colaborador ── */}
        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle>Risk Score por Colaborador</CardTitle>
              <CardDescription>Score unificado: biométrico + liveness + device + geo + comportamental</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[420px]">
                <div className="space-y-3">
                  {mockEmployeeRisks
                    .sort((a, b) => b.risk_score - a.risk_score)
                    .map(emp => (
                      <div
                        key={emp.employee_id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`font-bold text-xl w-12 text-center ${riskColor(emp.risk_level)}`}>
                            {emp.risk_score}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">{emp.employee_id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={severityColor(emp.risk_level)}>
                            {emp.risk_level}
                          </Badge>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">{emp.anomaly_count} anomalias</p>
                            <p className="text-xs text-muted-foreground">{formatDate(emp.last_anomaly)}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Anomalias Recentes ── */}
        <TabsContent value="anomalies">
          <Card>
            <CardHeader>
              <CardTitle>Anomalias Recentes</CardTitle>
              <CardDescription>Desvios comportamentais detectados pelo motor de Z-score multi-camada</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[420px]">
                <div className="space-y-3">
                  {mockRecentAnomalies.map(a => (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <ShieldAlert className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                        a.severity === 'critical' ? 'text-red-500'
                          : a.severity === 'high' ? 'text-orange-500'
                            : 'text-yellow-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{a.employee}</span>
                          <Badge variant={severityColor(a.severity)} className="text-xs">
                            {a.severity}
                          </Badge>
                          <Badge variant="outline" className="text-xs font-mono">
                            {a.type.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{a.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Score: {a.score.toFixed(1)} · {formatDate(a.detected_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Clusters Suspeitos ── */}
        <TabsContent value="clusters">
          <Card>
            <CardHeader>
              <CardTitle>Clusters de Comportamento Anômalo</CardTitle>
              <CardDescription>Agrupamentos de anomalias correlacionadas por dispositivo, tempo ou padrão</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[420px]">
                <div className="space-y-4">
                  {mockClusters.map(cl => {
                    const Icon = clusterIcon(cl.type);
                    return (
                      <div
                        key={cl.id}
                        className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="h-5 w-5 text-primary" />
                            <span className="font-medium text-sm capitalize">{cl.type}</span>
                            <Badge variant={severityColor(cl.severity)}>{cl.severity}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Confiança: {(cl.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{cl.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {cl.employees.map(e => (
                            <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{cl.sessions} sessões</span>
                          <span>{cl.anomaly_types.length} tipos de anomalia</span>
                          <span>Detectado: {formatDate(cl.detected_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Estatísticas ── */}
        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detecção de Fraude</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total de sessões</span>
                  <span className="font-medium">{mockFraudStats.total_sessions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sessões flagged</span>
                  <span className="font-medium text-orange-500">{mockFraudStats.flagged_sessions}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fraudes confirmadas</span>
                  <span className="font-medium text-destructive">{mockFraudStats.confirmed_fraud}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Falsos positivos</span>
                  <span className="font-medium">{mockFraudStats.false_positives}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pendentes de revisão</span>
                  <span className="font-medium text-yellow-500">{mockFraudStats.pending_review}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance do Modelo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Precision</span>
                    <span className="font-medium">{(mockFraudStats.precision * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={mockFraudStats.precision * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Recall</span>
                    <span className="font-medium">{(mockFraudStats.recall * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={mockFraudStats.recall * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">F1 Score</span>
                    <span className="font-medium">{(mockFraudStats.f1_score * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={mockFraudStats.f1_score * 100} className="h-2" />
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Taxa de detecção</span>
                  <span className="font-bold text-primary">{mockFraudStats.detection_rate}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
