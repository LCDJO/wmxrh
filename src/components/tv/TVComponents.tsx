/**
 * TV Dashboard Sub-components
 * Extracted for maintainability from LiveDisplayTV
 */
import { memo, useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  AlertTriangle, Activity, Shield, MapPin, Gauge,
  Lock, FileWarning, Clock, Zap, Car, Heart,
  ShieldAlert, Users, Loader2,
} from 'lucide-react';

// ── Types ──
export interface DisplayData {
  display: {
    id: string;
    nome: string;
    tipo: string;
    rotacao_automatica: boolean;
    intervalo_rotacao: number;
    layout_config: any;
    tenant_id?: string;
  };
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
  risk_heatmap?: Record<string, RiskHeatmapEntry>;
  critical_alerts?: any[];
}

export interface RiskHeatmapEntry {
  fleet: number;
  sst: number;
  compliance: number;
  workforce: number;
  total: number;
  headcount: number;
}

export const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

// ── Animated Number Hook ──
export function useAnimatedNumber(target: number, duration = 600): number {
  const [current, setCurrent] = useState(target);
  const rafRef = useRef<number>();

  useEffect(() => {
    const start = current;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(start + (target - start) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    if (target !== start) rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return current;
}

// ── KPI Tile ──
export const KpiTile = memo(function KpiTile({ icon: Icon, label, value, sub, color, isCurrency }: {
  icon: any; label: string; value: number; sub: string; color: string; isCurrency?: boolean;
}) {
  const animatedValue = useAnimatedNumber(value);
  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-3 2xl:p-4" style={{ transform: 'translateZ(0)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] 2xl:text-xs text-white/50 uppercase tracking-wider">{label}</span>
        <Icon className={cn("h-4 w-4 2xl:h-5 2xl:w-5", color)} />
      </div>
      <p className="text-xl 2xl:text-2xl font-bold text-white tv-value-change">
        {isCurrency ? `R$ ${animatedValue.toLocaleString('pt-BR')}` : animatedValue}
      </p>
      <p className="text-[10px] 2xl:text-xs text-white/40 mt-0.5">{sub}</p>
    </div>
  );
});

// ── TV Card ──
export const TVCard = memo(function TVCard({ title, icon: Icon, children, className }: {
  title: string; icon: any; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-3 2xl:p-4 overflow-hidden", className)} style={{ transform: 'translateZ(0)' }}>
      <div className="flex items-center gap-2 mb-2 2xl:mb-3">
        <Icon className="h-4 w-4 text-white/50" />
        <h3 className="text-[11px] 2xl:text-xs font-semibold text-white/70 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
});

// ── Animated Gauge ──
export function AnimatedGauge({ title, icon: Icon, value, maxValue, label, unit, invertColor, compact }: {
  title: string; icon: any; value: number; maxValue: number; label: string; unit: string; invertColor?: boolean; compact?: boolean;
}) {
  const animatedValue = useAnimatedNumber(value);
  const circumference = 2 * Math.PI * 52;

  const getColor = (v: number) => {
    if (invertColor) return v >= 70 ? '#f87171' : v >= 40 ? '#fb923c' : v >= 20 ? '#fbbf24' : '#34d399';
    return v >= 80 ? '#34d399' : v >= 60 ? '#fbbf24' : v >= 40 ? '#fb923c' : '#f87171';
  };
  const getTextColor = (v: number) => {
    if (invertColor) return v >= 70 ? 'text-red-400' : v >= 40 ? 'text-orange-400' : v >= 20 ? 'text-amber-400' : 'text-emerald-400';
    return v >= 80 ? 'text-emerald-400' : v >= 60 ? 'text-amber-400' : v >= 40 ? 'text-orange-400' : 'text-red-400';
  };

  const size = compact ? 'w-24 h-24' : 'w-32 h-32 2xl:w-40 2xl:h-40';

  return (
    <div className="flex flex-col items-center gap-2">
      {!compact && <span className="text-[10px] text-white/50 uppercase tracking-wider">{title}</span>}
      <div className={cn("relative flex items-center justify-center", size)} style={{ willChange: 'transform' }}>
        <svg viewBox="0 0 120 120" className="w-full h-full" style={{ transform: 'rotate(-90deg) translateZ(0)' }}>
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle cx="60" cy="60" r="52" fill="none" stroke={getColor(animatedValue)} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${(animatedValue / maxValue) * circumference} ${circumference}`}
            style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.4s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn(compact ? "text-2xl" : "text-3xl 2xl:text-4xl", "font-bold tv-value-change", getTextColor(animatedValue))}>{animatedValue}</span>
          <span className="text-[9px] 2xl:text-[10px] text-white/40">{unit}</span>
        </div>
      </div>
      <p className={cn("text-[10px] 2xl:text-xs font-semibold uppercase", getTextColor(value))}>{label}</p>
    </div>
  );
}

// ── Flashing Critical Alert ──
export const FlashingAlert = memo(function FlashingAlert({ alert }: { alert: any }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setVisible(v => !v), 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={cn(
      "shrink-0 rounded-lg px-3 py-2 border min-w-[220px] 2xl:min-w-[280px] transition-opacity duration-200",
      visible ? "bg-red-500/20 border-red-500/40 opacity-100" : "bg-red-500/10 border-red-500/20 opacity-60"
    )}>
      <p className="text-sm 2xl:text-base font-bold text-red-300">{alert.incident_type ?? alert.event_type ?? 'ALERTA'}</p>
      <p className="text-xs text-red-300/70 truncate">{alert.employees?.name ?? 'N/I'} — {(alert.description ?? '').slice(0, 50)}</p>
    </div>
  );
});

// ── Side Panel: Top Infractions ──
export const TopInfractions = memo(function TopInfractions({ events }: { events: any[] }) {
  if (events.length === 0) {
    return <p className="text-white/30 text-xs text-center py-3">Nenhuma infração hoje</p>;
  }
  return (
    <div className="space-y-1.5 overflow-y-auto max-h-full">
      {events.slice(0, 8).map((ev: any, i: number) => (
        <div key={ev.id ?? i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0 tv-slide-up">
          <div className="flex items-center gap-2 min-w-0">
            <Badge className={cn("text-[9px] shrink-0 px-1.5", SEVERITY_COLORS[ev.severity] ?? SEVERITY_COLORS.low)}>
              {ev.severity?.charAt(0).toUpperCase()}
            </Badge>
            <span className="text-xs text-white/70 truncate">{ev.event_type ?? ev.violation_type ?? 'N/I'}</span>
          </div>
          <span className="text-[10px] text-white/30 shrink-0 ml-2">
            {ev.detected_at || ev.event_timestamp ? format(new Date(ev.detected_at ?? ev.event_timestamp), 'HH:mm') : '--'}
          </span>
        </div>
      ))}
    </div>
  );
});

// ── Side Panel: Blocked Employees ──
export const BlockedEmployees = memo(function BlockedEmployees({ blocks }: { blocks: any[] }) {
  if (blocks.length === 0) {
    return (
      <div className="flex flex-col items-center py-3 text-white/30">
        <Shield className="h-5 w-5 mb-1 opacity-40" />
        <p className="text-[10px]">Sem bloqueios</p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5 overflow-y-auto max-h-full">
      {blocks.slice(0, 6).map((b: any, i: number) => (
        <div key={b.id ?? i} className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2 tv-slide-up">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white/90 truncate">{b.employees?.name ?? 'N/I'}</p>
            <Lock className="h-3 w-3 text-orange-400 shrink-0" />
          </div>
          <p className="text-[10px] text-white/50 truncate">{b.violation_type ?? b.reason ?? ''}</p>
        </div>
      ))}
    </div>
  );
});

// ── Side Panel: Recent Warnings ──
export const RecentWarnings = memo(function RecentWarnings({ warnings }: { warnings: any[] }) {
  if (warnings.length === 0) {
    return <p className="text-white/30 text-[10px] text-center py-3">Sem advertências recentes</p>;
  }
  return (
    <div className="space-y-1.5 overflow-y-auto max-h-full">
      {warnings.slice(0, 6).map((w: any, i: number) => (
        <div key={w.id ?? i} className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 tv-slide-up">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white/90 truncate">{w.employees?.name ?? 'N/I'}</p>
            <Badge className="text-[8px] bg-amber-500/20 text-amber-400 border-amber-500/30 px-1">
              {w.event_type === 'warning_issued' ? 'Nova' : w.event_type === 'warning_signed' ? 'Assinada' : 'Recusada'}
            </Badge>
          </div>
          <p className="text-[10px] text-white/50 truncate">{w.description}</p>
        </div>
      ))}
    </div>
  );
});
