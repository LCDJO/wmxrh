/**
 * PlatformWorkTime — Control Plane dashboard for WorkTime Compliance Engine.
 *
 * Real-time view of:
 *   - Clock events (live feed)
 *   - Flagged records
 *   - Blocked attempts
 *   - Geofence violations
 */
import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Clock, AlertTriangle, ShieldX, MapPin, RefreshCw, Activity,
  CheckCircle, XCircle, Flag, Eye,
} from 'lucide-react';

type LedgerEntry = {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string | null;
  employee_cpf_masked: string | null;
  event_type: string;
  recorded_at: string;
  server_timestamp: string;
  source: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  geofence_matched: boolean;
  device_fingerprint: string | null;
  integrity_hash: string;
  is_offline_sync: boolean;
};

type FraudLog = {
  id: string;
  tenant_id: string;
  employee_id: string;
  fraud_type: string;
  severity: string;
  confidence_score: number;
  evidence: Record<string, unknown>;
  auto_action: string | null;
  resolved: boolean;
  created_at: string;
};

const EVENT_LABELS: Record<string, string> = {
  clock_in: 'Entrada',
  clock_out: 'Saída',
  break_start: 'Início Intervalo',
  break_end: 'Fim Intervalo',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline'; icon: typeof CheckCircle }> = {
  valid: { label: 'Válido', variant: 'default', icon: CheckCircle },
  flagged: { label: 'Sinalizado', variant: 'secondary', icon: Flag },
  rejected: { label: 'Rejeitado', variant: 'destructive', icon: XCircle },
};

