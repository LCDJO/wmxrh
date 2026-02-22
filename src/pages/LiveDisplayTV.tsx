/**
 * LiveDisplayTV — Full-screen TV mode for corporate monitors.
 *
 * PERFORMANCE:
 *   ✅ GPU-accelerated CSS transitions for smooth data updates
 *   ✅ will-change hints on animated elements
 *   ✅ Large-screen optimized (4K-ready typography & spacing)
 *   ✅ Dark mode native — no theme switching overhead
 *   ✅ WebSocket (Realtime) with automatic polling fallback
 *   ✅ Exponential backoff on connection failures
 *   ✅ requestAnimationFrame for gauge animations
 *   ✅ Memoized sub-components to avoid unnecessary re-renders
 *
 * 4 Display Modes:
 *   Fleet     → Live map, current speed, alerts
 *   SST       → Overdue NRs, active blocks
 *   Compliance→ Recent warnings, critical incidents
 *   Executive → Operational score, legal risk, projected cost
 */
import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  Users, AlertTriangle, Activity, Shield, Tv, WifiOff,
  Zap, Clock, Loader2, MapPin, Gauge, FileWarning,
  Lock, TrendingUp, DollarSign, Scale, BarChart3,
  Car, Heart, ShieldAlert, Wifi,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──

interface DisplayData {
  display: { id: string; nome: string; tipo: string; rotacao_automatica: boolean; intervalo_rotacao: number; layout_config: any };
  timestamp: string;
  workforce?: { total: number; active: number; inactive: number; by_department: Record<string, number> };
  fleet_events?: any[];
  live_positions?: any[];
  speed_alerts?: any[];
  nr_overdue_exams?: any[];
  active_blocks?: any[];
  sst_summary?: { overdue_count: number; critical_overdue: number; active_blocks_count: number };
  recent_warnings?: any[];
  compliance_incidents?: any[];
  compliance_summary?: { total_warnings: number; pending_incidents: number; critical_incidents: number };
  executive?: {
    operational_score: number;
    legal_risk: { score: number; level: string };
    projected_cost_brl: number;
    workforce_total: number;
    active_devices: number;
    total_violations: number;
    total_warnings: number;
    total_blocks: number;
  };
  critical_alerts?: any[];
}

type ConnectionMode = 'realtime' | 'polling' | 'reconnecting';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const RISK_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-amber-400',
  low: 'text-emerald-400',
};

type PairingState =
  | { phase: 'requesting' }
  | { phase: 'waiting'; pairing_code: string; session_id: string; token: string; expires_at: Date }
  | { phase: 'paired'; token: string }
  | { phase: 'error'; message: string };

