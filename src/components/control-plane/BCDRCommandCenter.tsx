/**
 * BCDRCommandCenter — Control Plane widget for Business Continuity & Disaster Recovery.
 *
 * Widgets:
 *   1. Region Health        → live status of all regions
 *   2. Recovery Readiness   → RTO/RPO compliance & policy coverage
 *   3. Failover History     → recent failovers with RTO/RPO results
 *   4. DR Test Results      → recent test outcomes
 */
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Globe, Server, Shield, Activity, CheckCircle2, XCircle,
  Database, Clock, AlertTriangle, FlaskConical, ArrowRightLeft,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ── Types ────────────────────────────────────────────

interface RegionRow {
  id: string;
  region_name: string;
  status: string;
  latency_ms: number;
  cpu_usage_pct: number;
  memory_usage_pct: number;
  is_primary: boolean;
  last_health_check_at: string;
}

interface FailoverRow {
  id: string;
  trigger_type: string;
  trigger_reason: string | null;
  source_region: string;
  target_region: string;
  status: string;
  started_at: string;
  rto_actual_minutes: number | null;
  rpo_actual_minutes: number | null;
  rto_met: boolean | null;
  rpo_met: boolean | null;
}

interface DRTestRow {
  id: string;
  test_name: string;
  test_type: string;
  status: string;
  completed_at: string | null;
  rto_met: boolean | null;
  rpo_met: boolean | null;
  modules_tested: string[];
}

interface PolicyRow {
  id: string;
  module_name: string;
  rto_minutes: number;
  rpo_minutes: number;
  priority: string;
  failover_mode: string;
}

// ── Helpers ──────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  healthy: 'bg-emerald-500 text-white',
  degraded: 'bg-amber-500 text-white',
  unhealthy: 'bg-destructive text-destructive-foreground',
  offline: 'bg-muted text-muted-foreground',
  completed: 'bg-emerald-500 text-white',
  failed: 'bg-destructive text-destructive-foreground',
  initiated: 'bg-primary text-primary-foreground',
  in_progress: 'bg-amber-500 text-white',
  rolled_back: 'bg-muted text-muted-foreground',
  passed: 'bg-emerald-500 text-white',
  scheduled: 'bg-primary/60 text-white',
  running: 'bg-amber-500 text-white',
  cancelled: 'bg-muted text-muted-foreground',
};

// ── Data Hook ────────────────────────────────────────

function useBCDRData() {
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [failovers, setFailovers] = useState<FailoverRow[]>([]);
  const [tests, setTests] = useState<DRTestRow[]>([]);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [regRes, foRes, testRes, polRes] = await Promise.all([
        (supabase as any).from('bcdr_region_health').select('*').order('region_name'),
        (supabase as any).from('bcdr_failover_records').select('*').order('started_at', { ascending: false }).limit(10),
        (supabase as any).from('bcdr_dr_tests').select('*').order('created_at', { ascending: false }).limit(10),
        (supabase as any).from('bcdr_recovery_policies').select('*').eq('is_active', true).order('priority'),
      ]);
      setRegions((regRes.data ?? []) as RegionRow[]);
      setFailovers((foRes.data ?? []) as FailoverRow[]);
      setTests((testRes.data ?? []) as DRTestRow[]);
      setPolicies((polRes.data ?? []) as PolicyRow[]);
      setLoading(false);
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);

  return { regions, failovers, tests, policies, loading };
}

// ── Widget 1: Region Health ──────────────────────────

