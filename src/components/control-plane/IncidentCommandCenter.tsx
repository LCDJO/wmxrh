/**
 * IncidentCommandCenter — Enterprise Incident Management Control Plane tab.
 *
 * Widgets:
 *   1. ActiveIncidents   → live list of open/investigating/mitigated incidents
 *   2. SLA Breach Risk   → incidents approaching or past SLA deadlines
 *   3. Affected Tenants  → tenants impacted by active incidents
 */
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Flame, AlertTriangle, Clock, Users, Shield,
  Activity, Timer, Building2, CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ── Types ────────────────────────────────────────────

interface IncidentRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  affected_modules: string[];
  affected_tenants: string[];
  created_at: string;
  response_deadline: string | null;
  resolution_deadline: string | null;
  sla_breached: boolean;
  tenant_id: string | null;
}

interface TenantSummary {
  tenant_id: string;
  tenant_name: string;
  incident_count: number;
  worst_severity: string;
}

// ── Helpers ──────────────────────────────────────────

const SEV_ORDER: Record<string, number> = { sev1: 0, sev2: 1, sev3: 2, sev4: 3 };
const SEV_STYLE: Record<string, string> = {
  sev1: 'bg-destructive text-destructive-foreground',
  sev2: 'bg-orange-500 text-white',
  sev3: 'bg-amber-500 text-white',
  sev4: 'bg-muted text-muted-foreground',
};

function timeRemaining(deadline: string | null): { label: string; isBreached: boolean; urgency: 'ok' | 'warn' | 'breach' } {
  if (!deadline) return { label: '—', isBreached: false, urgency: 'ok' };
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { label: 'VIOLADO', isBreached: true, urgency: 'breach' };
  const mins = Math.round(diff / 60_000);
  if (mins < 30) return { label: `${mins}min`, isBreached: false, urgency: 'warn' };
  if (mins < 60) return { label: `${mins}min`, isBreached: false, urgency: 'ok' };
  return { label: `${Math.round(mins / 60)}h`, isBreached: false, urgency: 'ok' };
}

// ── Data Hook ────────────────────────────────────────

function useIncidentCommandData() {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await (supabase
        .from('incidents' as any)
        .select('id, title, severity, status, affected_modules, affected_tenants, created_at, response_deadline, resolution_deadline, sla_breached, tenant_id')
        .in('status', ['open', 'investigating', 'mitigated'])
        .order('created_at', { ascending: false })
        .limit(50) as any);

      setIncidents((data ?? []) as IncidentRow[]);
      setLoading(false);
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);

  return { incidents, loading };
}

// ── Widget 1: Active Incidents ───────────────────────

