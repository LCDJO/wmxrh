/**
 * SessionLeafletMap — Interactive map using Leaflet with session markers.
 * Shows pulsing dots for online sessions, colored by status.
 */
import { useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import type { SessionRecord } from '../hooks/useActiveSessions';

import 'leaflet/dist/leaflet.css';

interface Props { sessions: SessionRecord[] }

const statusColors: Record<string, string> = {
  online: '#10b981',
  idle: '#f59e0b',
  offline: '#6b7280',
};

const WORLD_BOUNDS = [[-85, -180], [85, 180]] as const;
const DEFAULT_CENTER: [number, number] = [-15, -50];
const DEFAULT_ZOOM = 3;

export function SessionLeafletMap({ sessions }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const geoSessions = useMemo(
    () => sessions.filter(s => s.latitude != null && s.longitude != null),
    [sessions]
  );

  useEffect(() => {
    if (!mapRef.current) return;

    import('leaflet').then((L) => {
      if (mapInstanceRef.current) {
        updateMarkers(L, geoSessions);
        return;
      }

      const map = L.map(mapRef.current!, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        minZoom: 2,
        maxZoom: 6,
        zoomControl: true,
        attributionControl: false,
        worldCopyJump: false,
        maxBounds: WORLD_BOUNDS,
        maxBoundsViscosity: 1,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 6,
        minZoom: 2,
        noWrap: true,
        bounds: WORLD_BOUNDS,
      }).addTo(map);

      mapInstanceRef.current = map;
      updateMarkers(L, geoSessions);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import('leaflet').then((L) => {
      updateMarkers(L, geoSessions);
    });
  }, [geoSessions]);

  function updateMarkers(L: any, sessions: SessionRecord[]) {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    sessions.forEach(s => {
      const color = statusColors[s.status] ?? statusColors.offline;
      const isSuspicious = (s as any).is_suspicious || s.is_vpn;

      const icon = L.divIcon({
        className: 'custom-session-marker',
        html: `
          <div style="position:relative;width:16px;height:16px;">
            <div style="
              width:12px;height:12px;border-radius:50%;
              background:${isSuspicious ? '#ef4444' : color};
              border:2px solid rgba(255,255,255,0.8);
              box-shadow:0 0 8px ${isSuspicious ? '#ef4444' : color}60;
            "></div>
            ${s.status === 'online' ? `
              <div style="
                position:absolute;top:-2px;left:-2px;
                width:16px;height:16px;border-radius:50%;
                border:2px solid ${color};
                animation:pulse 2s infinite;
                opacity:0.5;
              "></div>
            ` : ''}
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([s.latitude!, s.longitude!], { icon })
        .bindPopup(`
          <div style="font-size:12px;min-width:180px;">
            <strong>${s.tenant_name ?? (s.source === 'history' ? 'Login recente' : 'Sem Tenant')}</strong><br/>
            <span style="color:#888">User: ${s.user_id.slice(0, 8)}...</span><br/>
            <hr style="margin:4px 0;border-color:#333;"/>
            📍 ${[s.city, s.state, s.country].filter(Boolean).join(', ')}<br/>
            🌐 ${s.ip_address ?? '—'}<br/>
            💻 ${s.browser ?? '—'} ${s.browser_version?.split('.')[0] ?? ''} • ${s.os ?? '—'}<br/>
            📱 ${s.device_type ?? '—'}<br/>
            ${s.is_vpn ? '🛡️ <strong style="color:#f59e0b">VPN</strong><br/>' : ''}
            ${isSuspicious ? '⚠️ <strong style="color:#ef4444">Suspeito</strong><br/>' : ''}
            <span style="color:#888">${s.login_method ?? 'password'}${s.sso_provider ? ` (${s.sso_provider})` : ''}</span>
          </div>
        `)
        .addTo(map);

      markersRef.current.push(marker);
    });

    if (sessions.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: false });
      return;
    }

    const bounds = L.latLngBounds(sessions.map((session) => [session.latitude!, session.longitude!]));
    if (!bounds.isValid()) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: false });
      return;
    }

    if (sessions.length === 1) {
      map.setView(bounds.getCenter(), 4, { animate: false });
      return;
    }

    map.fitBounds(bounds.pad(0.35), {
      padding: [24, 24],
      maxZoom: 4,
      animate: false,
    });
  }

  const onlineCount = geoSessions.filter(s => s.status === 'online').length;
  const suspiciousCount = geoSessions.filter(s => (s as any).is_suspicious || s.is_vpn).length;
  const usingHistoryFallback = geoSessions.some(session => session.source === 'history');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" /> Mapa Global de Logins
          <Badge variant="secondary" className="text-[10px] ml-auto">{geoSessions.length} pontos</Badge>
          {usingHistoryFallback && (
            <Badge variant="outline" className="text-[10px]">histórico recente</Badge>
          )}
          {suspiciousCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">{suspiciousCount} suspeitas</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <style>{`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 0.5; }
            100% { transform: scale(2.5); opacity: 0; }
          }
          .custom-session-marker { background: transparent !important; border: none !important; }
          .leaflet-popup-content-wrapper { background: hsl(var(--card)); color: hsl(var(--card-foreground)); border: 1px solid hsl(var(--border)); }
          .leaflet-popup-tip { background: hsl(var(--card)); }
        `}</style>
        <div ref={mapRef} className="w-full rounded-lg overflow-hidden border border-border/30" style={{ height: 420 }} />
        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground justify-center flex-wrap">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Online ({onlineCount})</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Idle</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground" /> Offline</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" /> Suspeito</span>
        </div>
      </CardContent>
    </Card>
  );
}
