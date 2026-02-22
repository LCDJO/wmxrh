import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useRiskHeatmap } from '@/domains/risk-heatmap';
import { RiskHeatmapGrid } from './RiskHeatmapGrid';
import type { HeatmapCell } from '@/domains/risk-heatmap/types';

interface RiskHeatmapPanelProps {
  tenantId: string;
  defaultBounds?: {
    lat_min: number;
    lat_max: number;
    lng_min: number;
    lng_max: number;
  };
  onCellSelect?: (cell: HeatmapCell) => void;
}

export function RiskHeatmapPanel({ tenantId, defaultBounds, onCellSelect }: RiskHeatmapPanelProps) {
  const [daysBack, setDaysBack] = useState(30);
  const [gridSize, setGridSize] = useState(20);

  const { data, isLoading, refetch, isFetching } = useRiskHeatmap({
    tenantId,
    bounds: defaultBounds,
    gridSize,
    daysBack,
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={String(daysBack)} onValueChange={(v) => setDaysBack(Number(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="14">Últimos 14 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>

        <Select value={String(gridSize)} onValueChange={(v) => setGridSize(Number(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10×10 grid</SelectItem>
            <SelectItem value="15">15×15 grid</SelectItem>
            <SelectItem value="20">20×20 grid</SelectItem>
            <SelectItem value="30">30×30 grid</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>

        {data && (
          <span className="text-xs text-muted-foreground ml-auto">
            {data.total_cells} zonas · Gerado: {new Date(data.generated_at).toLocaleTimeString('pt-BR')}
          </span>
        )}
      </div>

      <RiskHeatmapGrid
        data={data}
        isLoading={isLoading}
        onCellClick={onCellSelect}
      />
    </div>
  );
}
