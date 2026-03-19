/**
 * Chaos Engineering — Platform Page
 * /platform/chaos-engineering
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getChaosEngine } from '@/domains/chaos-engineering/chaos-engine';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Zap, Plus, Play, Shield, AlertTriangle, CheckCircle2, XCircle, Ban,
  BarChart3, Target, Clock, Activity, Flame, ShieldAlert, TrendingUp,
} from 'lucide-react';
import type { ChaosExperiment, ChaosScenario } from '@/domains/chaos-engineering/types';

const faultTypeLabels: Record<string, string> = {
  service_latency: 'Latência de Serviço',
  latency_injection: 'Injeção de Latência',
  module_shutdown: 'Shutdown de Módulo',
  service_shutdown: 'Shutdown de Serviço',
  database_unavailable: 'Banco Indisponível',
  api_rate_spike: 'Spike de Taxa de API',
  network_partition: 'Partição de Rede',
  memory_exhaustion: 'Exaustão de Memória',
  memory_stress: 'Stress de Memória',
  cache_failure: 'Falha de Cache',
  cpu_stress: 'Stress de CPU',
  disk_stress: 'Stress de Disco',
  dns_failure: 'Falha de DNS',
  dependency_failure: 'Falha de Dependência',
  data_corruption: 'Corrupção de Dados',
  region_failure: 'Falha de Região',
  cascading_failure: 'Falha em Cascata',
};

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending:        { color: 'bg-muted text-muted-foreground', icon: <Clock className="h-3 w-3" />, label: 'Pendente' },
  approved:       { color: 'bg-blue-500/10 text-blue-400', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Aprovado' },
  running:        { color: 'bg-amber-500/10 text-amber-400', icon: <Play className="h-3 w-3" />, label: 'Em execução' },
  completed:      { color: 'bg-emerald-500/10 text-emerald-400', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Concluído' },
  failed:         { color: 'bg-red-500/10 text-red-400', icon: <XCircle className="h-3 w-3" />, label: 'Falhou' },
  aborted:        { color: 'bg-muted text-muted-foreground', icon: <Ban className="h-3 w-3" />, label: 'Abortado' },
  safety_stopped: { color: 'bg-red-500/10 text-red-400', icon: <ShieldAlert className="h-3 w-3" />, label: 'Safety Stop' },
};

export default function PlatformChaosEngineering() {
  const queryClient = useQueryClient();
  const engine = getChaosEngine();
  const [scenarioDialog, setScenarioDialog] = useState(false);
  const [runDialog, setRunDialog] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<ChaosScenario | null>(null);

  // Scenario form
  const [sName, setSName] = useState('');
  const [sFaultType, setSFaultType] = useState('latency_injection');
  const [sDesc, setSDesc] = useState('');
  const [sTarget, setSTarget] = useState('');
  const [sRegion, setSRegion] = useState('');
  const [sBlast, setSBlast] = useState('single_service');
  const [sMaxDuration, setSMaxDuration] = useState('30');

  const { data: experiments = [], isLoading: expLoading } = useQuery({
    queryKey: ['chaos-experiments'],
    queryFn: () => engine.getExperiments(50),
  });

  const { data: scenariosList = [] } = useQuery({
    queryKey: ['chaos-scenarios'],
    queryFn: () => engine.scenarios.list(),
  });

  const { data: stats } = useQuery({
    queryKey: ['chaos-stats'],
    queryFn: () => engine.getDashboardStats(),
  });

  const createScenarioMutation = useMutation({
    mutationFn: async () => {
      await engine.scenarios.create({
        name: sName,
        fault_type: sFaultType as any,
        description: sDesc || null,
        target_module: sTarget || null,
        target_region: sRegion || null,
        blast_radius: sBlast as any,
        max_duration_minutes: Number(sMaxDuration) || 30,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chaos-scenarios'] });
      toast.success('Cenário criado');
      setScenarioDialog(false);
      setSName(''); setSDesc(''); setSTarget(''); setSRegion('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const runMutation = useMutation({
    mutationFn: async (scenarioId: string) => {
      return await engine.runExperiment(scenarioId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['chaos-experiments', 'chaos-stats'] });
      const score = result.resilience_score ?? 0;
      if (score >= 7) toast.success(`Experimento concluído — Resilience: ${score}/10 ✅`);
      else toast.warning(`Experimento concluído — Resilience: ${score}/10 ⚠️`);
      setRunDialog(false);
      setSelectedScenario(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const abortMutation = useMutation({
    mutationFn: async (id: string) => engine.abortExperiment(id, 'Aborted by operator'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chaos-experiments', 'chaos-stats'] });
      toast.success('Experimento abortado');
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Flame className="h-6 w-6 text-destructive" />
            Chaos Engineering Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Simulação controlada de falhas para validar resiliência, failover, SLA e RTO/RPO
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Experimentos', value: stats?.total_experiments ?? 0, icon: <Zap className="h-5 w-5 text-primary" /> },
          { label: 'Resilience Avg', value: `${stats?.avg_resilience_score ?? 0}/10`, icon: <Shield className="h-5 w-5 text-emerald-400" /> },
          { label: 'Impact Avg', value: `${stats?.avg_impact_score ?? 0}/10`, icon: <Target className="h-5 w-5 text-amber-400" /> },
          { label: 'SLA Compliance', value: `${stats?.sla_compliance_pct ?? 100}%`, icon: <TrendingUp className="h-5 w-5 text-blue-400" /> },
          { label: 'RTO Compliance', value: `${stats?.rto_compliance_pct ?? 100}%`, icon: <Activity className="h-5 w-5 text-purple-400" /> },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">{s.icon}</div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="experiments">
        <TabsList>
          <TabsTrigger value="experiments">Experimentos</TabsTrigger>
          <TabsTrigger value="scenarios">Cenários</TabsTrigger>
        </TabsList>

        {/* Experiments tab */}
        <TabsContent value="experiments" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={runDialog} onOpenChange={setRunDialog}>
              <DialogTrigger asChild>
                <Button><Play className="h-4 w-4 mr-2" />Executar Experimento</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Executar Experimento de Caos</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <p className="text-sm text-muted-foreground">Selecione um cenário para executar. O Safety Guard validará as condições antes da execução.</p>
                  {scenariosList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum cenário disponível. Crie um primeiro.</p>
                  ) : (
                    <div className="space-y-2">
                      {scenariosList.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedScenario(s)}>
                          <div>
                            <p className="font-medium text-foreground">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{faultTypeLabels[s.fault_type]} · {s.blast_radius} · {s.max_duration_minutes}min max</p>
                          </div>
                          {selectedScenario?.id === s.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    className="w-full"
                    variant="destructive"
                    disabled={!selectedScenario || runMutation.isPending}
                    onClick={() => selectedScenario && runMutation.mutate(selectedScenario.id)}
                  >
                    {runMutation.isPending ? '🔥 Executando...' : '🔥 Injetar Falha & Executar'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {expLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : experiments.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum experimento executado. Crie um cenário e execute.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {experiments.map(exp => {
                const cfg = statusConfig[exp.status] ?? statusConfig.pending;
                return (
                  <Card key={exp.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground">{exp.name}</span>
                            <Badge variant="outline" className={cfg.color}>
                              <span className="flex items-center gap-1">{cfg.icon}{cfg.label}</span>
                            </Badge>
                            <Badge variant="outline">{faultTypeLabels[exp.fault_type] ?? exp.fault_type}</Badge>
                            <Badge variant="outline">{exp.blast_radius}</Badge>
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                            {exp.resilience_score != null && <span>Resilience: {exp.resilience_score}/10</span>}
                            {exp.impact_score != null && <span>Impact: {exp.impact_score}/10</span>}
                            {exp.sla_met != null && (
                              <span className="flex items-center gap-1">
                                SLA: {exp.sla_actual_pct}%
                                {exp.sla_met ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <XCircle className="h-3 w-3 text-red-400" />}
                              </span>
                            )}
                            {exp.rto_met != null && (
                              <span className="flex items-center gap-1">
                                RTO: {exp.rto_actual_minutes}min
                                {exp.rto_met ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <XCircle className="h-3 w-3 text-red-400" />}
                              </span>
                            )}
                            {exp.self_healing_triggered && <Badge variant="outline" className="text-emerald-400">Self-Healing ✓</Badge>}
                            {exp.escalation_triggered && <Badge variant="outline" className="text-amber-400">Escalation ↑</Badge>}
                            {exp.incident_id && <Badge variant="outline" className="text-red-400">Incident #{exp.incident_id.slice(0, 8)}</Badge>}
                          </div>
                          {exp.findings && (exp.findings as any[]).length > 0 && (
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {(exp.findings as any[]).slice(0, 3).map((f, i) => (
                                <Badge key={i} variant="outline" className={
                                  f.severity === 'critical' ? 'text-red-400 border-red-500/30' :
                                  f.severity === 'warning' ? 'text-amber-400 border-amber-500/30' :
                                  'text-muted-foreground'
                                }>
                                  <AlertTriangle className="h-3 w-3 mr-1" />{f.finding}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        {exp.status === 'running' && (
                          <Button size="sm" variant="destructive" onClick={() => abortMutation.mutate(exp.id)}>
                            <Ban className="h-3 w-3 mr-1" />Abortar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Scenarios tab */}
        <TabsContent value="scenarios" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={scenarioDialog} onOpenChange={setScenarioDialog}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Criar Cenário</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Cenário de Caos</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <Input placeholder="Nome do cenário" value={sName} onChange={e => setSName(e.target.value)} />
                  <Select value={sFaultType} onValueChange={setSFaultType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(faultTypeLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea placeholder="Descrição do cenário" value={sDesc} onChange={e => setSDesc(e.target.value)} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Módulo alvo" value={sTarget} onChange={e => setSTarget(e.target.value)} />
                    <Input placeholder="Região alvo" value={sRegion} onChange={e => setSRegion(e.target.value)} />
                  </div>
                  <Select value={sBlast} onValueChange={setSBlast}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_service">Single Service</SelectItem>
                      <SelectItem value="service_group">Service Group</SelectItem>
                      <SelectItem value="availability_zone">Availability Zone</SelectItem>
                      <SelectItem value="region">Region</SelectItem>
                      <SelectItem value="global">Global</SelectItem>
                    </SelectContent>
                  </Select>
                  <div>
                    <label className="text-xs text-muted-foreground">Duração máxima (min)</label>
                    <Input type="number" value={sMaxDuration} onChange={e => setSMaxDuration(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={() => createScenarioMutation.mutate()} disabled={!sName || createScenarioMutation.isPending}>
                    {createScenarioMutation.isPending ? 'Criando...' : 'Criar Cenário'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {scenariosList.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum cenário. Crie o primeiro acima.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {scenariosList.map(s => (
                <Card key={s.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{s.name}</span>
                      <Badge variant="outline">{faultTypeLabels[s.fault_type] ?? s.fault_type}</Badge>
                    </div>
                    {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {s.target_module && <span>Módulo: {s.target_module}</span>}
                      {s.target_region && <span>Região: {s.target_region}</span>}
                      <span>Blast: {s.blast_radius}</span>
                      <span>Max: {s.max_duration_minutes}min</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" onClick={() => { setSelectedScenario(s); setRunDialog(true); }}>
                        <Play className="h-3 w-3 mr-1" />Executar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
