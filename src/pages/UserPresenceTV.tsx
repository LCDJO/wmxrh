/**
 * UserPresenceTV — Full-screen TV Display for Online User Sessions.
 *
 * Route: /display/presence
 *
 * Layout 16:9 dark mode optimized for large screens:
 *   ┌─────────────── HEADER ───────────────────┐
 *   │  Live Users    Clock     KPI Summary      │
 *   ├──────────┬──────────────────────────────── │
 *   │  World   │  Session List (scrolling)      │
 *   │  Map     │  with geo, browser, IP, ASN    │
 *   │  (dots)  │                                │
 *   ├──────────┼────────────────────────────────┤
 *   │ Browser  │ Country  │ OS    │ Device      │
 *   │ Chart    │ Chart    │ Chart │ Chart       │
 *   └──────────┴──────────┴───────┴─────────────┘
 */
import { useState, useEffect, useCallback, memo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Users, Globe, Monitor, Smartphone, MapPin, Clock,
  Wifi, Activity, Shield, Eye, ArrowUp, ArrowDown,
  Laptop, Server, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { ActiveSession, PresenceSummary } from '@/domains/user-presence/types';
import {
  fetchActiveSessions,
  fetchRecentSessions,
  computePresenceSummary,
} from '@/domains/user-presence/presence-engine';

// ── TV Styles ──
const TV_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;500;600;700;800&display=swap');
  .tv-presence { font-family: 'Inter', system-ui, sans-serif; }
  .tv-mono { font-family: 'JetBrains Mono', monospace; }
  @keyframes tvFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes tvSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.4); } 50% { box-shadow: 0 0 20px 6px rgba(52,211,153,0.15); } }
  @keyframes mapDot { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.4); opacity: 1; } }
  @keyframes scrollList { from { transform: translateY(0); } to { transform: translateY(-50%); } }
  .tv-fade-in { animation: tvFadeIn 0.5s ease-out; }
  .tv-slide-up { animation: tvSlideUp 0.4s ease-out both; }
  .tv-pulse-glow { animation: pulseGlow 2.5s infinite; }
  .tv-map-dot { animation: mapDot 2s infinite; }
  .tv-scroll-list { animation: scrollList 40s linear infinite; }
  .tv-scroll-list:hover { animation-play-state: paused; }
  .tv-glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); }
  .tv-glass-accent { background: rgba(52,211,153,0.06); backdrop-filter: blur(12px); border: 1px solid rgba(52,211,153,0.15); }
