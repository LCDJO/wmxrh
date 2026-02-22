/**
 * LiveDisplayTV — Full-screen TV mode for corporate monitors.
 * Route: /tv?token=<display_token>
 * No authentication required — uses display token for data access.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  Users, AlertTriangle, Activity, Shield, Tv, WifiOff,
  Zap, TrendingUp, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DisplayData {
  display: { id: string; name: string; layout: string; refresh_interval_seconds: number };
  timestamp: string;
  workforce?: { total: number; active: number; inactive: number; by_department: Record<string, number> };
  fleet_events?: any[];
  compliance_incidents?: any[];
  critical_alerts?: any[];
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export default function LiveDisplayTV() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [data, setData] = useState<DisplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/live-display-data?token=${encodeURIComponent(token)}`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({ error: 'Falha na conexão' }));
        setError(errBody.error ?? 'Erro ao carregar dados');
        return;
      }

      const result = await resp.json();
      setData(result);
      setError(null);
      setLastUpdate(new Date());
    } catch (e) {
      console.error('[TV] Fetch error:', e);
      setError('Falha na conexão com o servidor');
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!data) return;
    const interval = (data.display.refresh_interval_seconds ?? 30) * 1000;
    intervalRef.current = setInterval(fetchData, interval);
    return () => clearInterval(intervalRef.current);
  }, [data, fetchData]);

  // Fullscreen on double click
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    };
    document.addEventListener('dblclick', handler);
    return () => document.removeEventListener('dblclick', handler);
  }, []);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <WifiOff className="h-16 w-16 mx-auto opacity-40" />
          <h1 className="text-2xl font-bold">Token não fornecido</h1>
          <p className="text-white/50">Escaneie o QR Code gerado no painel de administração.</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-16 w-16 mx-auto text-red-400" />
          <h1 className="text-2xl font-bold">Erro de Conexão</h1>
          <p className="text-white/50">{error}</p>
          <p className="text-xs text-white/30">Tentando reconectar automaticamente...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center text-white">
        <div className="text-center space-y-4 animate-pulse">
          <Tv className="h-16 w-16 mx-auto text-primary" />
          <h1 className="text-xl font-bold">Conectando display...</h1>
        </div>
      </div>
    );
  }

  const layout = data.display.layout;
  const workforce = data.workforce;
  const fleetEvents = data.fleet_events ?? [];
  const incidents = data.compliance_incidents ?? [];
  const alerts = data.critical_alerts ?? [];

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white p-4 lg:p-6 overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-4 lg:mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-primary/20 px-3 py-1.5 rounded-full">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-semibold text-primary">AO VIVO</span>
          </div>
          <h1 className="text-lg lg:text-xl font-bold text-white/90">{data.display.name}</h1>
        </div>
        <div className="flex items-center gap-4 text-xs text-white/40">
          {lastUpdate && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(lastUpdate, 'HH:mm:ss')}</span>}
          {error && <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Reconectando</span>}
        </div>
      </div>

      <div className={cn(
        "grid gap-4 lg:gap-6 h-[calc(100vh-5rem)]",
        layout === 'overview' && "grid-cols-1 lg:grid-cols-3 grid-rows-[auto_1fr_1fr]",
        layout === 'operations' && "grid-cols-1 lg:grid-cols-2 grid-rows-[auto_1fr]",
        layout === 'compliance' && "grid-cols-1 lg:grid-cols-2 grid-rows-[auto_1fr]",
      )}>
        {/* ── KPI Strip ── */}
        <div className={cn("col-span-full grid gap-4", layout === 'overview' ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-4")}>
          <KpiTile icon={Users} label="Colaboradores" value={workforce?.total ?? 0} sub={`${workforce?.active ?? 0} ativos`} color="text-sky-400" />
          <KpiTile icon={Activity} label="Eventos GPS" value={fleetEvents.length} sub="Últimos registros" color="text-emerald-400" />
          <KpiTile icon={Shield} label="Incidentes" value={incidents.length} sub="Compliance" color="text-amber-400" />
          <KpiTile icon={AlertTriangle} label="Alertas Críticos" value={alerts.length} sub="Atenção imediata" color={alerts.length > 0 ? "text-red-400" : "text-emerald-400"} />
        </div>

        {/* ── Alerts Banner ── */}
        {alerts.length > 0 && (
          <div className="col-span-full">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 overflow-x-auto">
              <AlertTriangle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
              <div className="flex gap-4 min-w-0">
                {alerts.slice(0, 5).map((alert: any, i: number) => (
                  <div key={alert.id ?? i} className="shrink-0 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20 min-w-[200px]">
                    <p className="text-sm font-semibold text-red-300">{alert.incident_type}</p>
                    <p className="text-xs text-red-300/70 truncate">{(alert.employees as any)?.name} — {alert.description?.slice(0, 60)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Workforce by Department ── */}
        {(layout === 'overview' || layout === 'operations') && workforce && (
          <TVCard title="Workforce por Departamento" icon={Users} className="lg:row-span-1">
            <div className="space-y-2 overflow-y-auto max-h-[300px]">
              {Object.entries(workforce.by_department).sort(([, a], [, b]) => b - a).map(([dept, count]) => (
                <div key={dept} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-sm text-white/80">{dept}</span>
                  <span className="text-sm font-bold text-white">{count}</span>
                </div>
              ))}
            </div>
          </TVCard>
        )}

        {/* ── Fleet Events Feed ── */}
        {(layout === 'overview' || layout === 'operations') && (
          <TVCard title="Eventos GPS Recentes" icon={Zap} className="lg:row-span-1">
            <div className="space-y-2 overflow-y-auto max-h-[300px]">
              {fleetEvents.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-8">Nenhum evento recente</p>
              ) : (
                fleetEvents.slice(0, 20).map((ev: any, i: number) => (
                  <div key={ev.id ?? i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge className={cn("text-[10px] shrink-0", SEVERITY_COLORS[ev.severity] ?? SEVERITY_COLORS.low)}>
                        {ev.severity}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm text-white/80 truncate">{ev.event_type}</p>
                        <p className="text-xs text-white/40 truncate">{(ev.employees as any)?.name}</p>
                      </div>
                    </div>
                    <span className="text-xs text-white/30 shrink-0">{ev.detected_at ? format(new Date(ev.detected_at), 'HH:mm') : '--'}</span>
                  </div>
                ))
              )}
            </div>
          </TVCard>
        )}

        {/* ── Compliance Incidents ── */}
        {(layout === 'overview' || layout === 'compliance') && (
          <TVCard title="Incidentes de Compliance" icon={Shield} className="lg:row-span-1">
            <div className="space-y-2 overflow-y-auto max-h-[300px]">
              {incidents.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-8">Nenhum incidente</p>
              ) : (
                incidents.slice(0, 20).map((inc: any, i: number) => (
                  <div key={inc.id ?? i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge className={cn("text-[10px] shrink-0", SEVERITY_COLORS[inc.severity] ?? SEVERITY_COLORS.low)}>
                        {inc.severity}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm text-white/80 truncate">{inc.incident_type}</p>
                        <p className="text-xs text-white/40 truncate">{(inc.employees as any)?.name}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0 text-white/50 border-white/20">{inc.status}</Badge>
                  </div>
                ))
              )}
            </div>
          </TVCard>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a0a12] to-transparent h-8 flex items-end justify-center pb-1">
        <p className="text-[10px] text-white/20">Clique duplo para tela cheia</p>
      </div>
    </div>
  );
}

// ── Sub-components ──

function KpiTile({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: number; sub: string; color: string }) {
  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 lg:p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/50 uppercase tracking-wider">{label}</span>
        <Icon className={cn("h-5 w-5", color)} />
      </div>
      <p className="text-2xl lg:text-3xl font-bold text-white">{value}</p>
      <p className="text-xs text-white/40 mt-1">{sub}</p>
    </div>
  );
}

function TVCard({ title, icon: Icon, children, className }: { title: string; icon: any; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 lg:p-5 overflow-hidden", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-white/50" />
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}