function ActiveIncidentsWidget({ incidents, loading }: { incidents: IncidentRow[]; loading: boolean }) {
  const sorted = useMemo(() =>
    [...incidents].sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)),
  [incidents]);

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Flame className="h-4 w-4 text-destructive" /> Incidentes Ativos
        </CardTitle>
        <Badge variant={incidents.length > 0 ? 'destructive' : 'secondary'} className="text-[10px]">
          {incidents.length}
        </Badge>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Activity className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
            <p className="text-sm text-muted-foreground">Nenhum incidente ativo</p>
          </div>
        ) : (
          <ScrollArea className="h-[320px]">
            <div className="space-y-2">
              {sorted.map(inc => (
                <div key={inc.id} className="rounded-md border border-border p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-foreground truncate flex-1">{inc.title}</span>
                    <Badge className={`text-[10px] shrink-0 ${SEV_STYLE[inc.severity] ?? SEV_STYLE.sev4}`}>
                      {inc.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="capitalize">{inc.status}</span>
                    <Separator orientation="vertical" className="h-3" />
                    <span>{new Date(inc.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {(inc.affected_modules?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {inc.affected_modules.map(m => (
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

// ── Widget 2: SLA Breach Risk ────────────────────────

function SLABreachRiskWidget({ incidents }: { incidents: IncidentRow[] }) {
  const atRisk = useMemo(() => {
    return incidents
      .map(inc => {
        const resp = timeRemaining(inc.response_deadline);
        const res = timeRemaining(inc.resolution_deadline);
        const worst = resp.urgency === 'breach' || res.urgency === 'breach'
          ? 'breach'
          : resp.urgency === 'warn' || res.urgency === 'warn'
          ? 'warn'
          : 'ok';
        return { ...inc, resp, res, worst };
      })
      .filter(i => i.worst !== 'ok' || i.sla_breached)
      .sort((a, b) => {
        const order: Record<string, number> = { breach: 0, warn: 1, ok: 2 };
        return (order[a.worst] ?? 2) - (order[b.worst] ?? 2);
      });
  }, [incidents]);

  const breached = atRisk.filter(i => i.worst === 'breach' || i.sla_breached).length;
  const warning = atRisk.filter(i => i.worst === 'warn').length;

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Timer className="h-4 w-4 text-amber-500" /> Risco de SLA
        </CardTitle>
        <div className="flex gap-1.5">
          {breached > 0 && <Badge variant="destructive" className="text-[10px]">{breached} violado(s)</Badge>}
          {warning > 0 && <Badge className="text-[10px] bg-amber-500 text-white">{warning} em risco</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {atRisk.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <Shield className="h-8 w-8 mx-auto text-emerald-500" />
            <p className="text-sm text-muted-foreground">Todos os SLAs dentro do prazo</p>
          </div>
        ) : (
          <ScrollArea className="h-[320px]">
            <div className="space-y-2">
              {atRisk.map(inc => (
                <div key={inc.id} className={`rounded-md border p-3 space-y-1.5 ${
                  inc.worst === 'breach' ? 'border-destructive/40 bg-destructive/5' : 'border-amber-500/40 bg-amber-500/5'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate flex-1">{inc.title}</span>
                    <Badge className={`text-[10px] shrink-0 ${SEV_STYLE[inc.severity] ?? SEV_STYLE.sev4}`}>
                      {inc.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Resposta:</span>
                      <span className={inc.resp.urgency === 'breach' ? 'text-destructive font-bold' : inc.resp.urgency === 'warn' ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}>
                        {inc.resp.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Resolução:</span>
                      <span className={inc.res.urgency === 'breach' ? 'text-destructive font-bold' : inc.res.urgency === 'warn' ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}>
                        {inc.res.label}
                      </span>
                    </div>
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

// ── Widget 3: Affected Tenants ───────────────────────

function AffectedTenantsWidget({ incidents }: { incidents: IncidentRow[] }) {
  const tenants = useMemo<TenantSummary[]>(() => {
    const map = new Map<string, TenantSummary>();

    for (const inc of incidents) {
      const ids = inc.affected_tenants?.length
        ? inc.affected_tenants
        : inc.tenant_id ? [inc.tenant_id] : [];

      for (const tid of ids) {
        const existing = map.get(tid);
        if (existing) {
          existing.incident_count++;
          if ((SEV_ORDER[inc.severity] ?? 9) < (SEV_ORDER[existing.worst_severity] ?? 9)) {
            existing.worst_severity = inc.severity;
          }
        } else {
          map.set(tid, {
            tenant_id: tid,
            tenant_name: tid.substring(0, 8),
            incident_count: 1,
            worst_severity: inc.severity,
          });
        }
      }
    }

    return [...map.values()].sort((a, b) =>
      (SEV_ORDER[a.worst_severity] ?? 9) - (SEV_ORDER[b.worst_severity] ?? 9)
    );
  }, [incidents]);

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Tenants Afetados
        </CardTitle>
        <Badge variant={tenants.length > 0 ? 'destructive' : 'secondary'} className="text-[10px]">
          {tenants.length}
        </Badge>
      </CardHeader>
      <CardContent>
        {tenants.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <Users className="h-8 w-8 mx-auto text-emerald-500" />
            <p className="text-sm text-muted-foreground">Nenhum tenant afetado</p>
          </div>
        ) : (
          <ScrollArea className="h-[320px]">
            <div className="space-y-2">
              {tenants.map(t => (
                <div key={t.tenant_id} className="rounded-md border border-border p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate font-mono">{t.tenant_id.substring(0, 12)}…</p>
                      <p className="text-xs text-muted-foreground">{t.incident_count} incidente(s)</p>
                    </div>
                  </div>
                  <Badge className={`text-[10px] shrink-0 ${SEV_STYLE[t.worst_severity] ?? SEV_STYLE.sev4}`}>
                    {t.worst_severity.toUpperCase()}
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

// ── Main Export ───────────────────────────────────────

export function IncidentCommandCenter() {
  const { incidents, loading } = useIncidentCommandData();

  return (
    <div className="space-y-4">
      <CardDescription>
        Painel centralizado de gerenciamento de incidentes — visão em tempo real de incidentes ativos, risco de SLA e impacto em tenants.
      </CardDescription>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ActiveIncidentsWidget incidents={incidents} loading={loading} />
        <SLABreachRiskWidget incidents={incidents} />
        <AffectedTenantsWidget incidents={incidents} />
      </div>
    </div>
  );
}