`;

// ── Simple world map projection ──
function project(lat: number, lng: number, w: number, h: number): [number, number] {
  const x = ((lng + 180) / 360) * w;
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = h / 2 - (mercN / Math.PI) * (h / 2);
  return [x, Math.max(0, Math.min(h, y))];
}

// ── Animated Number ──
function useAnimatedNumber(target: number, duration = 600): number {
  const [current, setCurrent] = useState(target);
  useEffect(() => {
    const start = current;
    const startTime = performance.now();
    let raf: number;
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(start + (target - start) * eased));
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    if (target !== start) raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return current;
}

// ── KPI Card ──
const KpiCard = memo(function KpiCard({ icon: Icon, label, value, color, sub }: {
  icon: any; label: string; value: number; color: string; sub?: string;
}) {
  const v = useAnimatedNumber(value);
  return (
    <div className="tv-glass rounded-2xl p-4 2xl:p-5 tv-fade-in">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] 2xl:text-xs text-white/40 uppercase tracking-[0.15em]">{label}</span>
        <Icon className={cn("h-5 w-5 2xl:h-6 2xl:w-6", color)} />
      </div>
      <p className="text-3xl 2xl:text-4xl font-extrabold text-white tv-mono">{v.toLocaleString('pt-BR')}</p>
      {sub && <p className="text-[10px] 2xl:text-xs text-white/30 mt-0.5">{sub}</p>}
    </div>
  );
});

// ── Breakdown Bar ──
const BreakdownBar = memo(function BreakdownBar({ title, data, total, color }: {
  title: string; data: Record<string, number>; total: number; color: string;
}) {
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <div className="tv-glass rounded-2xl p-4 2xl:p-5 tv-fade-in h-full">
      <h4 className="text-[10px] 2xl:text-xs text-white/40 uppercase tracking-[0.15em] mb-3">{title}</h4>
      <div className="space-y-2">
        {sorted.map(([key, count]) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={key}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-white/70 truncate max-w-[120px]">{key}</span>
                <span className="text-white/40 tv-mono">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5">
                <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ── World Map with dots ──
const WorldMapDots = memo(function WorldMapDots({ sessions }: { sessions: ActiveSession[] }) {
  const W = 800, H = 450;
  const geoSessions = sessions.filter(s => s.latitude != null && s.longitude != null);

  return (
    <div className="tv-glass rounded-2xl p-3 2xl:p-4 tv-fade-in h-full flex flex-col">
      <h4 className="text-[10px] 2xl:text-xs text-white/40 uppercase tracking-[0.15em] mb-2 flex items-center gap-2">
        <Globe className="h-3.5 w-3.5" /> Distribuição Global
      </h4>
      <div className="flex-1 relative overflow-hidden rounded-xl" style={{ minHeight: 200 }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {[...Array(7)].map((_, i) => (
            <line key={`h${i}`} x1={0} y1={i * (H / 6)} x2={W} y2={i * (H / 6)} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          ))}
          {[...Array(13)].map((_, i) => (
            <line key={`v${i}`} x1={i * (W / 12)} y1={0} x2={i * (W / 12)} y2={H} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          ))}
          {/* Session dots */}
          {geoSessions.map((s, i) => {
            const [x, y] = project(s.latitude!, s.longitude!, W, H);
            const isOnline = s.status === 'online';
            return (
              <g key={s.id}>
                {/* Glow */}
                <circle cx={x} cy={y} r={isOnline ? 8 : 5} fill={isOnline ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.1)'} className="tv-map-dot" style={{ animationDelay: `${i * 0.3}s` }} />
                {/* Core dot */}
                <circle cx={x} cy={y} r={isOnline ? 3 : 2} fill={isOnline ? '#34d399' : '#fbbf24'} opacity={0.9} />
              </g>
            );
          })}
        </svg>
        {/* Legend */}
        <div className="absolute bottom-2 right-3 flex items-center gap-4 text-[9px] text-white/30">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Online</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Idle</span>
        </div>
      </div>
    </div>
  );
});

// ── Session List (auto-scrolling) ──
const SessionList = memo(function SessionList({ sessions }: { sessions: ActiveSession[] }) {
  const shouldScroll = sessions.length > 12;
  const displaySessions = shouldScroll ? [...sessions, ...sessions] : sessions;

  return (
    <div className="tv-glass rounded-2xl p-3 2xl:p-4 tv-fade-in h-full flex flex-col overflow-hidden">
      <h4 className="text-[10px] 2xl:text-xs text-white/40 uppercase tracking-[0.15em] mb-2 flex items-center gap-2 shrink-0">
        <Eye className="h-3.5 w-3.5" /> Sessões Ativas ({sessions.length})
      </h4>
      <div className="flex-1 overflow-hidden relative">
        <div className={cn("space-y-1", shouldScroll && "tv-scroll-list")}>
          {displaySessions.map((s, i) => (
            <div key={`${s.id}-${i}`} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors text-xs">
              <div className={cn("h-2 w-2 rounded-full shrink-0", s.status === 'online' ? 'bg-emerald-400' : 'bg-amber-400')} />
              <span className="tv-mono text-white/50 w-[68px] truncate">{s.user_id.slice(0, 8)}…</span>
              <span className="text-white/60 flex items-center gap-1 w-[90px] truncate">
                <MapPin className="h-2.5 w-2.5 shrink-0" />{s.city ?? s.country ?? '—'}
              </span>
              <span className="tv-mono text-white/40 w-[100px] truncate">{s.ip_address ?? '—'}</span>
              <span className="text-white/40 w-[60px] truncate flex items-center gap-1">
                <Monitor className="h-2.5 w-2.5 shrink-0" />{s.browser ?? '?'}
              </span>
              <span className="text-white/40 w-[50px] truncate">{s.os ?? '?'}</span>
              {s.is_vpn && <span className="text-amber-400/70 text-[9px] px-1 rounded bg-amber-400/10 border border-amber-400/20">VPN</span>}
              <span className="text-white/25 ml-auto text-[10px] tv-mono">
                {new Date(s.last_activity).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
        {/* Fade edges */}
        {shouldScroll && (
          <>
            <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[rgba(6,6,16,0.9)] to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[rgba(6,6,16,0.9)] to-transparent pointer-events-none" />
          </>
        )}
      </div>
    </div>
  );
});

// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════

export default function UserPresenceTV() {
  const [clock, setClock] = useState(new Date());
  const [active, setActive] = useState<ActiveSession[]>([]);
  const [summary, setSummary] = useState<PresenceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [activeSessions, recentSessions] = await Promise.all([
      fetchActiveSessions(),
      fetchRecentSessions(24),
    ]);
    setActive(activeSessions);
    setSummary(computePresenceSummary(activeSessions, recentSessions));
    setLoading(false);
  }, []);

  // Initial load + auto-refresh every 30s
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('tv-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_sessions' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const online = active.filter(s => s.status === 'online');
  const idle = active.filter(s => s.status === 'idle');

  return (
    <div className="h-screen w-screen bg-[#060610] text-white overflow-hidden flex flex-col tv-presence select-none cursor-none">
      <style>{TV_STYLES}</style>

      {/* ═══ HEADER ═══ */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full tv-glass-accent tv-pulse-glow">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">LIVE</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white/90 tracking-tight">User Presence Intelligence</h1>
            <p className="text-[10px] text-white/30 uppercase tracking-[0.15em]">Real-time Session Monitoring</p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-2xl font-bold text-white tv-mono tracking-tight">
            {format(clock, 'HH:mm:ss')}
          </p>
          <p className="text-[10px] text-white/30 uppercase tracking-[0.1em]">
            {format(clock, "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Atualização</p>
            <p className="text-xs text-white/50 tv-mono">30s auto</p>
          </div>
          <Wifi className="h-5 w-5 text-emerald-400/60" />
        </div>
      </header>

      {/* ═══ KPI ROW ═══ */}
      <div className="grid grid-cols-6 gap-3 px-6 py-3 shrink-0">
        <KpiCard icon={Users} label="Online" value={online.length} color="text-emerald-400" sub="Sessões ativas" />
        <KpiCard icon={Activity} label="Idle" value={idle.length} color="text-amber-400" sub="Sem atividade" />
        <KpiCard icon={Globe} label="Países" value={summary?.unique_countries ?? 0} color="text-blue-400" sub="Cobertura global" />
        <KpiCard icon={MapPin} label="Cidades" value={summary?.unique_cities ?? 0} color="text-purple-400" sub="Localizações únicas" />
        <KpiCard icon={Smartphone} label="Mobile" value={summary?.mobile_pct ?? 0} color="text-cyan-400" sub="% dispositivos" />
        <KpiCard icon={Shield} label="VPN" value={summary?.vpn_pct ?? 0} color="text-orange-400" sub="% conexões" />
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-1 flex gap-3 px-6 pb-2 min-h-0">
        {/* Left: World Map */}
        <div className="w-[45%] 2xl:w-[42%] shrink-0">
          <WorldMapDots sessions={active} />
        </div>

        {/* Right: Session List */}
        <div className="flex-1 min-w-0">
          <SessionList sessions={active} />
        </div>
      </main>

      {/* ═══ BREAKDOWN ROW ═══ */}
      <div className="grid grid-cols-4 gap-3 px-6 pb-3 shrink-0" style={{ maxHeight: '22%' }}>
        <BreakdownBar title="Navegador" data={summary?.browser_breakdown ?? {}} total={active.length} color="bg-emerald-500" />
        <BreakdownBar title="País" data={Object.fromEntries(
          active.reduce<Map<string, number>>((m, s) => { const k = s.country ?? 'Desconhecido'; m.set(k, (m.get(k) ?? 0) + 1); return m; }, new Map())
        )} total={active.length} color="bg-blue-500" />
        <BreakdownBar title="Sistema" data={summary?.os_breakdown ?? {}} total={active.length} color="bg-purple-500" />
        <BreakdownBar title="Dispositivo" data={summary?.device_breakdown ?? {}} total={active.length} color="bg-cyan-500" />
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer className="flex items-center justify-between px-6 py-1.5 border-t border-white/5 shrink-0 text-[9px] text-white/20">
        <div className="flex items-center gap-2">
          <Wifi className="h-3 w-3 text-emerald-400/50" />
          <span>Supabase Realtime</span>
        </div>
        <span>User Presence Engine v1.0</span>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span className="tv-mono">{format(clock, 'HH:mm:ss')}</span>
        </div>
      </footer>
    </div>
  );
}
