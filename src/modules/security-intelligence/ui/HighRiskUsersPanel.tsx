/**
 * HighRiskUsersPanel — Lists users with highest cumulative risk.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, User } from 'lucide-react';
import type { SecurityAlertRecord } from '../hooks/useSecurityAlerts';

interface Props { alerts: SecurityAlertRecord[] }

interface UserRisk {
  user_id: string;
  alert_count: number;
  max_score: number;
  high_count: number;
  latest_alert: string;
  locations: string[];
}

export function HighRiskUsersPanel({ alerts }: Props) {
  const users = useMemo<UserRisk[]>(() => {
    const map = new Map<string, UserRisk>();
    for (const a of alerts) {
      const existing = map.get(a.user_id) ?? {
        user_id: a.user_id,
        alert_count: 0,
        max_score: 0,
        high_count: 0,
        latest_alert: a.created_at,
        locations: [],
      };
      existing.alert_count++;
      existing.max_score = Math.max(existing.max_score, a.risk_score);
      if (a.risk_level === 'HIGH') existing.high_count++;
      if (a.location && !existing.locations.includes(a.location)) existing.locations.push(a.location);
      if (a.created_at > existing.latest_alert) existing.latest_alert = a.created_at;
      map.set(a.user_id, existing);
    }
    return [...map.values()].sort((a, b) => b.max_score - a.max_score || b.alert_count - a.alert_count).slice(0, 20);
  }, [alerts]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" /> Usuários de Alto Risco
          <Badge variant="secondary" className="text-xs ml-auto">{users.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[320px]">
          {users.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Nenhum usuário de alto risco</div>
          ) : (
            <div className="space-y-1.5">
              {users.map(u => (
                <div key={u.user_id} className="flex items-center gap-3 p-2 rounded border border-border/30 hover:bg-muted/20 transition-colors">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-[10px]">{u.user_id.slice(0, 12)}</span>
                      <Badge variant={u.max_score >= 60 ? 'destructive' : 'secondary'} className="text-[8px] h-4">
                        Score: {u.max_score}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {u.alert_count} alertas • {u.high_count} alto risco • {u.locations.slice(0, 2).join(', ') || '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
