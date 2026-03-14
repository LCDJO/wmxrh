/**
 * SecurityAlertsPanel — Detects and displays suspicious session patterns:
 *  - VPN/Proxy sessions
 *  - Concurrent logins from different IPs
 *  - Unusual countries
 *  - Sessions with no geolocation
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Shield, Eye, MapPinOff, Globe } from 'lucide-react';
import type { SessionRecord } from '../hooks/useActiveSessions';

interface Alert {
  id: string;
  type: 'vpn' | 'concurrent' | 'no_geo' | 'unusual_country';
  severity: 'high' | 'medium' | 'low';
  message: string;
  session: SessionRecord;
}

interface Props { sessions: SessionRecord[] }

export function SecurityAlertsPanel({ sessions }: Props) {
  const alerts = useMemo<Alert[]>(() => {
    const result: Alert[] = [];
    const onlineSessions = sessions.filter(s => s.status === 'online' || s.status === 'idle');

    // 1. VPN/Proxy
    for (const s of onlineSessions) {
      if (s.is_vpn || s.is_proxy) {
        result.push({
          id: `vpn-${s.id}`,
          type: 'vpn',
          severity: 'medium',
          message: `Sessão via ${s.is_vpn ? 'VPN' : 'Proxy'} — ${s.ip_address} (${s.city ?? '?'}, ${s.country ?? '?'})`,
          session: s,
        });
      }
    }

    // 2. Concurrent logins from different IPs
    const userIps = new Map<string, SessionRecord[]>();
    for (const s of onlineSessions) {
      const existing = userIps.get(s.user_id) ?? [];
      existing.push(s);
      userIps.set(s.user_id, existing);
    }
    for (const [, userSessions] of userIps) {
      const uniqueIps = new Set(userSessions.filter(s => s.ip_address).map(s => s.ip_address));
      if (uniqueIps.size > 1) {
        result.push({
          id: `concurrent-${userSessions[0].user_id}`,
          type: 'concurrent',
          severity: 'high',
          message: `Logins simultâneos de ${uniqueIps.size} IPs diferentes — user ${userSessions[0].user_id.slice(0, 8)}`,
          session: userSessions[0],
        });
      }
    }

    // 3. No geolocation
    for (const s of onlineSessions) {
      if (!s.latitude && !s.longitude && !s.country) {
        result.push({
          id: `nogeo-${s.id}`,
          type: 'no_geo',
          severity: 'low',
          message: `Sessão sem geolocalização — ${s.ip_address ?? 'IP desconhecido'}`,
          session: s,
        });
      }
    }

    return result.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.severity] - order[b.severity];
    });
  }, [sessions]);

  const alertIcons: Record<string, typeof Shield> = {
    vpn: Eye,
    concurrent: AlertTriangle,
    no_geo: MapPinOff,
    unusual_country: Globe,
  };

  const severityVariants: Record<string, 'destructive' | 'secondary' | 'outline'> = {
    high: 'destructive',
    medium: 'secondary',
    low: 'outline',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-destructive" /> Alertas de Segurança
          {alerts.length > 0 && (
            <Badge variant="destructive" className="text-[10px]">{alerts.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[320px]">
          {alerts.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Shield className="h-8 w-8 mx-auto mb-2 text-emerald-500/40" />
              Nenhuma ameaça detectada
            </div>
          ) : (
            <div className="space-y-1.5">
              {alerts.map(a => {
                const Icon = alertIcons[a.type] ?? AlertTriangle;
                return (
                  <div key={a.id} className="flex items-start gap-2 text-xs p-2 rounded border border-border/30 hover:bg-muted/20 transition-colors">
                    <Icon className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground">{a.message}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {a.session.tenant_name ?? 'Sem Tenant'} • {a.session.browser} • {a.session.os}
                      </div>
                    </div>
                    <Badge variant={severityVariants[a.severity]} className="text-[8px] h-4 shrink-0">
                      {a.severity}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
