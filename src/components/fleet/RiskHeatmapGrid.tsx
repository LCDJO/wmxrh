import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, MapPin, Activity, Shield, TrendingUp } from 'lucide-react';
import type { HeatmapData, HeatmapCell, RiskLevel } from '@/domains/risk-heatmap/types';
import { RISK_COLORS, RISK_LABELS } from '@/domains/risk-heatmap/types';

interface RiskHeatmapGridProps {
  data: HeatmapData | undefined;
  isLoading?: boolean;
  onCellClick?: (cell: HeatmapCell) => void;
}

function getRiskBg(level: RiskLevel): string {
  switch (level) {
    case 'critical': return 'bg-red-500/80';
    case 'high': return 'bg-orange-500/70';
    case 'medium': return 'bg-yellow-400/60';
    case 'low': return 'bg-green-500/40';
    default: return 'bg-muted/20';
  }
}

function getRiskBorder(level: RiskLevel): string {
  switch (level) {
    case 'critical': return 'ring-2 ring-red-500 ring-offset-1';
    case 'high': return 'ring-1 ring-orange-400';
    default: return '';
  }
}

export function RiskHeatmapGrid({ data, isLoading, onCellClick }: RiskHeatmapGridProps) {
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);

  const gridCells = useMemo(() => {
    if (!data?.cells) return [];
    return data.cells;
  }, [data]);

  // Build grid matrix
  const gridSize = data?.grid_size ?? 20;
  const gridMatrix = useMemo(() => {
    const matrix: (HeatmapCell | null)[][] = Array.from(
      { length: gridSize },
      () => Array(gridSize).fill(null)
    );

    if (!data?.cells || !data.bounds) return matrix;

    const { lat_min, lat_max, lng_min, lng_max } = data.bounds;
    const latStep = (lat_max - lat_min) / gridSize;
    const lngStep = (lng_max - lng_min) / gridSize;

    data.cells.forEach((cell) => {
      const row = Math.min(gridSize - 1, Math.max(0, Math.floor((cell.lat - lat_min) / latStep)));
      const col = Math.min(gridSize - 1, Math.max(0, Math.floor((cell.lng - lng_min) / lngStep)));
      matrix[row][col] = cell;
    });

    return matrix;
  }, [data, gridSize]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-80">
          <div className="flex flex-col items-center gap-3">
            <Activity className="h-8 w-8 animate-pulse text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Calculando mapa de risco...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || gridCells.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-80">
          <div className="flex flex-col items-center gap-3">
            <MapPin className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Sem dados de risco para exibir</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Zonas Críticas"
          value={data.summary.critical_zones}
          color="text-red-500"
        />
        <SummaryCard
          icon={<Shield className="h-4 w-4" />}
          label="Alto Risco"
          value={data.summary.high_risk_zones}
          color="text-orange-500"
        />
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Incidentes"
          value={data.summary.total_incidents}
          color="text-yellow-500"
        />
        <SummaryCard
          icon={<Activity className="h-4 w-4" />}
          label="Eventos"
          value={data.summary.total_behavior_events}
          color="text-blue-500"
        />
      </div>

      {/* Heatmap Grid */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Mapa de Calor — Risco Ocupacional</CardTitle>
            <div className="flex items-center gap-2">
              {(['low', 'medium', 'high', 'critical'] as RiskLevel[]).map((level) => (
                <div key={level} className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: RISK_COLORS[level] }}
                  />
                  <span className="text-xs text-muted-foreground">{RISK_LABELS[level]}</span>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TooltipProvider delayDuration={100}>
            <div
              className="grid gap-[2px] w-full aspect-square max-w-[600px] mx-auto"
              style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
            >
              {gridMatrix.map((row, rowIdx) =>
                row.map((cell, colIdx) => (
                  <TooltipTrigger key={`${rowIdx}-${colIdx}`} asChild>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className={`
                            aspect-square rounded-[2px] transition-all duration-150
                            hover:scale-125 hover:z-10 relative
                            ${cell ? getRiskBg(cell.risk_level) : 'bg-muted/10'}
                            ${cell ? getRiskBorder(cell.risk_level) : ''}
                            ${selectedCell?.lat === cell?.lat && selectedCell?.lng === cell?.lng
                              ? 'ring-2 ring-primary scale-125 z-10'
                              : ''
                            }
                          `}
                          style={{
                            opacity: cell ? Math.max(0.3, cell.risk_intensity) : 0.05,
                          }}
                          onClick={() => {
                            if (cell) {
                              setSelectedCell(cell);
                              onCellClick?.(cell);
                            }
                          }}
                        />
                      </TooltipTrigger>
                      {cell && (
                        <TooltipContent side="top" className="max-w-[220px]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-[10px]"
                                style={{ borderColor: RISK_COLORS[cell.risk_level], color: RISK_COLORS[cell.risk_level] }}
                              >
                                {RISK_LABELS[cell.risk_level]}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {(cell.risk_intensity * 100).toFixed(0)}%
                              </span>
                            </div>
                            <p className="text-[11px]">
                              📍 {cell.lat.toFixed(4)}, {cell.lng.toFixed(4)}
                            </p>
                            <p className="text-[11px]">
                              🚨 {cell.incidents} incidentes · {cell.behavior_events} infrações
                            </p>
                            <p className="text-[11px]">
                              ⚡ Vel. máx: {cell.max_speed} km/h
                            </p>
                          </div>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipTrigger>
                ))
              )}
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Selected Cell Detail */}
      {selectedCell && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Detalhes da Zona — {selectedCell.lat.toFixed(4)}, {selectedCell.lng.toFixed(4)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <DetailItem label="Nível de Risco">
                <Badge
                  variant="outline"
                  style={{ borderColor: RISK_COLORS[selectedCell.risk_level], color: RISK_COLORS[selectedCell.risk_level] }}
                >
                  {RISK_LABELS[selectedCell.risk_level]}
                </Badge>
              </DetailItem>
              <DetailItem label="Intensidade">
                {(selectedCell.risk_intensity * 100).toFixed(1)}%
              </DetailItem>
              <DetailItem label="Velocidade Média">
                {selectedCell.avg_speed} km/h
              </DetailItem>
              <DetailItem label="Velocidade Máxima">
                {selectedCell.max_speed} km/h
              </DetailItem>
              <DetailItem label="Eventos Rastreamento">
                {selectedCell.tracking_events}
              </DetailItem>
              <DetailItem label="Infrações Comportamento">
                {selectedCell.behavior_events}
              </DetailItem>
              <DetailItem label="Incidentes Compliance">
                {selectedCell.incidents}
              </DetailItem>
              <DetailItem label="Severidade">
                <div className="flex gap-1 text-[11px]">
                  <span className="text-green-500">{selectedCell.severity_breakdown.low}B</span>
                  <span className="text-yellow-500">{selectedCell.severity_breakdown.medium}M</span>
                  <span className="text-orange-500">{selectedCell.severity_breakdown.high}A</span>
                  <span className="text-red-500">{selectedCell.severity_breakdown.critical}C</span>
                </div>
              </DetailItem>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Clusters */}
      {data.clusters.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Clusters de Risco ({data.clusters.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.clusters.map((cluster) => (
                <div
                  key={cluster.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: RISK_COLORS[cluster.risk_level] }}
                    />
                    <span className="text-sm font-mono">
                      {cluster.lat.toFixed(4)}, {cluster.lng.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{cluster.incidents} incid.</span>
                    <span>{cluster.behavior_events} infr.</span>
                    <Badge
                      variant="outline"
                      className="text-[10px]"
                      style={{ borderColor: RISK_COLORS[cluster.risk_level], color: RISK_COLORS[cluster.risk_level] }}
                    >
                      {(cluster.risk_intensity * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={color}>{icon}</div>
        <div>
          <p className="text-lg font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}