function RegionHealthWidget({ regions, loading }: { regions: RegionRow[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" /> Saúde das Regiões
        </CardTitle>
        <Badge variant="secondary" className="text-[10px]">{regions.length} regiões</Badge>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Activity className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : regions.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">Nenhuma região configurada</p>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-2">
              {regions.map(r => (
                <div key={r.id} className="rounded-md border border-border p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {r.region_name} {r.is_primary && <span className="text-[10px] text-primary ml-1">(Primary)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.latency_ms}ms · CPU {r.cpu_usage_pct}% · MEM {r.memory_usage_pct}%
                      </p>
                    </div>
                  </div>
                  <Badge className={`text-[10px] shrink-0 ${STATUS_COLOR[r.status] ?? STATUS_COLOR.offline}`}>
                    {r.status.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ── Widget 2: Recovery Readiness ─────────────────────

function RecoveryReadinessWidget({ policies }: { policies: PolicyRow[] }) {
  const PRIORITY_COLOR: Record<string, string> = {
    critical: 'bg-destructive text-destructive-foreground',
    high: 'bg-orange-500 text-white',
    medium: 'bg-amber-500 text-white',
    low: 'bg-muted text-muted-foreground',
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-500" /> Políticas de Recuperação
        </CardTitle>
        <Badge variant="secondary" className="text-[10px]">{policies.length} ativas</Badge>
      </CardHeader>
      <CardContent>
        {policies.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">Nenhuma política ativa</p>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-2">
              {policies.map(p => (
                <div key={p.id} className="rounded-md border border-border p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate flex-1">{p.module_name}</span>
                    <Badge className={`text-[10px] shrink-0 ${PRIORITY_COLOR[p.priority] ?? PRIORITY_COLOR.low}`}>
                      {p.priority.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> RTO: {p.rto_minutes}m</span>
                    <Separator orientation="vertical" className="h-3" />
                    <span className="flex items-center gap-1"><Database className="h-3 w-3" /> RPO: {p.rpo_minutes}m</span>
                    <Separator orientation="vertical" className="h-3" />
                    <span className="capitalize">{p.failover_mode}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ── Widget 3: Failover History ───────────────────────

function FailoverHistoryWidget({ failovers }: { failovers: FailoverRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-amber-500" /> Histórico de Failover
        </CardTitle>
        <Badge variant="secondary" className="text-[10px]">{failovers.length}</Badge>
      </CardHeader>
      <CardContent>
        {failovers.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
            <p className="text-sm text-muted-foreground">Nenhum failover registrado</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-2">
              {failovers.map(f => (
                <div key={f.id} className="rounded-md border border-border p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {f.source_region} → {f.target_region}
                    </span>
                    <Badge className={`text-[10px] shrink-0 ${STATUS_COLOR[f.status] ?? STATUS_COLOR.failed}`}>
                      {f.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{f.trigger_reason ?? f.trigger_type}</p>
                  {f.rto_actual_minutes != null && (
                    <div className="flex gap-3 text-xs">
                      <span className={f.rto_met ? 'text-emerald-600' : 'text-destructive'}>
                        RTO: {f.rto_actual_minutes}m {f.rto_met ? '✓' : '✗'}
                      </span>
                      <span className={f.rpo_met ? 'text-emerald-600' : 'text-destructive'}>
                        RPO: {f.rpo_actual_minutes}m {f.rpo_met ? '✓' : '✗'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ── Widget 4: DR Test Results ────────────────────────

function DRTestResultsWidget({ tests }: { tests: DRTestRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" /> Testes de DR
        </CardTitle>
        <Badge variant="secondary" className="text-[10px]">{tests.length}</Badge>
      </CardHeader>
      <CardContent>
        {tests.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">Nenhum teste registrado</p>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-2">
              {tests.map(t => (
                <div key={t.id} className="rounded-md border border-border p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate flex-1">{t.test_name}</span>
                    <Badge className={`text-[10px] shrink-0 ${STATUS_COLOR[t.status] ?? STATUS_COLOR.cancelled}`}>
                      {t.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{t.test_type.replace('_', ' ')}</span>
                    {t.completed_at && (
                      <>
                        <Separator orientation="vertical" className="h-3" />
                        <span>{new Date(t.completed_at).toLocaleDateString('pt-BR')}</span>
                      </>
                    )}
                  </div>
                  {(t.modules_tested?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {t.modules_tested.map(m => (
                        <Badge key={m} variant="outline" className="text-[9px] h-4">{m}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Export ───────────────────────────────────────

export function BCDRCommandCenter() {
  const { regions, failovers, tests, policies, loading } = useBCDRData();

  return (
    <div className="space-y-4">
      <CardDescription>
        Painel centralizado de Business Continuity & Disaster Recovery — saúde das regiões, políticas de recuperação, failovers e testes de DR.
      </CardDescription>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RegionHealthWidget regions={regions} loading={loading} />
        <RecoveryReadinessWidget policies={policies} />
        <FailoverHistoryWidget failovers={failovers} />
        <DRTestResultsWidget tests={tests} />
      </div>
    </div>
  );
}
