/**
 * Public Status Page — /status
 *
 * Shows: active incidents, incident history, uptime %, affected modules.
 * No auth required — publicly accessible.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2, AlertTriangle, Clock, Activity,
  Shield, Flame, ArrowUpCircle, Server,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface IncidentRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  affected_modules: string[];
  created_at: string;
  resolved_at: string | null;
}

interface AvailabilityRow {
  uptime_percentage: number;
  period_start: string;
}

const SEV_CONFIG: Record<string, { label: string; color: string }> = {
  sev1: { label: 'SEV1', color: 'bg-destructive text-destructive-foreground' },
  sev2: { label: 'SEV2', color: 'bg-orange-500 text-white' },
  sev3: { label: 'SEV3', color: 'bg-amber-500 text-white' },
  sev4: { label: 'SEV4', color: 'bg-muted text-muted-foreground' },
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  open:          { label: 'Aberto',       icon: Flame,         className: 'text-destructive' },
  investigating: { label: 'Investigando', icon: Activity,      className: 'text-amber-500' },
  mitigated:     { label: 'Mitigado',     icon: ArrowUpCircle, className: 'text-blue-500' },
  resolved:      { label: 'Resolvido',    icon: CheckCircle2,  className: 'text-emerald-500' },
};

export default function StatusPage() {
  const [activeIncidents, setActiveIncidents] = useState<IncidentRow[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<IncidentRow[]>([]);
  const [uptime30d, setUptime30d] = useState<number>(100);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [active, history, avail] = await Promise.all([
        supabase.from('incidents' as any).select('id, title, severity, status, affected_modules, created_at, resolved_at')
          .in('status', ['open', 'investigating', 'mitigated']).order('created_at', { ascending: false }).limit(20) as any,
        supabase.from('incidents' as any).select('id, title, severity, status, affected_modules, created_at, resolved_at')
          .eq('status', 'resolved').order('resolved_at', { ascending: false }).limit(20) as any,
        supabase.from('availability_records' as any).select('uptime_percentage, period_start')
          .gte('period_start', new Date(Date.now() - 30 * 86_400_000).toISOString()) as any,
      ]);

      setActiveIncidents((active.data ?? []) as IncidentRow[]);
      setRecentIncidents((history.data ?? []) as IncidentRow[]);

      const records = (avail.data ?? []) as AvailabilityRow[];
      if (records.length > 0) {
        setUptime30d(Math.round((records.reduce((s, r) => s + r.uptime_percentage, 0) / records.length) * 1000) / 1000);
      }
      setLoading(false);
    }
    load();
  }, []);

  const allAffectedModules = [...new Set(activeIncidents.flatMap(i => i.affected_modules ?? []))];
  const isHealthy = activeIncidents.length === 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Status da Plataforma</h1>
          </div>

          {/* Global status banner */}
          <div className={`rounded-lg p-4 flex items-center gap-3 ${
            isHealthy
              ? 'bg-emerald-500/10 border border-emerald-500/20'
              : 'bg-destructive/10 border border-destructive/20'
          }`}>
            {isHealthy ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            <span className={`font-semibold ${isHealthy ? 'text-emerald-600' : 'text-destructive'}`}>
              {isHealthy
                ? 'Todos os sistemas operacionais'
                : `${activeIncidents.length} incidente(s) ativo(s)`}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Uptime & affected modules row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4" /> Uptime (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-4xl font-bold font-mono ${uptime30d >= 99.9 ? 'text-emerald-500' : uptime30d >= 99 ? 'text-amber-500' : 'text-destructive'}`}>
                {uptime30d.toFixed(3)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Server className="h-4 w-4" /> Módulos Afetados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allAffectedModules.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum módulo afetado</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {allAffectedModules.map(m => (
                    <Badge key={m} variant="destructive" className="text-xs">{m}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Active incidents */}
        {activeIncidents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="h-4 w-4 text-destructive" />
                Incidentes Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeIncidents.map(incident => (
                  <IncidentCard key={incident.id} incident={incident} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Histórico de Incidentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentIncidents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum incidente registrado.</p>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3">
                  {recentIncidents.map(incident => (
                    <IncidentCard key={incident.id} incident={incident} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Atualizado em {new Date().toLocaleString('pt-BR')}
        </p>
      </main>
    </div>
  );
}

function IncidentCard({ incident }: { incident: IncidentRow }) {
  const sev = SEV_CONFIG[incident.severity] ?? SEV_CONFIG.sev4;
  const st = STATUS_CONFIG[incident.status] ?? STATUS_CONFIG.open;
  const StatusIcon = st.icon;

  return (
    <div className="rounded-lg border border-border p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon className={`h-4 w-4 shrink-0 ${st.className}`} />
          <span className="font-medium text-sm text-foreground truncate">{incident.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`text-[10px] ${sev.color}`}>{sev.label}</Badge>
          <Badge variant="outline" className="text-[10px]">{st.label}</Badge>
        </div>
      </div>

      {(incident.affected_modules?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1">
          {incident.affected_modules.map(m => (
            <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Detectado: {new Date(incident.created_at).toLocaleString('pt-BR')}</span>
        {incident.resolved_at && (
          <>
            <Separator orientation="vertical" className="h-3" />
            <span>Resolvido: {new Date(incident.resolved_at).toLocaleString('pt-BR')}</span>
          </>
        )}
      </div>
    </div>
  );
}
