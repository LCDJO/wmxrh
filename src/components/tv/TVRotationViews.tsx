/**
 * TV Rotation Views — Individual dashboard panels for rotation mode.
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Shield, Users, BarChart3, Scale,
  Car, Zap, Lock, FileWarning, Heart, Activity,
  TrendingUp, DollarSign, ShieldAlert,
} from 'lucide-react';
import type { DisplayData } from './TVComponents';
import {
  KpiTile, TVCard, AnimatedGauge,
  TopInfractions, BlockedEmployees, RecentWarnings,
  useAnimatedNumber,
} from './TVComponents';
import { TVMapCenter } from './TVMapCenter';

// ── 1. Fleet Live ──
export const FleetLiveView = memo(function FleetLiveView({ data }: { data: DisplayData }) {
  const positions = data.live_positions ?? [];
  const fleetEvents = data.fleet_events ?? [];
  const speedAlerts = data.speed_alerts ?? [];
  const exec = data.executive;

  return (
    <div className="flex-1 flex gap-4 min-h-0 tv-fade-in">
      <TVMapCenter positions={positions} heatmap={data.risk_heatmap} className="flex-1" />
      <aside className="w-80 2xl:w-96 shrink-0 flex flex-col gap-3 min-h-0">
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <KpiTile icon={Car} label="Veículos" value={positions.length} sub="Rastreados" color="text-sky-400" />
          <KpiTile icon={Zap} label="Infrações" value={exec?.total_violations ?? fleetEvents.length} sub="Hoje" color="text-amber-400" />
        </div>
        <TVCard title="Top Infrações do Dia" icon={Zap} className="flex-1 min-h-0 overflow-hidden">
          <TopInfractions events={[...fleetEvents, ...speedAlerts].sort((a: any, b: any) => {
            const sev: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
            return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3);
          })} />
        </TVCard>
        <TVCard title="Alertas de Velocidade" icon={AlertTriangle} className="shrink-0 max-h-[30%] overflow-hidden">
          {speedAlerts.length === 0 ? (
            <p className="text-white/30 text-[10px] text-center py-3">Sem alertas de velocidade</p>
          ) : (
            <div className="space-y-1.5 overflow-y-auto max-h-full">
              {speedAlerts.slice(0, 5).map((a: any, i: number) => (
                <div key={a.id ?? i} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0 tv-slide-up">
                  <span className="text-xs text-white/70 truncate">{a.device_id ?? 'Veículo'}</span>
                  <span className="text-xs font-bold text-red-400">{a.speed ?? '?'} km/h</span>
                </div>
              ))}
            </div>
          )}
        </TVCard>
      </aside>
    </div>
  );
});

// ── 2. Risk Heatmap ──
export const RiskHeatmapView = memo(function RiskHeatmapView({ data }: { data: DisplayData }) {
  const heatmap = data.risk_heatmap ?? {};
  const entries = Object.entries(heatmap).sort(([, a], [, b]) => b.total - a.total);

  return (
    <div className="flex-1 flex gap-4 min-h-0 tv-fade-in">
      <TVMapCenter positions={data.live_positions ?? []} heatmap={heatmap} className="flex-1" />
      <aside className="w-80 2xl:w-96 shrink-0 flex flex-col gap-3 min-h-0">
        <TVCard title="Ranking de Risco" icon={ShieldAlert} className="flex-1 min-h-0 overflow-hidden">
          {entries.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-6">Sem dados de risco</p>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-full">
              {entries.slice(0, 10).map(([dept, entry], i) => (
                <div key={dept} className="tv-slide-up">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/70 truncate">{dept}</span>
                    <span className={cn(
                      "text-xs font-bold",
                      entry.total >= 70 ? "text-red-400" :
                      entry.total >= 40 ? "text-orange-400" :
                      entry.total >= 20 ? "text-amber-400" : "text-emerald-400"
                    )}>{entry.total}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        entry.total >= 70 ? "bg-red-500" :
                        entry.total >= 40 ? "bg-orange-500" :
                        entry.total >= 20 ? "bg-amber-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.min(entry.total, 100)}%` }}
                    />
                  </div>
                  <div className="flex gap-3 mt-0.5 text-[9px] text-white/30">
                    <span>Frota: {entry.fleet}</span>
                    <span>SST: {entry.sst}</span>
                    <span>Comp: {entry.compliance}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TVCard>
      </aside>
    </div>
  );
});

// ── 3. Compliance Summary ──
export const ComplianceSummaryView = memo(function ComplianceSummaryView({ data }: { data: DisplayData }) {
  const blocks = data.active_blocks ?? [];
  const warnings = data.recent_warnings ?? [];
  const incidents = data.compliance_incidents ?? [];
  const summary = data.compliance_summary;
  const sst = data.sst_summary;

  return (
    <div className="flex-1 flex gap-4 min-h-0 tv-fade-in">
      {/* Left: KPIs and gauges */}
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        <div className="grid grid-cols-4 gap-3 shrink-0">
          <KpiTile icon={FileWarning} label="Advertências" value={summary?.total_warnings ?? warnings.length} sub="Total" color="text-amber-400" />
          <KpiTile icon={ShieldAlert} label="Incidentes" value={summary?.pending_incidents ?? incidents.length} sub="Pendentes" color="text-orange-400" />
          <KpiTile icon={Lock} label="Bloqueios" value={sst?.active_blocks_count ?? blocks.length} sub="Ativos" color="text-red-400" />
          <KpiTile icon={Heart} label="Exames SST" value={sst?.overdue_count ?? 0} sub="Vencidos" color={sst?.critical_overdue ? "text-red-400" : "text-amber-400"} />
        </div>
        <TVCard title="Incidentes Recentes" icon={ShieldAlert} className="flex-1 min-h-0 overflow-hidden">
          {incidents.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-6">Nenhum incidente recente</p>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-full">
              {incidents.slice(0, 8).map((inc: any, i: number) => (
                <div key={inc.id ?? i} className="bg-white/5 rounded-lg p-2.5 border border-white/5 tv-slide-up">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/80">{inc.incident_type ?? 'Incidente'}</span>
                    <span className={cn("text-[9px] font-bold uppercase",
                      inc.severity === 'critical' ? "text-red-400" :
                      inc.severity === 'high' ? "text-orange-400" : "text-amber-400"
                    )}>{inc.severity ?? 'N/I'}</span>
                  </div>
                  <p className="text-[10px] text-white/40 truncate mt-0.5">{inc.description ?? ''}</p>
                </div>
              ))}
            </div>
          )}
        </TVCard>
      </div>

      {/* Right: Blocked + Warnings */}
      <aside className="w-72 2xl:w-80 shrink-0 flex flex-col gap-3 min-h-0">
        <TVCard title="Bloqueados" icon={Lock} className="flex-1 min-h-0 overflow-hidden">
          <BlockedEmployees blocks={blocks} />
        </TVCard>
        <TVCard title="Advertências" icon={FileWarning} className="flex-1 min-h-0 overflow-hidden">
          <RecentWarnings warnings={warnings} />
        </TVCard>
      </aside>
    </div>
  );
});