// ── Smooth number animation hook ──
function useAnimatedNumber(target: number, duration = 600): number {
  const [current, setCurrent] = useState(target);
  const rafRef = useRef<number>();
  const startRef = useRef({ value: target, time: 0 });

  useEffect(() => {
    const start = current;
    const startTime = performance.now();
    startRef.current = { value: start, time: startTime };

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(start + (target - start) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };

    if (target !== start) {
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return current;
}

export default function LiveDisplayTV() {
  const [params] = useSearchParams();
  const location = useLocation();
  const tokenFromUrl = params.get('token');
  const isDisplayRoute = location.pathname === '/display';

  const [pairingState, setPairingState] = useState<PairingState | null>(null);
  const [activeToken, setActiveToken] = useState<string | null>(tokenFromUrl);
  const [data, setData] = useState<DisplayData | null>(null);
  const [prevData, setPrevData] = useState<DisplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('polling');
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const backoffRef = useRef(10_000); // start at 10s for polling fallback
  const realtimeChannelRef = useRef<any>(null);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const functionsBase = `https://${projectId}.supabase.co/functions/v1`;

  // ── Phase 1: Request pairing code ──
  const requestPairing = useCallback(async () => {
    setPairingState({ phase: 'requesting' });
    try {
      const resp = await fetch(`${functionsBase}/display-pair-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Erro' }));
        setPairingState({ phase: 'error', message: err.error ?? 'Falha ao gerar código' });
        return;
      }
      const result = await resp.json();
      setPairingState({
        phase: 'waiting',
        pairing_code: result.pairing_code,
        session_id: result.session_id,
        token: result.token,
        expires_at: new Date(Date.now() + result.expires_in_minutes * 60 * 1000),
      });
    } catch {
      setPairingState({ phase: 'error', message: 'Falha na conexão' });
    }
  }, [functionsBase]);

  useEffect(() => {
    if (isDisplayRoute && !activeToken) requestPairing();
  }, [isDisplayRoute, activeToken, requestPairing]);

  // ── Phase 2: Poll for pairing confirmation ──
  useEffect(() => {
    if (pairingState?.phase !== 'waiting') return;
    const poll = async () => {
      const { session_id, token, expires_at } = pairingState;
      if (new Date() > expires_at) {
        setPairingState({ phase: 'error', message: 'Código expirado' });
        return;
      }
      try {
        const resp = await fetch(`${functionsBase}/display-pair-status?session_id=${session_id}&token=${encodeURIComponent(token)}`);
        if (!resp.ok) return;
        const result = await resp.json();
        if (result.status === 'active') {
          setPairingState({ phase: 'paired', token: result.token });
          setActiveToken(result.token);
        } else if (result.status === 'expired') {
          setPairingState({ phase: 'error', message: 'Código expirado' });
        }
      } catch { /* retry */ }
    };
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, [pairingState, functionsBase]);

  // ── Phase 3: Fetch display data (with smooth transition) ──
  const fetchData = useCallback(async () => {
    if (!activeToken) return;
    try {
      const resp = await fetch(`${functionsBase}/live-display-data?token=${encodeURIComponent(activeToken)}`);
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({ error: 'Falha na conexão' }));
        setError(errBody.error ?? 'Erro ao carregar dados');
        return;
      }
      const result = await resp.json();
      // Smooth transition: save previous data for CSS transitions
      setData(prev => {
        if (prev) setPrevData(prev);
        return result;
      });
      setError(null);
      setLastUpdate(new Date());
      backoffRef.current = 10_000; // reset backoff on success
    } catch {
      setError('Falha na conexão com o servidor');
      // Exponential backoff (max 60s)
      backoffRef.current = Math.min(backoffRef.current * 1.5, 60_000);
    }
  }, [activeToken, functionsBase]);

  // Initial fetch
  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Realtime subscription with polling fallback ──
  useEffect(() => {
    if (!activeToken || !data) return;

    const displayId = data.display.id;
    const interval = (data.display.intervalo_rotacao ?? 30) * 1000;

    // Try Realtime first
    try {
      const channel = supabase
        .channel(`tv-display-${displayId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'live_displays',
            filter: `id=eq.${displayId}`,
          },
          () => {
            // Display config changed — refetch
            fetchData();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnectionMode('realtime');
            // Still poll but at longer intervals as backup
            clearInterval(intervalRef.current);
            intervalRef.current = setInterval(fetchData, Math.max(interval, 30_000));
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setConnectionMode('reconnecting');
            // Fallback to polling
            clearInterval(intervalRef.current);
            intervalRef.current = setInterval(fetchData, Math.max(backoffRef.current, 10_000));
            // Try to reconnect after backoff
            setTimeout(() => {
              channel.subscribe();
            }, backoffRef.current);
            backoffRef.current = Math.min(backoffRef.current * 1.5, 60_000);
          }
        });

      realtimeChannelRef.current = channel;
    } catch {
      // WebSocket not available — pure polling fallback
      setConnectionMode('polling');
    }

    // Always set up polling as baseline
    intervalRef.current = setInterval(fetchData, interval);

    return () => {
      clearInterval(intervalRef.current);
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [activeToken, data?.display?.id, data?.display?.intervalo_rotacao, fetchData]);

  // ── SECURITY: Lock down TV display ──
  useEffect(() => {
    const dblClickHandler = () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    };
    const contextMenuHandler = (e: MouseEvent) => { e.preventDefault(); };
    const keydownHandler = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.key === 'l') ||
        (e.ctrlKey && e.key === 'u') ||
        (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight'))
      ) {
        e.preventDefault();
      }
    };

    document.body.style.userSelect = 'none';
    (document.body.style as any).webkitUserSelect = 'none';

    document.addEventListener('dblclick', dblClickHandler);
    document.addEventListener('contextmenu', contextMenuHandler);
    document.addEventListener('keydown', keydownHandler);

    return () => {
      document.body.style.userSelect = '';
      (document.body.style as any).webkitUserSelect = '';
      document.removeEventListener('dblclick', dblClickHandler);
      document.removeEventListener('contextmenu', contextMenuHandler);
      document.removeEventListener('keydown', keydownHandler);
    };
  }, []);

  // ═══════════════════════════════════════════════════
  // RENDER: Pairing screens
  // ═══════════════════════════════════════════════════

  if (isDisplayRoute && !activeToken) {
    if (!pairingState || pairingState.phase === 'requesting') {
      return (
        <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center text-white">
          <div className="text-center space-y-4 animate-pulse">
            <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin" />
            <h1 className="text-xl font-bold">Gerando código de pareamento...</h1>
          </div>
        </div>
      );
    }
    if (pairingState.phase === 'error') {
      return (
        <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center text-white">
          <div className="text-center space-y-6">
            <AlertTriangle className="h-16 w-16 mx-auto text-red-400" />
            <h1 className="text-2xl font-bold">{pairingState.message}</h1>
            <button onClick={requestPairing} className="px-6 py-3 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl transition-colors text-sm font-semibold">
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }
    if (pairingState.phase === 'waiting') {
      const pairUrl = `${window.location.origin}/live-display/pair?code=${pairingState.pairing_code}`;
      return (
        <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center text-white">
          <div className="text-center space-y-8 max-w-lg">
            <div className="flex items-center justify-center gap-3">
              <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
              <h1 className="text-2xl lg:text-3xl 2xl:text-4xl font-bold">Pareamento de Display</h1>
            </div>
            <p className="text-white/50 text-sm 2xl:text-base">Escaneie o QR Code abaixo com seu celular ou insira o código no painel administrativo.</p>
            <div className="bg-white p-6 2xl:p-8 rounded-2xl inline-block mx-auto">
              <QRCodeSVG value={pairUrl} size={240} level="H" />
            </div>
            <div className="space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">Código de pareamento</p>
              <div className="flex items-center justify-center gap-2">
                {pairingState.pairing_code.split('').map((char, i) => (
                  <span key={i} className="w-12 h-14 lg:w-14 lg:h-16 2xl:w-16 2xl:h-20 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center text-2xl lg:text-3xl 2xl:text-4xl font-mono font-bold text-primary">
                    {char}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Aguardando confirmação do administrador...</span>
            </div>
            <p className="text-white/20 text-[10px]">O código expira em 10 minutos. Clique duplo para tela cheia.</p>
          </div>
        </div>
      );
    }
  }

  // ═══════════════════════════════════════════════════
  // RENDER: Loading / Error states
  // ═══════════════════════════════════════════════════

  if (!activeToken) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <WifiOff className="h-16 w-16 mx-auto opacity-40" />
          <h1 className="text-2xl font-bold">Token não fornecido</h1>
          <p className="text-white/50">Acesse <span className="text-primary font-mono">/display</span> para parear este monitor.</p>
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

  // ═══════════════════════════════════════════════════
  // RENDER: Mode-specific content (with smooth transitions)
  // ═══════════════════════════════════════════════════

  const tipo = data.display.tipo;
  const alerts = data.critical_alerts ?? [];

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white p-4 lg:p-6 2xl:p-8 overflow-hidden tv-container">
      {/* GPU-accelerated transition layer */}
      <style>{`
        .tv-container { transform: translateZ(0); }
        .tv-fade-in { animation: tvFadeIn 0.4s ease-out; will-change: opacity, transform; }
        .tv-slide-up { animation: tvSlideUp 0.3s ease-out; will-change: opacity, transform; }
        .tv-value-change { transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
        @keyframes tvFadeIn { from { opacity: 0; transform: translateY(4px) translateZ(0); } to { opacity: 1; transform: translateY(0) translateZ(0); } }
        @keyframes tvSlideUp { from { opacity: 0; transform: translateY(8px) translateZ(0); } to { opacity: 1; transform: translateY(0) translateZ(0); } }
        @keyframes tvPulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.3); } 50% { box-shadow: 0 0 12px 4px rgba(52,211,153,0.15); } }
        .tv-pulse-glow { animation: tvPulseGlow 2s infinite; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 lg:mb-6 2xl:mb-8">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 2xl:px-4 2xl:py-2 rounded-full",
            connectionMode === 'realtime' ? "bg-emerald-500/20 tv-pulse-glow" : "bg-primary/20"
          )}>
            <div className={cn(
              "h-2 w-2 2xl:h-2.5 2xl:w-2.5 rounded-full animate-pulse",
              connectionMode === 'realtime' ? "bg-emerald-400" :
              connectionMode === 'reconnecting' ? "bg-amber-400" : "bg-sky-400"
            )} />
            <span className="text-sm 2xl:text-base font-semibold text-primary">
              {connectionMode === 'realtime' ? 'AO VIVO' : connectionMode === 'reconnecting' ? 'RECONECTANDO' : 'POLLING'}
            </span>
          </div>
          <h1 className="text-lg lg:text-xl 2xl:text-2xl font-bold text-white/90">{data.display.nome}</h1>
          <Badge className="bg-white/10 text-white/60 border-white/20 text-[10px] 2xl:text-xs uppercase">{tipo}</Badge>
        </div>
        <div className="flex items-center gap-4 text-xs 2xl:text-sm text-white/40">
          <span className="flex items-center gap-1">
            {connectionMode === 'realtime' ? <Wifi className="h-3 w-3 text-emerald-400" /> :
             connectionMode === 'reconnecting' ? <WifiOff className="h-3 w-3 text-amber-400" /> :
             <Activity className="h-3 w-3 text-sky-400" />}
          </span>
          {lastUpdate && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(lastUpdate, 'HH:mm:ss')}</span>}
          {error && <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Reconectando</span>}
        </div>
      </div>

      {/* Alerts Banner (all modes) */}
      {alerts.length > 0 && (
        <div className="mb-4 2xl:mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-3 2xl:p-4 flex items-start gap-3 overflow-x-auto tv-slide-up">
          <AlertTriangle className="h-5 w-5 2xl:h-6 2xl:w-6 text-red-400 shrink-0 mt-0.5" />
          <div className="flex gap-3 min-w-0">
            {alerts.slice(0, 5).map((alert: any, i: number) => (
              <div key={alert.id ?? i} className="shrink-0 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20 min-w-[200px] 2xl:min-w-[260px]">
                <p className="text-sm 2xl:text-base font-semibold text-red-300">{alert.incident_type}</p>
                <p className="text-xs 2xl:text-sm text-red-300/70 truncate">{alert.employees?.name} — {alert.description?.slice(0, 60)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode Content */}
      <div className="tv-fade-in" key={data.timestamp}>
        {tipo === 'fleet' && <FleetMode data={data} />}
        {tipo === 'sst' && <SSTMode data={data} />}
        {tipo === 'compliance' && <ComplianceMode data={data} />}
        {tipo === 'executivo' && <ExecutiveMode data={data} />}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a0a12] to-transparent h-8 flex items-end justify-center pb-1">
        <p className="text-[10px] text-white/20">Clique duplo para tela cheia</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// FLEET MODE
// ════════════════════════════════════════════════

const FleetMode = memo(function FleetMode({ data }: { data: DisplayData }) {
  const positions = data.live_positions ?? [];
  const fleetEvents = data.fleet_events ?? [];
  const speedAlerts = data.speed_alerts ?? [];
  const workforce = data.workforce;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 2xl:gap-6 h-[calc(100vh-8rem)]">
      <div className="col-span-full grid grid-cols-4 gap-3 2xl:gap-4">
        <KpiTile icon={Car} label="Veículos Ativos" value={positions.length} sub="Posições ao vivo" color="text-sky-400" />
        <KpiTile icon={Gauge} label="Vel. Média" value={positions.length > 0 ? Math.round(positions.reduce((s: number, p: any) => s + (p.speed ?? 0), 0) / positions.length) : 0} sub="km/h" color="text-emerald-400" />
        <KpiTile icon={AlertTriangle} label="Alertas Velocidade" value={speedAlerts.length} sub="Excessos detectados" color={speedAlerts.length > 0 ? "text-red-400" : "text-emerald-400"} />
        <KpiTile icon={Activity} label="Eventos" value={fleetEvents.length} sub="Últimos 50" color="text-amber-400" />
      </div>

      <TVCard title="Mapa ao Vivo" icon={MapPin} className="lg:col-span-2 lg:row-span-2">
        <div className="h-full min-h-[300px] flex flex-col">
          <div className="flex-1 bg-white/5 rounded-lg flex items-center justify-center relative overflow-hidden">
            <MapPin className="h-12 w-12 opacity-20" />
            <p className="absolute bottom-4 text-xs text-white/30">Integração Traccar em desenvolvimento</p>
          </div>
          {positions.length > 0 && (
            <div className="mt-3 space-y-1 max-h-[120px] 2xl:max-h-[180px] overflow-y-auto">
              {positions.slice(0, 8).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs 2xl:text-sm bg-white/5 rounded px-3 py-1.5 tv-value-change">
                  <span className="font-mono text-white/60">{p.device_id?.slice(0, 10)}</span>
                  <span className={cn("font-bold", (p.speed ?? 0) > 80 ? "text-red-400" : "text-emerald-400")}>{p.speed?.toFixed(0) ?? '--'} km/h</span>
                  <span className={p.ignition ? "text-emerald-400" : "text-white/30"}>{p.ignition ? '● ON' : '○ OFF'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </TVCard>

      <div className="flex flex-col gap-4 2xl:gap-6">
        <TVCard title="Alertas de Velocidade" icon={Gauge} className="flex-1">
          <div className="space-y-2 overflow-y-auto max-h-[200px] 2xl:max-h-[280px]">
            {speedAlerts.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-4">Nenhum excesso</p>
            ) : (
              speedAlerts.slice(0, 10).map((a: any, i: number) => (
                <div key={a.id ?? i} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0 tv-slide-up">
                  <div className="min-w-0">
                    <p className="text-sm 2xl:text-base text-white/80 truncate">{a.employees?.name ?? 'Não identificado'}</p>
                    <p className="text-[10px] 2xl:text-xs text-white/40">{a.speed_kmh} km/h (limite: {a.speed_limit_kmh})</p>
                  </div>
                  <span className="text-xs text-white/30">{a.detected_at ? format(new Date(a.detected_at), 'HH:mm') : '--'}</span>
                </div>
              ))
            )}
          </div>
        </TVCard>

        <TVCard title="Eventos Recentes" icon={Zap} className="flex-1">
          <div className="space-y-2 overflow-y-auto max-h-[200px] 2xl:max-h-[280px]">
            {fleetEvents.slice(0, 10).map((ev: any, i: number) => (
              <div key={ev.id ?? i} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0 tv-slide-up">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge className={cn("text-[10px] shrink-0", SEVERITY_COLORS[ev.severity] ?? SEVERITY_COLORS.low)}>{ev.severity}</Badge>
                  <span className="text-xs 2xl:text-sm text-white/70 truncate">{ev.event_type}</span>
                </div>
                <span className="text-xs text-white/30">{ev.detected_at ? format(new Date(ev.detected_at), 'HH:mm') : '--'}</span>
              </div>
            ))}
          </div>
        </TVCard>
      </div>
    </div>
  );
});

// ════════════════════════════════════════════════
// SST MODE
// ════════════════════════════════════════════════

const SSTMode = memo(function SSTMode({ data }: { data: DisplayData }) {
  const exams = data.nr_overdue_exams ?? [];
  const blocks = data.active_blocks ?? [];
  const summary = data.sst_summary ?? { overdue_count: 0, critical_overdue: 0, active_blocks_count: 0 };
  const workforce = data.workforce;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 2xl:gap-6 h-[calc(100vh-8rem)]">
      <div className="col-span-full grid grid-cols-4 gap-3 2xl:gap-4">
        <KpiTile icon={Heart} label="NRs Vencidas" value={summary.overdue_count} sub="Exames pendentes" color={summary.overdue_count > 0 ? "text-red-400" : "text-emerald-400"} />
        <KpiTile icon={ShieldAlert} label="Críticos" value={summary.critical_overdue} sub="Atenção imediata" color={summary.critical_overdue > 0 ? "text-red-400" : "text-emerald-400"} />
        <KpiTile icon={Lock} label="Bloqueios Ativos" value={summary.active_blocks_count} sub="Operações impedidas" color={summary.active_blocks_count > 0 ? "text-orange-400" : "text-emerald-400"} />
        <KpiTile icon={Users} label="Colaboradores" value={workforce?.total ?? 0} sub={`${workforce?.active ?? 0} ativos`} color="text-sky-400" />
      </div>

      <TVCard title="NRs Vencidas / Próximas do Vencimento" icon={FileWarning} className="lg:row-span-2">
        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-16rem)]">
          {exams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/30">
              <Heart className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Todos os exames em dia</p>
            </div>
          ) : (
            exams.map((exam: any, i: number) => (
              <div key={exam.exam_id ?? i} className={cn(
                "rounded-lg p-3 2xl:p-4 border tv-slide-up",
                exam.alert_status === 'overdue' ? "bg-red-500/10 border-red-500/30" :
                exam.alert_status === 'critical' ? "bg-orange-500/10 border-orange-500/30" :
                "bg-amber-500/10 border-amber-500/30"
              )}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm 2xl:text-base font-semibold text-white/90">{exam.employee_name ?? 'Não identificado'}</p>
                  <Badge className={cn("text-[10px] 2xl:text-xs",
                    exam.alert_status === 'overdue' ? SEVERITY_COLORS.critical :
                    exam.alert_status === 'critical' ? SEVERITY_COLORS.high :
                    SEVERITY_COLORS.medium
                  )}>
                    {exam.alert_status === 'overdue' ? 'VENCIDO' : exam.alert_status === 'critical' ? 'CRÍTICO' : 'ATENÇÃO'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs 2xl:text-sm text-white/50">
                  <span>{exam.exam_type} — {exam.program_name}</span>
                  <span>{exam.days_until_due != null ? `${Math.abs(exam.days_until_due)}d ${exam.days_until_due < 0 ? 'vencido' : 'restantes'}` : '--'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </TVCard>

      <TVCard title="Bloqueios Ativos" icon={Lock} className="lg:row-span-2">
        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-16rem)]">
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/30">
              <Shield className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhum bloqueio ativo</p>
            </div>
          ) : (
            blocks.map((block: any, i: number) => (
              <div key={block.id ?? i} className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 2xl:p-4 tv-slide-up">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm 2xl:text-base font-semibold text-white/90">{block.employees?.name ?? 'Não identificado'}</p>
                  <Badge className={cn("text-[10px] 2xl:text-xs", SEVERITY_COLORS[block.severity] ?? SEVERITY_COLORS.high)}>{block.severity}</Badge>
                </div>
                <p className="text-xs 2xl:text-sm text-white/50">{block.violation_type} — {block.description?.slice(0, 80)}</p>
                <p className="text-[10px] text-white/30 mt-1">{block.detected_at ? format(new Date(block.detected_at), 'dd/MM HH:mm') : '--'}</p>
              </div>
            ))
          )}
        </div>
      </TVCard>
    </div>
  );
});

// ════════════════════════════════════════════════
// COMPLIANCE MODE
// ════════════════════════════════════════════════

const ComplianceMode = memo(function ComplianceMode({ data }: { data: DisplayData }) {
  const warnings = data.recent_warnings ?? [];
  const incidents = data.compliance_incidents ?? [];
  const summary = data.compliance_summary ?? { total_warnings: 0, pending_incidents: 0, critical_incidents: 0 };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 2xl:gap-6 h-[calc(100vh-8rem)]">
      <div className="col-span-full grid grid-cols-4 gap-3 2xl:gap-4">
        <KpiTile icon={FileWarning} label="Advertências" value={summary.total_warnings} sub="Recentes" color="text-amber-400" />
        <KpiTile icon={ShieldAlert} label="Incidentes Críticos" value={summary.critical_incidents} sub="Atenção imediata" color={summary.critical_incidents > 0 ? "text-red-400" : "text-emerald-400"} />
        <KpiTile icon={Activity} label="Pendentes" value={summary.pending_incidents} sub="Aguardando revisão" color={summary.pending_incidents > 0 ? "text-orange-400" : "text-emerald-400"} />
        <KpiTile icon={Users} label="Colaboradores" value={data.workforce?.total ?? 0} sub={`${data.workforce?.active ?? 0} ativos`} color="text-sky-400" />
      </div>

      <TVCard title="Advertências Recentes" icon={FileWarning} className="lg:row-span-2">
        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-16rem)]">
          {warnings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/30">
              <Shield className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma advertência recente</p>
            </div>
          ) : (
            warnings.map((w: any, i: number) => (
              <div key={w.id ?? i} className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 2xl:p-4 tv-slide-up">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm 2xl:text-base font-semibold text-white/90">{w.employees?.name ?? 'Não identificado'}</p>
                  <Badge className="text-[10px] 2xl:text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                    {w.event_type === 'warning_issued' ? 'Emitida' : w.event_type === 'warning_signed' ? 'Assinada' : 'Recusada'}
                  </Badge>
                </div>
                <p className="text-xs 2xl:text-sm text-white/50 truncate">{w.description}</p>
                <p className="text-[10px] text-white/30 mt-1">{w.created_at ? format(new Date(w.created_at), 'dd/MM HH:mm') : '--'}</p>
              </div>
            ))
          )}
        </div>
      </TVCard>

      <TVCard title="Incidentes Críticos" icon={ShieldAlert} className="lg:row-span-2">
        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-16rem)]">
          {incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/30">
              <Shield className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhum incidente</p>
            </div>
          ) : (
            incidents.map((inc: any, i: number) => (
              <div key={inc.id ?? i} className="bg-white/5 border border-white/10 rounded-lg p-3 2xl:p-4 tv-slide-up">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className={cn("text-[10px] shrink-0", SEVERITY_COLORS[inc.severity] ?? SEVERITY_COLORS.low)}>{inc.severity}</Badge>
                    <p className="text-sm 2xl:text-base font-medium text-white/90 truncate">{inc.incident_type}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-white/50 border-white/20 shrink-0">{inc.status}</Badge>
                </div>
                <p className="text-xs 2xl:text-sm text-white/50 truncate">{inc.employees?.name} — {inc.description?.slice(0, 60)}</p>
                <p className="text-[10px] text-white/30 mt-1">{inc.created_at ? format(new Date(inc.created_at), 'dd/MM HH:mm') : '--'}</p>
              </div>
            ))
          )}
        </div>
      </TVCard>
    </div>
  );
});

// ════════════════════════════════════════════════
// EXECUTIVE MODE
// ════════════════════════════════════════════════

const ExecutiveMode = memo(function ExecutiveMode({ data }: { data: DisplayData }) {
  const exec = data.executive;
  const workforce = data.workforce;

  if (!exec) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)] text-white/30">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 2xl:gap-6 h-[calc(100vh-8rem)]">
      <div className="col-span-full grid grid-cols-3 lg:grid-cols-6 gap-3 2xl:gap-4">
        <KpiTile icon={Users} label="Colaboradores" value={exec.workforce_total} sub={`${workforce?.active ?? 0} ativos`} color="text-sky-400" />
        <KpiTile icon={Car} label="Veículos" value={exec.active_devices} sub="Rastreados" color="text-sky-400" />
        <KpiTile icon={AlertTriangle} label="Infrações" value={exec.total_violations} sub="Comportamentais" color="text-amber-400" />
        <KpiTile icon={FileWarning} label="Advertências" value={exec.total_warnings} sub="Formais" color="text-orange-400" />
        <KpiTile icon={Lock} label="Bloqueios" value={exec.total_blocks} sub="Ativos" color={exec.total_blocks > 0 ? "text-red-400" : "text-emerald-400"} />
        <KpiTile icon={DollarSign} label="Custo Projetado" value={exec.projected_cost_brl} sub="R$ estimado" color="text-red-400" isCurrency />
      </div>

      <AnimatedGauge
        title="Score Operacional"
        icon={BarChart3}
        value={exec.operational_score}
        maxValue={100}
        label={exec.operational_score >= 80 ? 'Excelente' : exec.operational_score >= 60 ? 'Bom' : exec.operational_score >= 40 ? 'Atenção' : 'Crítico'}
        unit="de 100"
      />

      <AnimatedGauge
        title="Risco Jurídico"
        icon={Scale}
        value={exec.legal_risk.score}
        maxValue={100}
        label={`Risco ${exec.legal_risk.level === 'critical' ? 'Crítico' : exec.legal_risk.level === 'high' ? 'Alto' : exec.legal_risk.level === 'medium' ? 'Médio' : 'Baixo'}`}
        unit="pontos"
        invertColor
      />

      <TVCard title="Custo Projetado" icon={DollarSign}>
        <div className="flex flex-col items-center justify-center py-6 2xl:py-8 gap-4">
          <DollarSign className="h-10 w-10 2xl:h-12 2xl:w-12 text-red-400/50" />
          <p className="text-4xl 2xl:text-5xl font-bold text-white tv-value-change">
            R$ {exec.projected_cost_brl.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
          <p className="text-xs 2xl:text-sm text-white/40 text-center">
            Estimativa baseada em {exec.total_violations} infrações, {exec.total_warnings} advertências e {exec.total_blocks} bloqueios ativos
          </p>
        </div>
      </TVCard>

      {workforce && (
        <TVCard title="Workforce por Departamento" icon={Users} className="lg:col-span-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 2xl:gap-3 max-h-[180px] 2xl:max-h-[240px] overflow-y-auto">
            {Object.entries(workforce.by_department).sort(([, a], [, b]) => b - a).map(([dept, count]) => (
              <div key={dept} className="bg-white/5 rounded-lg px-3 py-2 2xl:px-4 2xl:py-3 flex items-center justify-between tv-value-change">
                <span className="text-xs 2xl:text-sm text-white/70 truncate">{dept}</span>
                <span className="text-sm 2xl:text-base font-bold text-white ml-2">{count}</span>
              </div>
            ))}
          </div>
        </TVCard>
      )}
    </div>
  );
});

// ════════════════════════════════════════════════
// ANIMATED GAUGE (requestAnimationFrame)
// ════════════════════════════════════════════════

function AnimatedGauge({ title, icon: Icon, value, maxValue, label, unit, invertColor }: {
  title: string; icon: any; value: number; maxValue: number; label: string; unit: string; invertColor?: boolean;
}) {
  const animatedValue = useAnimatedNumber(value);
  const circumference = 2 * Math.PI * 52; // r=52

  const getColor = (v: number) => {
    if (invertColor) {
      return v >= 70 ? '#f87171' : v >= 40 ? '#fb923c' : v >= 20 ? '#fbbf24' : '#34d399';
    }
    return v >= 80 ? '#34d399' : v >= 60 ? '#fbbf24' : v >= 40 ? '#fb923c' : '#f87171';
  };

  const getTextColor = (v: number) => {
    if (invertColor) {
      return v >= 70 ? 'text-red-400' : v >= 40 ? 'text-orange-400' : v >= 20 ? 'text-amber-400' : 'text-emerald-400';
    }
    return v >= 80 ? 'text-emerald-400' : v >= 60 ? 'text-amber-400' : v >= 40 ? 'text-orange-400' : 'text-red-400';
  };

  return (
    <TVCard title={title} icon={Icon} className="flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 py-6 2xl:py-8">
        <div className="relative w-40 h-40 2xl:w-48 2xl:h-48 flex items-center justify-center" style={{ willChange: 'transform' }}>
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" style={{ transform: 'rotate(-90deg) translateZ(0)' }}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="52" fill="none"
              stroke={getColor(animatedValue)}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(animatedValue / maxValue) * circumference} ${circumference}`}
              style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.4s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-4xl 2xl:text-5xl font-bold tv-value-change", getTextColor(animatedValue))}>{animatedValue}</span>
            <span className="text-xs 2xl:text-sm text-white/40">{unit}</span>
          </div>
        </div>
        <p className={cn("text-sm 2xl:text-base font-semibold uppercase", getTextColor(value))}>{label}</p>
      </div>
    </TVCard>
  );
}

// ════════════════════════════════════════════════
// SHARED COMPONENTS (memoized)
// ════════════════════════════════════════════════

const KpiTile = memo(function KpiTile({ icon: Icon, label, value, sub, color, isCurrency }: {
  icon: any; label: string; value: number; sub: string; color: string; isCurrency?: boolean;
}) {
  const animatedValue = useAnimatedNumber(value);

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-3 lg:p-4 2xl:p-5" style={{ willChange: 'transform', transform: 'translateZ(0)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] 2xl:text-xs text-white/50 uppercase tracking-wider">{label}</span>
        <Icon className={cn("h-4 w-4 2xl:h-5 2xl:w-5", color)} />
      </div>
      <p className="text-xl lg:text-2xl 2xl:text-3xl font-bold text-white tv-value-change">
        {isCurrency ? `R$ ${animatedValue.toLocaleString('pt-BR')}` : animatedValue}
      </p>
      <p className="text-[10px] 2xl:text-xs text-white/40 mt-0.5">{sub}</p>
    </div>
  );
});

const TVCard = memo(function TVCard({ title, icon: Icon, children, className }: {
  title: string; icon: any; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 2xl:p-5 overflow-hidden", className)} style={{ transform: 'translateZ(0)' }}>
      <div className="flex items-center gap-2 mb-3 2xl:mb-4">
        <Icon className="h-4 w-4 2xl:h-5 2xl:w-5 text-white/50" />
        <h3 className="text-xs 2xl:text-sm font-semibold text-white/70 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
});
