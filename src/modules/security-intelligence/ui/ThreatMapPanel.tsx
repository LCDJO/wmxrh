/**
 * ThreatMapPanel — Map displaying suspicious login origins with color-coded markers.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import type { SecurityAlertRecord } from '../hooks/useSecurityAlerts';

interface Props { alerts: SecurityAlertRecord[] }

const WIDTH = 800;
const HEIGHT = 400;

function toMercator(lat: number, lon: number): [number, number] {
  const x = ((lon + 180) / 360) * WIDTH;
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = HEIGHT / 2 - (mercN * WIDTH) / (2 * Math.PI);
  return [x, y];
}

export function ThreatMapPanel({ alerts }: Props) {
  const points = useMemo(() => {
    // Try to extract lat/lon from metadata, or skip
    return alerts
      .filter(a => a.metadata)
      .map(a => {
        const meta = a.metadata as any;
        const lat = meta?.latitude ?? null;
        const lon = meta?.longitude ?? null;
        // Fallback: try to parse from location string
        return {
          alert: a,
          lat,
          lon,
          hasGeo: lat != null && lon != null,
        };
      })
      .filter(p => p.hasGeo);
  }, [alerts]);

  const riskColor = (level: string) => {
    if (level === 'HIGH') return '#ef4444';
    if (level === 'MEDIUM') return '#f59e0b';
    return '#22c55e';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-destructive" /> Mapa de Ameaças
          <Badge variant="secondary" className="text-xs ml-auto">{alerts.length} alertas</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative bg-muted/30 rounded-lg overflow-hidden border border-border/30">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto">
            {/* Simple world outline */}
            <rect fill="hsl(var(--muted) / 0.3)" width={WIDTH} height={HEIGHT} />
            {/* Grid lines */}
            {Array.from({ length: 7 }, (_, i) => (
              <line key={`h${i}`} x1={0} y1={HEIGHT * i / 6} x2={WIDTH} y2={HEIGHT * i / 6}
                stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="4,4" opacity={0.3} />
            ))}
            {Array.from({ length: 13 }, (_, i) => (
              <line key={`v${i}`} x1={WIDTH * i / 12} y1={0} x2={WIDTH * i / 12} y2={HEIGHT}
                stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="4,4" opacity={0.3} />
            ))}
            {/* Threat points */}
            {points.map((p, i) => {
              const [x, y] = toMercator(p.lat!, p.lon!);
              const color = riskColor(p.alert.risk_level);
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r={8} fill={color} opacity={0.15}>
                    <animate attributeName="r" values="8;14;8" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={x} cy={y} r={4} fill={color} opacity={0.8} />
                  <title>{`${p.alert.title}\n${p.alert.location ?? ''}\nScore: ${p.alert.risk_score}`}</title>
                </g>
              );
            })}
            {/* Legend */}
            <g transform={`translate(${WIDTH - 120}, ${HEIGHT - 50})`}>
              <rect x={0} y={0} width={110} height={45} rx={4} fill="hsl(var(--background))" opacity={0.8} />
              <circle cx={12} cy={12} r={4} fill="#ef4444" />
              <text x={22} y={16} fontSize={9} fill="currentColor">Alto Risco</text>
              <circle cx={12} cy={27} r={4} fill="#f59e0b" />
              <text x={22} y={31} fontSize={9} fill="currentColor">Médio Risco</text>
              <circle cx={12} cy={42} r={4} fill="#22c55e" />
              <text x={22} y={46} fontSize={9} fill="currentColor">Baixo</text>
            </g>
          </svg>
          {points.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Sem dados geográficos de ameaças</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
