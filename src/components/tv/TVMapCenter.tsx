/**
 * TVMapCenter — Central area for TV dashboard.
 * Shows live map placeholder with heatmap overlay and flashing alerts.
 * Supports expand toggle to 2× size.
 */
import { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Flame, Maximize2, Minimize2 } from 'lucide-react';
import type { RiskHeatmapEntry } from './TVComponents';

interface TVMapCenterProps {
  positions: any[];
  heatmap?: Record<string, RiskHeatmapEntry>;
  className?: string;
}

const getRiskBg = (value: number): string => {
  if (value >= 70) return 'bg-red-500/60';
  if (value >= 40) return 'bg-orange-500/50';
  if (value >= 20) return 'bg-amber-500/40';
  if (value > 0) return 'bg-emerald-500/30';
  return 'bg-white/5';
};

export const TVMapCenter = memo(function TVMapCenter({ positions, heatmap, className }: TVMapCenterProps) {
  const hasHeatmap = heatmap && Object.keys(heatmap).length > 0;
  const [expanded, setExpanded] = useState(false);

  const mapContent = (
    <div className="relative w-full h-full">
      {/* Grid background pattern for map feel */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* Center icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <MapPin className="h-16 w-16 text-white/10" />
      </div>

      {/* Live position dots */}
      {positions.slice(0, 20).map((p: any, i: number) => {
        const x = 10 + ((i * 37 + 13) % 80);
        const y = 10 + ((i * 23 + 7) % 80);
        const isMoving = (p.speed ?? 0) > 5;
        const isSpeeding = (p.speed ?? 0) > 80;
        return (
          <div
            key={p.device_id ?? i}
            className={cn(
              "absolute rounded-full transition-all duration-1000",
              expanded ? "w-4 h-4" : "w-3 h-3",
              isSpeeding ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" :
              isMoving ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]" :
              "bg-sky-400/60"
            )}
            style={{ left: `${x}%`, top: `${y}%`, transform: 'translateZ(0)' }}
          >
            {isMoving && (
              <div className={cn(
                "absolute inset-0 rounded-full animate-ping",
                isSpeeding ? "bg-red-500/30" : "bg-emerald-400/20"
              )} />
            )}
            {/* Speed label on expanded */}
            {expanded && (p.speed ?? 0) > 0 && (
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-bold text-white/70 whitespace-nowrap">
                {p.speed}km/h
              </span>
            )}
          </div>
        );
      })}

      {/* Heatmap overlay zones */}
      {hasHeatmap && (
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center gap-1 mb-1">
            <Flame className="h-3 w-3 text-white/40" />
            <span className="text-[9px] text-white/40 uppercase tracking-wider">Risco por Departamento</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {Object.entries(heatmap!)
              .sort(([, a], [, b]) => b.total - a.total)
              .slice(0, 8)
              .map(([dept, entry]) => (
                <div
                  key={dept}
                  className={cn(
                    "rounded px-2 py-1 text-[9px] font-semibold border border-white/10",
                    getRiskBg(entry.total),
                    entry.total >= 70 ? "text-red-200" :
                    entry.total >= 40 ? "text-orange-200" :
                    entry.total >= 20 ? "text-amber-200" :
                    "text-emerald-200"
                  )}
                >
                  {dept.slice(0, 12)} · {entry.total}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Vehicle count badge */}
      <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-white">{positions.length}</span>
          <span className="text-[10px] text-white/50">veículos</span>
        </div>
      </div>

      {/* Expand / Collapse button */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="absolute top-3 left-3 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-lg p-2 border border-white/10 hover:border-white/25 transition-all group"
        title={expanded ? 'Reduzir mapa' : 'Expandir mapa'}
      >
        {expanded ? (
          <Minimize2 className="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
        ) : (
          <Maximize2 className="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
        )}
      </button>
    </div>
  );

  // Expanded: overlay covering the full parent area
  if (expanded) {
    return (
      <>
        {/* Placeholder to keep layout stable */}
        <div className={cn("relative bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden", className)} style={{ transform: 'translateZ(0)' }} />
        {/* Expanded overlay */}
        <div
          className="fixed inset-4 z-50 bg-[#060610]/95 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
          style={{ transform: 'translateZ(0)' }}
        >
          {mapContent}
        </div>
      </>
    );
  }

  return (
    <div className={cn("relative bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden", className)} style={{ transform: 'translateZ(0)' }}>
      <div className="absolute inset-0 flex items-center justify-center">
        {mapContent}
      </div>
    </div>
  );
});