const SEVERITY_COLOR: Record<string, string> = {
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

export default function PlatformWorkTime() {
  const [liveEntries, setLiveEntries] = useState<LedgerEntry[]>([]);

  // ── Queries ──

  const { data: recentEntries = [], refetch: refetchEntries, isLoading: loadingEntries } = useQuery({
    queryKey: ['platform-worktime-recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worktime_ledger' as any)
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as LedgerEntry[];
    },
    refetchInterval: 15000,
  });

  const { data: flaggedEntries = [], isLoading: loadingFlagged } = useQuery({
    queryKey: ['platform-worktime-flagged'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worktime_ledger' as any)
        .select('*')
        .eq('status', 'flagged')
        .order('recorded_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as LedgerEntry[];
    },
    refetchInterval: 30000,
  });

  const { data: rejectedEntries = [], isLoading: loadingRejected } = useQuery({
    queryKey: ['platform-worktime-rejected'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worktime_ledger' as any)
        .select('*')
        .eq('status', 'rejected')
        .order('recorded_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as LedgerEntry[];
    },
    refetchInterval: 30000,
  });

  const { data: fraudLogs = [], isLoading: loadingFraud } = useQuery({
    queryKey: ['platform-worktime-fraud'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worktime_fraud_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as FraudLog[];
    },
    refetchInterval: 30000,
  });

  const { data: geofenceViolations = [], isLoading: loadingGeo } = useQuery({
    queryKey: ['platform-worktime-geofence'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worktime_fraud_logs' as any)
        .select('*')
        .eq('fraud_type', 'location_spoof')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as FraudLog[];
    },
    refetchInterval: 30000,
  });

  // ── Realtime subscription ──

  useEffect(() => {
    const channel = supabase
      .channel('worktime-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'worktime_ledger' },
        (payload) => {
          const entry = payload.new as unknown as LedgerEntry;
          setLiveEntries(prev => [entry, ...prev].slice(0, 50));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Merge live + fetched (deduplicated)
  const allRecent = (() => {
    const ids = new Set<string>();
    const merged: LedgerEntry[] = [];
    for (const e of [...liveEntries, ...recentEntries]) {
      if (!ids.has(e.id)) { ids.add(e.id); merged.push(e); }
    }
    return merged.slice(0, 100);
  })();

  // Stats
  const stats = {
    total: allRecent.length,
    valid: allRecent.filter(e => e.status === 'valid').length,
    flagged: flaggedEntries.length,
    rejected: rejectedEntries.length,
    geofence: geofenceViolations.length,
    fraudTotal: fraudLogs.length,
    fraudUnresolved: fraudLogs.filter(f => !f.resolved).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            WorkTime Control Plane
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitoramento em tempo real do motor de ponto eletrônico — Portaria 671/2021
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchEntries()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Activity} label="Registros Recentes" value={stats.total} color="text-primary" />
        <StatCard icon={Flag} label="Sinalizados" value={stats.flagged} color="text-yellow-600" />
        <StatCard icon={ShieldX} label="Bloqueados" value={stats.rejected} color="text-destructive" />
        <StatCard icon={MapPin} label="Geofence Violations" value={stats.geofence} color="text-orange-600" />
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="live" className="space-y-4">
        <TabsList>
          <TabsTrigger value="live" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Tempo Real
            {liveEntries.length > 0 && (
              <Badge variant="default" className="ml-1 text-[10px] px-1.5">{liveEntries.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="flagged" className="gap-1.5">
            <Flag className="h-3.5 w-3.5" /> Sinalizados
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{stats.flagged}</Badge>
          </TabsTrigger>
          <TabsTrigger value="blocked" className="gap-1.5">
            <ShieldX className="h-3.5 w-3.5" /> Bloqueados
            <Badge variant="destructive" className="ml-1 text-[10px] px-1.5">{stats.rejected}</Badge>
          </TabsTrigger>
          <TabsTrigger value="geofence" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Geofence
            <Badge variant="outline" className="ml-1 text-[10px] px-1.5">{stats.geofence}</Badge>
          </TabsTrigger>
          <TabsTrigger value="fraud" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Anti-Fraude
            <Badge variant="outline" className="ml-1 text-[10px] px-1.5">{stats.fraudUnresolved}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Live feed */}
        <TabsContent value="live">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Batidas em Tempo Real</CardTitle>
              <CardDescription>Feed ao vivo de registros de ponto (auto-refresh 15s + realtime)</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-1.5">
                  {allRecent.length === 0 && !loadingEntries && (
                    <p className="text-muted-foreground text-sm py-8 text-center">Nenhum registro encontrado.</p>
                  )}
                  {allRecent.map(entry => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Flagged */}
        <TabsContent value="flagged">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Registros Sinalizados</CardTitle>
              <CardDescription>Batidas marcadas como suspeitas pelo motor anti-fraude</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-1.5">
                  {flaggedEntries.length === 0 && !loadingFlagged && (
                    <p className="text-muted-foreground text-sm py-8 text-center">Nenhum registro sinalizado.</p>
                  )}
                  {flaggedEntries.map(entry => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Blocked */}
        <TabsContent value="blocked">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tentativas Bloqueadas</CardTitle>
              <CardDescription>Registros rejeitados por geofence, dispositivo ou fraude</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-1.5">
                  {rejectedEntries.length === 0 && !loadingRejected && (
                    <p className="text-muted-foreground text-sm py-8 text-center">Nenhum registro bloqueado.</p>
                  )}
                  {rejectedEntries.map(entry => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Geofence */}
        <TabsContent value="geofence">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Violações de Geofence</CardTitle>
              <CardDescription>Detecções de location spoof ou registro fora da área permitida</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-1.5">
                  {geofenceViolations.length === 0 && !loadingGeo && (
                    <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma violação de geofence.</p>
                  )}
                  {geofenceViolations.map(f => (
                    <FraudRow key={f.id} log={f} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Anti-fraud */}
        <TabsContent value="fraud">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Logs Anti-Fraude</CardTitle>
              <CardDescription>Todos os sinais de fraude detectados pelo AntiFraudAnalyzer</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-1.5">
                  {fraudLogs.length === 0 && !loadingFraud && (
                    <p className="text-muted-foreground text-sm py-8 text-center">Nenhum log de fraude.</p>
                  )}
                  {fraudLogs.map(f => (
                    <FraudRow key={f.id} log={f} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ──

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Activity; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 flex items-center gap-3">
        <div className={`rounded-lg p-2.5 bg-muted ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EntryRow({ entry }: { entry: LedgerEntry }) {
  const cfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.valid;
  const StatusIcon = cfg.icon;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors text-sm">
      <StatusIcon className={`h-4 w-4 shrink-0 ${entry.status === 'flagged' ? 'text-yellow-600' : entry.status === 'rejected' ? 'text-destructive' : 'text-green-600'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{entry.employee_name ?? entry.employee_id.slice(0, 8)}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {EVENT_LABELS[entry.event_type] ?? entry.event_type}
          </Badge>
          <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0">
            {cfg.label}
          </Badge>
          {entry.is_offline_sync && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">offline</Badge>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
          <span>{new Date(entry.recorded_at).toLocaleString('pt-BR')}</span>
          {entry.latitude && entry.longitude && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {entry.latitude.toFixed(4)}, {entry.longitude.toFixed(4)}
            </span>
          )}
          {!entry.geofence_matched && entry.latitude && (
            <Badge variant="destructive" className="text-[9px] px-1 py-0">fora da cerca</Badge>
          )}
          <span className="font-mono text-[10px] opacity-50">{entry.integrity_hash.slice(0, 12)}…</span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(entry.recorded_at)}</span>
    </div>
  );
}

function FraudRow({ log }: { log: FraudLog }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors text-sm">
      <AlertTriangle className={`h-4 w-4 shrink-0 ${log.severity === 'critical' ? 'text-red-600' : log.severity === 'high' ? 'text-orange-600' : 'text-yellow-600'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{log.fraud_type.replace(/_/g, ' ')}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SEVERITY_COLOR[log.severity] ?? ''}`}>
            {log.severity}
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {Math.round(log.confidence_score * 100)}% confiança
          </Badge>
          {log.auto_action && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {log.auto_action}
            </Badge>
          )}
          {log.resolved && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600">resolvido</Badge>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          Employee: {log.employee_id.slice(0, 8)}… · {new Date(log.created_at).toLocaleString('pt-BR')}
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(log.created_at)}</span>
    </div>
  );
}
