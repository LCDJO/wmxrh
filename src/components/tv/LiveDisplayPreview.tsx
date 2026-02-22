/**
 * LiveDisplayPreview — Standalone preview of TV dashboard.
 *
 * Renders the TV dashboard UI with mock data directly (NO iframe, NO networking hooks).
 * Used by LiveDisplayAdmin to preview display content without focus/CORS issues.
 */
import { useState, useEffect } from 'react';
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
  ComplianceSummaryView,
  ExecutiveOverviewView,
} from '@/components/tv/TVRotationViews';

const TV_STYLES = `
  .tv-root { transform: translateZ(0); font-family: 'Inter', system-ui, sans-serif; }
  .tv-fade-in { animation: tvFadeIn 0.4s ease-out; }
  @keyframes tvFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes tvPulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.3); } 50% { box-shadow: 0 0 12px 4px rgba(52,211,153,0.15); } }
  .tv-pulse-glow { animation: tvPulseGlow 2s infinite; }
  @keyframes flashCritical { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .tv-flash-critical { animation: flashCritical 1.2s ease-in-out infinite; }
`;

function buildMockData(tipo: string): DisplayData {
  return {
    display: { id: 'preview', nome: 'Pré-visualização', tipo, rotacao_automatica: false, intervalo_rotacao: 30, layout_config: {} },
    timestamp: new Date().toISOString(),
    workforce: { total: 128, active: 112, inactive: 16, by_department: { Operações: 45, Logística: 30, Administrativo: 20, Manutenção: 17, Campo: 16 } },
    fleet_events: [
      { id: 'fe1', tipo: 'excesso_velocidade', descricao: 'ABC-1234 a 95km/h (limite: 80)', severidade: 'high', severity: 'high', created_at: new Date(Date.now() - 120000).toISOString() },
      { id: 'fe2', tipo: 'freada_brusca', descricao: 'Freada brusca - DEF-5678', severidade: 'medium', severity: 'medium', created_at: new Date(Date.now() - 300000).toISOString() },
      { id: 'fe3', tipo: 'desvio_rota', descricao: 'Desvio de rota - GHI-9012', severidade: 'low', severity: 'low', created_at: new Date(Date.now() - 600000).toISOString() },
      { id: 'fe4', tipo: 'excesso_velocidade', descricao: 'JKL-3456 a 110km/h (zona urbana)', severidade: 'critical', severity: 'critical', created_at: new Date(Date.now() - 60000).toISOString() },
    ],
    live_positions: [
      { device_id: 'ABC-1234', lat: -23.55, lng: -46.63, speed: 92, heading: 45 },
      { device_id: 'DEF-5678', lat: -23.56, lng: -46.65, speed: 35, heading: 180 },
      { device_id: 'GHI-9012', lat: -23.52, lng: -46.61, speed: 0, heading: 0 },
      { device_id: 'JKL-3456', lat: -23.58, lng: -46.68, speed: 110, heading: 270 },
      { device_id: 'MNO-7890', lat: -23.54, lng: -46.64, speed: 55, heading: 90 },
      { device_id: 'PQR-1122', lat: -23.57, lng: -46.66, speed: 42, heading: 135 },
      { device_id: 'STU-3344', lat: -23.53, lng: -46.62, speed: 0, heading: 0 },
      { device_id: 'VWX-5566', lat: -23.59, lng: -46.69, speed: 78, heading: 315 },
    ],
    speed_alerts: [
      { id: 'sa1', device_id: 'JKL-3456', speed: 110, limit: 60, created_at: new Date(Date.now() - 60000).toISOString() },
      { id: 'sa2', device_id: 'ABC-1234', speed: 95, limit: 80, created_at: new Date(Date.now() - 120000).toISOString() },
    ],
    nr_overdue_exams: [
      { id: 'nr1', employee_name: 'João Silva', exam_type: 'NR-35', due_date: new Date(Date.now() - 86400000).toISOString() },
      { id: 'nr2', employee_name: 'Pedro Alves', exam_type: 'NR-10', due_date: new Date(Date.now() - 172800000).toISOString() },
    ],
    active_blocks: [
      { id: 'bl1', employee_name: 'Maria Santos', reason: 'ASO vencido', blocked_at: new Date(Date.now() - 172800000).toISOString() },
      { id: 'bl2', employee_name: 'Roberto Dias', reason: 'NR-35 expirado', blocked_at: new Date(Date.now() - 86400000).toISOString() },
    ],
    sst_summary: { overdue_count: 8, critical_overdue: 3, active_blocks_count: 2 },
    recent_warnings: [
      { id: 'w1', employee_name: 'Carlos Lima', tipo: 'verbal', motivo: 'Uso indevido de EPI', created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 'w2', employee_name: 'Fernanda Reis', tipo: 'escrita', motivo: 'Excesso de velocidade reincidente', created_at: new Date(Date.now() - 7200000).toISOString() },
    ],
    compliance_incidents: [
      { id: 'ci1', tipo: 'infracao_transito', descricao: 'Multa por avanço de sinal', severity: 'high', created_at: new Date(Date.now() - 1800000).toISOString() },
      { id: 'ci2', tipo: 'documentacao', descricao: 'CNH vencida - motorista ativo', severity: 'critical', created_at: new Date(Date.now() - 3600000).toISOString() },
    ],
    compliance_summary: { total_warnings: 15, pending_incidents: 4, critical_incidents: 2 },
    executive: { operational_score: 78, legal_risk: { score: 35, level: 'medium' }, projected_cost_brl: 45000, workforce_total: 128, active_devices: 8, total_violations: 12, total_warnings: 15, total_blocks: 2 },
    risk_heatmap: {
      Operações: { fleet: 4, sst: 3, compliance: 2, workforce: 45, total: 9, headcount: 45 },
      Logística: { fleet: 6, sst: 1, compliance: 3, workforce: 30, total: 10, headcount: 30 },
      Manutenção: { fleet: 1, sst: 5, compliance: 1, workforce: 17, total: 7, headcount: 17 },
      Administrativo: { fleet: 0, sst: 1, compliance: 0, workforce: 20, total: 1, headcount: 20 },
      Campo: { fleet: 3, sst: 4, compliance: 2, workforce: 16, total: 9, headcount: 16 },
    },
    critical_alerts: [
      { id: 'ca1', message: 'CNH vencida — motorista em operação', severity: 'critical', created_at: new Date(Date.now() - 1800000).toISOString() },
      { id: 'ca2', message: 'Veículo JKL-3456: 110km/h em zona urbana', severity: 'critical', created_at: new Date(Date.now() - 60000).toISOString() },
    ],
  };
}

interface LiveDisplayPreviewProps {
  tipo: string;
  displayName?: string;
}

export default function LiveDisplayPreview({ tipo, displayName }: LiveDisplayPreviewProps) {
  const [clock, setClock] = useState(new Date());
  const [data] = useState<DisplayData>(() => buildMockData(tipo));

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const rotation = useRotationMode({
    enabled: false,
    intervalSeconds: 60,
  });

  const exec = data.executive;
  const alerts = data.critical_alerts ?? [];
  const operationalScore = exec?.operational_score ?? 0;

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
        {rotation.currentView === 'fleet_live' && <FleetLiveView data={data} />}
        {rotation.currentView === 'risk_heatmap' && <RiskHeatmapView data={data} />}
        {rotation.currentView === 'compliance_summary' && <ComplianceSummaryView data={data} />}
        {rotation.currentView === 'executive_overview' && <ExecutiveOverviewView data={data} />}
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
