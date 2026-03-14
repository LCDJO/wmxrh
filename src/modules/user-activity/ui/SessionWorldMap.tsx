/**
 * SessionWorldMap — SVG-based world map showing session locations as dots.
 * Uses Mercator projection. No external map library needed.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import type { SessionRecord } from '../hooks/useActiveSessions';

interface Props { sessions: SessionRecord[] }

// Simple Mercator projection to SVG coords (800x400 viewBox)
function project(lat: number, lon: number): [number, number] {
  const x = ((lon + 180) / 360) * 800;
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = 200 - (mercN / Math.PI) * 200;
  return [x, Math.max(0, Math.min(400, y))];
}

const statusColors: Record<string, string> = {
  online: '#10b981',
  idle: '#f59e0b',
  offline: '#6b7280',
};

export function SessionWorldMap({ sessions }: Props) {
  const geoSessions = useMemo(
    () => sessions.filter(s => s.latitude != null && s.longitude != null),
    [sessions]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" /> Mapa de Sessões
          <span className="text-xs text-muted-foreground ml-2">{geoSessions.length} geolocalizadas</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className="relative bg-muted/20 rounded-lg overflow-hidden border border-border/30">
          <svg viewBox="0 0 800 400" className="w-full h-auto" style={{ minHeight: 220 }}>
            {/* Simple world outline — just grid lines for reference */}
            <defs>
              <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="hsl(var(--border))" strokeWidth="0.3" opacity="0.4" />
              </pattern>
            </defs>
            <rect width="800" height="400" fill="url(#grid)" rx="8" />

            {/* Equator & Prime Meridian */}
            <line x1="0" y1="200" x2="800" y2="200" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.5" />
            <line x1="400" y1="0" x2="400" y2="400" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.5" />

            {/* Session dots */}
            {geoSessions.map((s) => {
              const [x, y] = project(s.latitude!, s.longitude!);
              const color = statusColors[s.status] ?? statusColors.offline;
              return (
                <g key={s.id}>
                  {/* Glow */}
                  <circle cx={x} cy={y} r="8" fill={color} opacity="0.15" />
                  {/* Dot */}
                  <circle cx={x} cy={y} r="3" fill={color} stroke="hsl(var(--background))" strokeWidth="1">
                    <title>
                      {[s.city, s.country].filter(Boolean).join(', ')} — {s.status} — {s.ip_address}
                    </title>
                  </circle>
                  {/* Pulse for online */}
                  {s.status === 'online' && (
                    <circle cx={x} cy={y} r="3" fill="none" stroke={color} strokeWidth="1" opacity="0.6">
                      <animate attributeName="r" from="3" to="12" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground justify-center">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Online</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Idle</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground" /> Offline</span>
        </div>
      </CardContent>
    </Card>
  );
}
