/**
 * LiveDisplayTV — Full-screen TV Dashboard
 *
 * Layout 16:9 otimizado:
 *   ┌──────────────── HEADER ──────────────────┐
 *   │ Empresa     Data/Hora     Score Operac.   │
 *   ├──────────────────┬────────────────────────┤
 *   │                  │  Top Infrações         │
 *   │   MAPA AO VIVO   │  Bloqueados            │
 *   │   + HEATMAP      │  Advertências Recentes │
 *   │   + ALERTAS      │                        │
 *   ├──────────────────┴────────────────────────┤
 *   │ WS Status  │  v1.0  │  Última atualização │
 *   └──────────────────────────────────────────-┘
 *
 * DARK MODE obrigatório. Tipografia grande. Alto contraste.
 * Sem menus laterais. Sem botões administrativos.
 */
import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle, Tv, WifiOff, Loader2, Wifi, Activity,
  Clock, BarChart3, Scale, Zap, Lock, FileWarning,
  RotateCw, Pause, Play, ChevronLeft, ChevronRight, Power,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildDisplayMockData } from '@/lib/displayMockData';
import { QRCodeSVG } from 'qrcode.react';
import { useDisplayRealtime, type ConnectionStatus } from '@/hooks/useDisplayRealtime';
import { useDisplayEventQueue } from '@/hooks/useDisplayEventQueue';
import { useDisplayEventPipeline } from '@/hooks/useDisplayEventPipeline';
import { useDisplayGateway, type GatewayStatus } from '@/hooks/useDisplayGateway';
import { useDisplayCache } from '@/hooks/useDisplayCache';
import { useRenderThrottle } from '@/hooks/useRenderThrottle';
import { useDisplayScalability } from '@/hooks/useDisplayScalability';
import { useFailsafeMode } from '@/hooks/useFailsafeMode';
import {
  type DisplayData,
  KpiTile,
  TVCard,
  AnimatedGauge,
  FlashingAlert,
  TopInfractions,
  BlockedEmployees,
  RecentWarnings,
  useAnimatedNumber,
} from '@/components/tv/TVComponents';
import { TVMapCenter } from '@/components/tv/TVMapCenter';
import { useRotationMode, VIEW_LABELS, type RotationView } from '@/hooks/useRotationMode';
import {
  FleetLiveView,
  RiskHeatmapView,
  SSTView,
  ComplianceSummaryView,
  ExecutiveOverviewView,
} from '@/components/tv/TVRotationViews';

type PairingState =
  | { phase: 'requesting' }
  | { phase: 'waiting'; pairing_code: string; session_id: string; token: string; expires_at: Date }
  | { phase: 'paired'; token: string }
  | { phase: 'error'; message: string };

// ── Live Clock ──
function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// ── TV Styles (injected once) ──
const TV_STYLES = `
  .tv-root { transform: translateZ(0); font-family: 'Inter', system-ui, sans-serif; }
  .tv-fade-in { animation: tvFadeIn 0.4s ease-out; will-change: opacity, transform; }
  .tv-slide-up { animation: tvSlideUp 0.3s ease-out; will-change: opacity, transform; }
  .tv-value-change { transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
  @keyframes tvFadeIn { from { opacity: 0; transform: translateY(4px) translateZ(0); } to { opacity: 1; transform: translateY(0) translateZ(0); } }
  @keyframes tvSlideUp { from { opacity: 0; transform: translateY(8px) translateZ(0); } to { opacity: 1; transform: translateY(0) translateZ(0); } }
  @keyframes tvPulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.3); } 50% { box-shadow: 0 0 12px 4px rgba(52,211,153,0.15); } }
  .tv-pulse-glow { animation: tvPulseGlow 2s infinite; }
  @keyframes flashCritical { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .tv-flash-critical { animation: flashCritical 1.2s ease-in-out infinite; }
`;

