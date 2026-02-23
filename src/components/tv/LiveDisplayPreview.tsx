/**
 * LiveDisplayPreview — Standalone preview of TV dashboard.
 *
 * Renders the TV dashboard UI with mock data directly (NO iframe, NO networking hooks).
 * Used by LiveDisplayAdmin to preview display content without focus/CORS issues.
 */
import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle, Wifi, BarChart3, Scale, Clock,
  RotateCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type DisplayData,
  AnimatedGauge,
  FlashingAlert,
} from '@/components/tv/TVComponents';
import { useRotationMode } from '@/hooks/useRotationMode';
import {
  FleetLiveView,
  RiskHeatmapView,
  SSTView,
  ComplianceSummaryView,
  ExecutiveOverviewView,
} from '@/components/tv/TVRotationViews';
import { buildDisplayMockData } from '@/lib/displayMockData';
import type { RotationView } from '@/hooks/useRotationMode';

/** Map display board tipo → rotation view */
const TIPO_TO_VIEW: Record<string, RotationView> = {
  fleet: 'fleet_live',
  sst: 'sst_view',
  compliance: 'compliance_summary',
  executivo: 'executive_overview',
};

const TV_STYLES = `
  .tv-root { transform: translateZ(0); font-family: 'Inter', system-ui, sans-serif; }
  .tv-fade-in { animation: tvFadeIn 0.4s ease-out; }
  @keyframes tvFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes tvPulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.3); } 50% { box-shadow: 0 0 12px 4px rgba(52,211,153,0.15); } }
  .tv-pulse-glow { animation: tvPulseGlow 2s infinite; }
  @keyframes flashCritical { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .tv-flash-critical { animation: flashCritical 1.2s ease-in-out infinite; }
`;

interface LiveDisplayPreviewProps {
  tipo: string;
  displayName?: string;
}

export default function LiveDisplayPreview({ tipo, displayName }: LiveDisplayPreviewProps) {
  const [clock, setClock] = useState(new Date());
  const [data] = useState<DisplayData>(() => buildDisplayMockData(tipo));

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const initialView = TIPO_TO_VIEW[tipo] ?? 'executive_overview';

  const rotation = useRotationMode({
    enabled: false,
    intervalSeconds: 60,
    views: [initialView],
  });

  const exec = data.executive;
  const alerts = data.critical_alerts ?? [];
  const operationalScore = exec?.operational_score ?? 0;

  // Render the correct view based on tipo
  const renderView = () => {
    switch (initialView) {
      case 'fleet_live': return <FleetLiveView data={data} />;
      case 'risk_heatmap': return <RiskHeatmapView data={data} />;
      case 'sst_view': return <SSTView data={data} />;
      case 'compliance_summary': return <ComplianceSummaryView data={data} />;
      case 'executive_overview': return <ExecutiveOverviewView data={data} />;
      default: return <ExecutiveOverviewView data={data} />;
    }
  };

  return (
    <div className="h-full w-full bg-[#060610] text-white overflow-hidden flex flex-col tv-root" style={{ minHeight: 400 }}>
      <style>{TV_STYLES}</style>

      {/* HEADER */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-500/15 tv-pulse-glow">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">DEMO</span>
          </div>
          <h1 className="text-sm font-bold text-white/90 tracking-tight">{displayName ?? data.display.nome}</h1>
        </div>

        <div className="text-center">
          <p className="text-lg font-bold text-white tabular-nums tracking-tight">
            {format(clock, 'HH:mm:ss')}
          </p>
          <p className="text-[9px] text-white/40 uppercase tracking-wider">
            {format(clock, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {exec && (
            <AnimatedGauge
              title="Score"
              icon={BarChart3}
              value={operationalScore}
              maxValue={100}
              label={operationalScore >= 80 ? 'Excelente' : operationalScore >= 60 ? 'Bom' : 'Atenção'}
              unit="pts"
              compact
            />
          )}
        </div>
      </header>

      {/* ALERTS */}
      {alerts.length > 0 && (
        <div className="px-4 py-1.5 shrink-0">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 flex items-center gap-3 overflow-x-auto">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 tv-flash-critical" />
            <div className="flex gap-2 min-w-0">
              {alerts.slice(0, 3).map((alert: any, i: number) => (
                <FlashingAlert key={alert.id ?? i} alert={alert} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 flex gap-3 px-4 py-2 min-h-0">
        {renderView()}
      </main>

      {/* FOOTER */}
      <footer className="flex items-center justify-between px-4 py-1.5 border-t border-white/5 shrink-0 text-[9px] text-white/25">
        <div className="flex items-center gap-2">
          <Wifi className="h-3 w-3 text-emerald-400/60" />
          <span>Modo Demonstração</span>
        </div>
        <span>Display Engine v2.0</span>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{format(clock, 'HH:mm:ss')}</span>
        </div>
      </footer>
    </div>
  );
}
