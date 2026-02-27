/**
 * Chaos Engineering — Scenarios Page
 * Now rendered inside ChaosLayout at /platform/control-plane/chaos
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getChaosEngine } from '@/domains/chaos-engineering/chaos-engine';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus, Play, CheckCircle2, Shield, Zap, Target, TrendingUp, Activity,
} from 'lucide-react';
import type { ChaosScenario } from '@/domains/chaos-engineering/types';

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

export default function ChaosScenarios() {
  const queryClient = useQueryClient();
  const engine = getChaosEngine();
  const [scenarioDialog, setScenarioDialog] = useState(false);
  const [runDialog, setRunDialog] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<ChaosScenario | null>(null);

  const [sName, setSName] = useState('');
  const [sFaultType, setSFaultType] = useState('latency_injection');
  const [sDesc, setSDesc] = useState('');
  const [sTarget, setSTarget] = useState('');
  const [sRegion, setSRegion] = useState('');
  const [sBlast, setSBlast] = useState('single_service');
  const [sMaxDuration, setSMaxDuration] = useState('30');

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
    mutationFn: async (scenarioId: string) => engine.runExperiment(scenarioId),
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

  return (
    <div className="space-y-6">
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

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Dialog open={runDialog} onOpenChange={setRunDialog}>
          <DialogTrigger asChild>
            <Button variant="destructive"><Play className="h-4 w-4 mr-2" />Executar Experimento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Executar Experimento de Caos</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">Selecione um cenário. O Safety Guard validará antes da execução.</p>
              {scenariosList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum cenário disponível.</p>
              ) : (
                <div className="space-y-2">
                  {scenariosList.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedScenario(s)}>
                      <div>
                        <p className="font-medium text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{faultTypeLabels[s.fault_type]} · {s.blast_radius} · {s.max_duration_minutes}min</p>
                      </div>
                      {selectedScenario?.id === s.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                  ))}
                </div>
              )}
              <Button className="w-full" variant="destructive" disabled={!selectedScenario || runMutation.isPending} onClick={() => selectedScenario && runMutation.mutate(selectedScenario.id)}>
                {runMutation.isPending ? '🔥 Executando...' : '🔥 Injetar Falha & Executar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
              <Textarea placeholder="Descrição" value={sDesc} onChange={e => setSDesc(e.target.value)} />
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

      {/* Scenarios grid */}
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
                <Button size="sm" variant="outline" onClick={() => { setSelectedScenario(s); setRunDialog(true); }}>
                  <Play className="h-3 w-3 mr-1" />Executar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