export default function LiveDisplayTV() {
  const [params] = useSearchParams();
  const location = useLocation();
  const tokenFromUrl = params.get('token');
  const isPreviewMode = params.get('preview') === 'true';
  const previewTipo = params.get('tipo') ?? 'executivo';
  const isDisplayRoute = location.pathname === '/display';

  // ── SECURITY: Block direct URL access without token (non-pairing routes) ──
  const isValidAccess = isDisplayRoute || !!tokenFromUrl || isPreviewMode;

  // ── Preview mode: inject demo data and skip pairing/gateway ──
  const previewDemoData: DisplayData | null = isPreviewMode ? buildDisplayMockData(previewTipo) : null;

  const [pairingState, setPairingState] = useState<PairingState | null>(null);
  const [activeToken, setActiveToken] = useState<string | null>(isPreviewMode ? '__preview__' : tokenFromUrl);
  const [rawData, setRawData] = useState<DisplayData | null>(previewDemoData);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(isPreviewMode ? new Date() : null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const backoffRef = useRef(10_000);
  const clock = useLiveClock();

  // ── Performance: Local cache (namespaced by token) + render throttle ──
  const cacheKey = activeToken ? `tok_${activeToken.slice(-8)}` : 'none';
  const cache = useDisplayCache<DisplayData>({ key: cacheKey, ttlMs: 300_000 });

  // Initialize from cache on mount (skip in preview — data is already set)
  useEffect(() => {
    if (isPreviewMode) return;
    if (!rawData && activeToken) {
      const cached = cache.read();
      if (cached) setRawData(cached);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // In preview, skip throttle for instant render; in live mode throttle to 2/sec
  const data = useRenderThrottle(rawData, isPreviewMode ? 0 : 500);

  // ── SECURITY: Clear cache on token change ──
  useEffect(() => {
    if (!activeToken && !isPreviewMode) {
      cache.clear();
    }
  }, [activeToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rotation Mode ──
  const rotationEnabled = data?.display?.rotacao_automatica ?? false;
  const rotationInterval = data?.display?.intervalo_rotacao ?? 60;

  // Map display tipo to the correct initial view
  const TIPO_TO_VIEW: Record<string, RotationView> = {
    fleet: 'fleet_live',
    sst: 'sst_view',
    compliance: 'compliance_summary',
    executivo: 'executive_overview',
  };
  const displayTipo = data?.display?.tipo ?? 'executivo';
  const initialView = TIPO_TO_VIEW[displayTipo] ?? 'executive_overview';

  const rotation = useRotationMode({
    enabled: rotationEnabled && !!data,
    intervalSeconds: rotationInterval,
    views: rotationEnabled ? undefined : [initialView],
  });

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const functionsBase = `https://${projectId}.supabase.co/functions/v1`;

  const tenantIdFromData = data?.display?.tenant_id ?? null;

  // ── Scalability: Instance ID, sticky sessions, broker abstraction ──
  const scalability = useDisplayScalability({
    tenantId: tenantIdFromData,
    displayId: data?.display?.id ?? null,
  });

  // ── Hooks: Event Queue, Pipeline, Gateway (ALL disabled in preview) ──
  const { stats: queueStats } = useDisplayEventQueue({ maxBufferSize: 500, flushIntervalMs: 300 });

  const { status: pipelineStatus } = useDisplayEventPipeline({
    tenantId: tenantIdFromData,
    enabled: !isPreviewMode && !!activeToken && !!data,
    pollIntervalMs: 10_000,
    pollingOnly: true,
    onEvent: (events) => { if (events.length > 0) fetchData(); },
  });

  const { status: gatewayStatus, session: gatewaySession } = useDisplayGateway({
    token: isPreviewMode ? null : activeToken,
    enabled: !isPreviewMode && !!activeToken,
    heartbeatIntervalMs: 30_000,
    pollIntervalMs: 15_000,
    instanceId: scalability.instanceId,
    onEvent: (events) => { if (events.length > 0) fetchData(); },
    onSessionExpired: () => {
      if (isPreviewMode) return;
      setActiveToken(null);
      setPairingState({ phase: 'error', message: 'Sessão expirada. Pareie novamente.' });
    },
  });

  // ── Pairing Phase 1: Request ──
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
    if (isDisplayRoute && !activeToken && !isPreviewMode) requestPairing();
  }, [isDisplayRoute, activeToken, requestPairing, isPreviewMode]);

  // ── Pairing Phase 2: Poll confirmation ──
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

  // ── Phase 3: Fetch display data ──
  const fetchData = useCallback(async () => {
    if (!activeToken || isPreviewMode) return;
    try {
      const resp = await fetch(`${functionsBase}/live-display-data?token=${encodeURIComponent(activeToken)}`, {
        headers: scalability.stickyHeaders,
      });
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({ error: 'Falha na conexão' }));
        setError(errBody.error ?? 'Erro ao carregar dados');
        return;
      }
      const result = await resp.json();
      setRawData(result);
      cache.write(result);
      setError(null);
      setLastUpdate(new Date());
      backoffRef.current = 10_000;
    } catch {
      setError('Falha na conexão com o servidor');
      backoffRef.current = Math.min(backoffRef.current * 1.5, 60_000);
    }
  }, [activeToken, functionsBase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Realtime + Polling fallback ──
  const { status: connectionStatus } = useDisplayRealtime({
    tenantId: tenantIdFromData,
    displayId: data?.display?.id ?? null,
    pollIntervalMs: (data?.display?.intervalo_rotacao ?? 30) * 1000,
    onDataRefresh: fetchData,
    enabled: !isPreviewMode && !!activeToken && !!data,
    pollingOnly: true, // TV has no auth session — skip Realtime WS
  });

  useEffect(() => {
    if (!activeToken || !data || isPreviewMode) return;
    const interval = (data.display.intervalo_rotacao ?? 30) * 1000;
    const timer = setInterval(fetchData, interval);
    return () => clearInterval(timer);
  }, [activeToken, data?.display?.intervalo_rotacao, fetchData]);

  // ── Disconnect handler ──
  const handleDisconnect = useCallback(async () => {
    // Try to disconnect via gateway
    if (activeToken && !isPreviewMode) {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const base = `https://${projectId}.supabase.co/functions/v1/display-ws-gateway`;
        await fetch(`${base}?action=disconnect&token=${encodeURIComponent(activeToken)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch { /* best effort */ }
    }
    cache.clear();
    setActiveToken(null);
    setRawData(null);
    setError(null);
    setLastUpdate(null);
    setPairingState(null);
    // Will trigger requestPairing via the useEffect
  }, [activeToken, isPreviewMode, cache]);

  // ── Lock TV (skip in preview — it's inside an iframe) ──
  useEffect(() => {
    if (isPreviewMode) return;
    const dblClickHandler = () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    };
    const ctxHandler = (e: MouseEvent) => e.preventDefault();
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && (e.key === 'l' || e.key === 'u')) || (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight'))) e.preventDefault();
    };
    document.body.style.userSelect = 'none';
    document.addEventListener('dblclick', dblClickHandler);
    document.addEventListener('contextmenu', ctxHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.body.style.userSelect = '';
      document.removeEventListener('dblclick', dblClickHandler);
      document.removeEventListener('contextmenu', ctxHandler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [isPreviewMode]);

  // Effective connection status — in preview, always show as connected
  const effectiveStatus: ConnectionStatus = isPreviewMode ? 'realtime' :
    gatewayStatus === 'connected' ? 'realtime' :
    pipelineStatus === 'realtime' ? 'realtime' :
    connectionStatus === 'realtime' ? 'realtime' :
    gatewayStatus === 'reconnecting' ? 'reconnecting' :
    connectionStatus === 'polling' && data ? 'realtime' : connectionStatus;

  // ── Failsafe Mode (disabled in preview) ──
  const failsafe = useFailsafeMode({
    connectionStatus: effectiveStatus,
    lastUpdate,
    hasData: !!data,
    staleThresholdSeconds: isPreviewMode ? 999999 : 120,
    degradedThresholdSeconds: isPreviewMode ? 999999 : 30,
  });

  // ═══════════════════════════════════════════════════════
  // PAIRING SCREENS
  // ═══════════════════════════════════════════════════════

  // ── SECURITY: Block access without valid token or pairing route ──
  if (!isValidAccess) {
    return (
      <div className="min-h-screen bg-[#060610] flex items-center justify-center text-white">
        <style>{TV_STYLES}</style>
        <div className="text-center space-y-4">
          <Lock className="h-20 w-20 mx-auto text-red-400/60" />
          <h1 className="text-3xl font-bold">Acesso Negado</h1>
          <p className="text-white/50 text-lg">Token de display obrigatório. Acesse <span className="text-primary font-mono">/display</span> para parear.</p>
        </div>
      </div>
    );
  }

  if (isDisplayRoute && !activeToken) {
    if (!pairingState || pairingState.phase === 'requesting') {
      return (
        <div className="min-h-screen bg-[#060610] flex items-center justify-center text-white">
          <style>{TV_STYLES}</style>
          <div className="text-center space-y-4 animate-pulse">
            <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin" />
            <h1 className="text-2xl font-bold">Gerando código de pareamento...</h1>
          </div>
        </div>
      );
    }
    if (pairingState.phase === 'error') {
      return (
        <div className="min-h-screen bg-[#060610] flex items-center justify-center text-white">
          <style>{TV_STYLES}</style>
          <div className="text-center space-y-6">
            <AlertTriangle className="h-20 w-20 mx-auto text-red-400" />
            <h1 className="text-3xl font-bold">{pairingState.message}</h1>
            <button onClick={requestPairing} className="px-8 py-4 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl transition-colors text-lg font-semibold">
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }
    if (pairingState.phase === 'waiting') {
      const pairUrl = `${window.location.origin}/live-display?code=${pairingState.pairing_code}`;
      return (
        <div className="min-h-screen bg-[#060610] flex items-center justify-center text-white">
          <style>{TV_STYLES}</style>
          <div className="text-center space-y-8 max-w-xl">
            <div className="flex items-center justify-center gap-3">
              <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
              <h1 className="text-3xl 2xl:text-4xl font-bold">Pareamento de Display</h1>
            </div>
            <p className="text-white/50 text-base">Escaneie o QR Code ou insira o código no painel administrativo.</p>
            <div className="bg-white p-8 rounded-2xl inline-block mx-auto">
              <QRCodeSVG value={pairUrl} size={280} level="H" />
            </div>
            <div className="space-y-3">
              <p className="text-white/40 text-xs uppercase tracking-wider">Código de pareamento</p>
              <div className="flex items-center justify-center gap-3">
                {pairingState.pairing_code.split('').map((char, i) => (
                  <span key={i} className="w-16 h-20 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center text-4xl font-mono font-bold text-primary">
                    {char}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-white/30 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Aguardando confirmação do administrador...</span>
            </div>
          </div>
        </div>
      );
    }
  }

  // ═══════════════════════════════════════════════════════
  // LOADING / ERROR STATES
  // ═══════════════════════════════════════════════════════

  if (!activeToken) {
    return (
      <div className="min-h-screen bg-[#060610] flex items-center justify-center text-white">
        <style>{TV_STYLES}</style>
        <div className="text-center space-y-4">
          <WifiOff className="h-20 w-20 mx-auto opacity-40" />
          <h1 className="text-3xl font-bold">Token não fornecido</h1>
          <p className="text-white/50 text-lg">Acesse <span className="text-primary font-mono">/display</span> para parear este monitor.</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#060610] flex items-center justify-center text-white">
        <style>{TV_STYLES}</style>
        <div className="text-center space-y-4">
          <AlertTriangle className="h-20 w-20 mx-auto text-red-400" />
          <h1 className="text-3xl font-bold">Erro de Conexão</h1>
          <p className="text-white/50 text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#060610] flex items-center justify-center text-white">
        <style>{TV_STYLES}</style>
        <div className="text-center space-y-4 animate-pulse">
          <Tv className="h-20 w-20 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Conectando display...</h1>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // MAIN TV DASHBOARD — 16:9 LAYOUT
  // ═══════════════════════════════════════════════════════

  const exec = data.executive;
  const alerts = data.critical_alerts ?? [];
  const positions = data.live_positions ?? [];
  const fleetEvents = data.fleet_events ?? [];
  const speedAlerts = data.speed_alerts ?? [];
  const blocks = data.active_blocks ?? [];
  const warnings = data.recent_warnings ?? [];
  const operationalScore = exec?.operational_score ?? 0;

  return (
    <div className="h-screen w-screen bg-[#060610] text-white overflow-hidden flex flex-col tv-root">
      <style>{TV_STYLES}</style>

      {/* ════════════════════════════════════════════════
          HEADER — Company, DateTime, Score
          ════════════════════════════════════════════════ */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/5 shrink-0">
        {/* Left: Company + Status */}
        <div className="flex items-center gap-4">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full",
            effectiveStatus === 'realtime' ? "bg-emerald-500/15 tv-pulse-glow" : "bg-white/5"
          )}>
            <div className={cn(
              "h-2.5 w-2.5 rounded-full",
              effectiveStatus === 'realtime' ? "bg-emerald-400 animate-pulse" :
              effectiveStatus === 'reconnecting' ? "bg-amber-400 animate-pulse" : "bg-sky-400"
            )} />
            <span className={cn(
              "text-sm font-bold uppercase tracking-wider",
              effectiveStatus === 'realtime' ? "text-emerald-400" : "text-white/50"
            )}>
              {effectiveStatus === 'realtime' ? 'AO VIVO' : effectiveStatus === 'reconnecting' ? 'RECONECTANDO' : 'POLLING'}
            </span>
          </div>
          <h1 className="text-xl 2xl:text-2xl font-bold text-white/90 tracking-tight">{data.display.nome}</h1>
        </div>

        {/* Center: Date & Time */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-3xl 2xl:text-4xl font-bold text-white tabular-nums tracking-tight">
              {format(clock, 'HH:mm:ss')}
            </p>
            <p className="text-xs text-white/40 uppercase tracking-wider">
              {format(clock, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* Right: Operational Score */}
        <div className="flex items-center gap-4">
          {exec && (
            <div className="flex items-center gap-3">
              <AnimatedGauge
                title="Score"
                icon={BarChart3}
                value={operationalScore}
                maxValue={100}
                label={operationalScore >= 80 ? 'Excelente' : operationalScore >= 60 ? 'Bom' : operationalScore >= 40 ? 'Atenção' : 'Crítico'}
                unit="pts"
                compact
              />
              {exec.legal_risk && (
                <AnimatedGauge
                  title="Risco"
                  icon={Scale}
                  value={exec.legal_risk.score}
                  maxValue={100}
                  label={exec.legal_risk.level === 'critical' ? 'Crítico' : exec.legal_risk.level === 'high' ? 'Alto' : 'OK'}
                  unit="risco"
                  invertColor
                  compact
                />
              )}
            </div>
          )}
        </div>
      </header>

      {/* ════════════════════════════════════════════════
          ALERTS BANNER — Flashing if critical
          ════════════════════════════════════════════════ */}
      {alerts.length > 0 && (
        <div className="px-6 py-2 shrink-0">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 flex items-center gap-4 overflow-x-auto">
            <AlertTriangle className="h-6 w-6 text-red-400 shrink-0 tv-flash-critical" />
            <div className="flex gap-3 min-w-0">
              {alerts.slice(0, 5).map((alert: any, i: number) => (
                <FlashingAlert key={alert.id ?? i} alert={alert} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          FAILSAFE WARNING — Discrete connection alert
          ════════════════════════════════════════════════ */}
      {failsafe.level !== 'ok' && (
        <div className={cn(
          "px-6 py-1.5 shrink-0 transition-all duration-500",
          failsafe.level === 'failsafe' ? 'tv-slide-up' : ''
        )}>
          <div className={cn(
            "rounded-lg px-4 py-2 flex items-center gap-3 text-sm",
            failsafe.level === 'degraded'
              ? "bg-amber-500/8 border border-amber-500/20"
              : "bg-red-500/8 border border-red-500/20"
          )}>
            <div className={cn(
              "h-2 w-2 rounded-full shrink-0 animate-pulse",
              failsafe.level === 'degraded' ? "bg-amber-400" : "bg-red-400"
            )} />
            <WifiOff className={cn(
              "h-4 w-4 shrink-0",
              failsafe.level === 'degraded' ? "text-amber-400/70" : "text-red-400/70"
            )} />
            <span className={cn(
              "font-medium",
              failsafe.level === 'degraded' ? "text-amber-300/80" : "text-red-300/80"
            )}>
              {failsafe.message}
            </span>
            {failsafe.staleSince > 0 && (
              <span className="text-white/25 tabular-nums ml-auto">
                {failsafe.staleSince}s atrás
              </span>
            )}
          </div>
        </div>
      )}

      {/*
          ════════════════════════════════════════════════ */}
      <main className="flex-1 flex gap-4 px-6 py-3 min-h-0">
        {rotation.currentView === 'fleet_live' && <FleetLiveView data={data} />}
        {rotation.currentView === 'risk_heatmap' && <RiskHeatmapView data={data} />}
        {rotation.currentView === 'sst_view' && <SSTView data={data} />}
        {rotation.currentView === 'compliance_summary' && <ComplianceSummaryView data={data} />}
        {rotation.currentView === 'executive_overview' && <ExecutiveOverviewView data={data} />}
      </main>

      {/* ════════════════════════════════════════════════
          FOOTER — Connection, Rotation, Version, Last Update
          ════════════════════════════════════════════════ */}
      <footer className="flex items-center justify-between px-6 py-2 border-t border-white/5 shrink-0 text-[10px] 2xl:text-xs text-white/25">
        {/* Left: WebSocket status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {effectiveStatus === 'realtime' ? (
              <Wifi className="h-3 w-3 text-emerald-400/60" />
            ) : effectiveStatus === 'reconnecting' ? (
              <WifiOff className="h-3 w-3 text-amber-400/60" />
            ) : (
              <Activity className="h-3 w-3 text-sky-400/60" />
            )}
            <span>
              {effectiveStatus === 'realtime' ? 'WebSocket Conectado' :
               effectiveStatus === 'reconnecting' ? 'Reconectando...' :
               'Polling Ativo'}
            </span>
          </div>
          {gatewaySession && (
            <span className="text-white/15">
              Modo: {gatewaySession.modo?.toUpperCase() ?? data.display.tipo.toUpperCase()}
            </span>
          )}
          <span className="text-white/10">|</span>
          <span className="text-white/15 tabular-nums" title={`Instance: ${scalability.instanceId} | Partition: ${scalability.partitionKey} | Broker: ${scalability.activeBroker}`}>
            Node: {scalability.instanceId.slice(-6)} · {scalability.partitionKey}
          </span>
        </div>

        {/* Center: Rotation indicator */}
        <div className="flex items-center gap-3">
          {rotationEnabled && (
            <>
              <div className="flex items-center gap-1.5">
                <RotateCw className={cn("h-3 w-3", rotation.paused ? "text-white/20" : "text-sky-400/60 animate-spin")} style={rotation.paused ? {} : { animationDuration: `${rotationInterval}s` }} />
                <span className="text-white/40">{rotation.viewLabel}</span>
              </div>
              {/* Rotation dots */}
              <div className="flex items-center gap-1">
                {Array.from({ length: rotation.totalViews }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      i === rotation.currentIndex ? "w-4 bg-sky-400/60" : "w-1.5 bg-white/15"
                    )}
                  />
                ))}
              </div>
              {/* Progress bar */}
              <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400/40 rounded-full"
                  style={{ width: `${rotation.progress * 100}%`, transition: 'width 0.1s linear' }}
                />
              </div>
              <span className="text-white/20 tabular-nums">{rotation.remaining}s</span>
            </>
          )}
          {!rotationEnabled && (
            <>
              <span>Display Engine v2.0</span>
              <span className="text-white/10">|</span>
              <span>Clique duplo → Tela cheia</span>
            </>
          )}
        </div>

        {/* Right: Last update + Disconnect */}
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Atualizado: {format(lastUpdate, 'HH:mm:ss')}
            </span>
          )}
          {error && (
            <span className="text-red-400/60 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Reconectando
            </span>
          )}
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/70 hover:text-red-400 transition-colors border border-red-500/20 hover:border-red-500/30"
            title="Desconectar display"
          >
            <Power className="h-3 w-3" />
            <span>Desconectar</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