// ── 4. Executive Overview ──
export const ExecutiveOverviewView = memo(function ExecutiveOverviewView({ data }: { data: DisplayData }) {
  const exec = data.executive;
  const workforce = data.workforce;

  if (!exec) {
    return (
      <div className="flex-1 flex items-center justify-center tv-fade-in">
        <p className="text-white/30 text-lg">Dados executivos não disponíveis</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 tv-fade-in">
      {/* Top: Gauges */}
      <div className="flex items-center justify-center gap-12 shrink-0 py-4">
        <AnimatedGauge
          title="Score Operacional"
          icon={BarChart3}
          value={exec.operational_score}
          maxValue={100}
          label={exec.operational_score >= 80 ? 'Excelente' : exec.operational_score >= 60 ? 'Bom' : exec.operational_score >= 40 ? 'Atenção' : 'Crítico'}
          unit="pts"
        />
        <AnimatedGauge
          title="Risco Jurídico"
          icon={Scale}
          value={exec.legal_risk.score}
          maxValue={100}
          label={exec.legal_risk.level === 'critical' ? 'Crítico' : exec.legal_risk.level === 'high' ? 'Alto' : 'Controlado'}
          unit="risco"
          invertColor
        />
      </div>

      {/* Bottom: KPI Grid */}
      <div className="grid grid-cols-3 2xl:grid-cols-6 gap-3 flex-1">
        <KpiTile icon={Users} label="Workforce" value={exec.workforce_total} sub="Colaboradores" color="text-sky-400" />
        <KpiTile icon={Activity} label="Dispositivos" value={exec.active_devices} sub="Ativos" color="text-emerald-400" />
        <KpiTile icon={AlertTriangle} label="Violações" value={exec.total_violations} sub="Hoje" color="text-amber-400" />
        <KpiTile icon={FileWarning} label="Advertências" value={exec.total_warnings} sub="Total" color="text-orange-400" />
        <KpiTile icon={Lock} label="Bloqueios" value={exec.total_blocks} sub="Ativos" color="text-red-400" />
        <KpiTile icon={DollarSign} label="Custo Projetado" value={exec.projected_cost_brl} sub="R$ mensal" color="text-violet-400" isCurrency />
      </div>

      {/* Workforce by department */}
      {workforce && Object.keys(workforce.by_department).length > 0 && (
        <TVCard title="Workforce por Departamento" icon={Users} className="shrink-0">
          <div className="flex gap-3 flex-wrap">
            {Object.entries(workforce.by_department)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([dept, count]) => (
                <div key={dept} className="bg-white/5 rounded-lg px-3 py-1.5 border border-white/5">
                  <span className="text-[10px] text-white/40 block">{dept}</span>
                  <span className="text-sm font-bold text-white">{count}</span>
                </div>
              ))}
          </div>
        </TVCard>
      )}
    </div>
  );
});
