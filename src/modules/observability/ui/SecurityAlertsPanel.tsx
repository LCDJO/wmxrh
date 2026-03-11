/**
 * SecurityAlertsPanel — Displays login security alerts:
 *  - Simultaneous sessions
 *  - Unusual country logins
 *  - Impossible travel detection
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert, AlertTriangle, Globe, Users, Zap, RefreshCw,
} from 'lucide-react';
import {
  fetchActiveSessions,
  fetchRecentSessions,
  analyzeLoginSecurity,
  usePresenceRealtime,
} from '@/domains/user-presence';
import type { SecurityAlert } from '@/domains/user-presence';

const typeIcons: Record<string, React.ReactNode> = {
  simultaneous_sessions: <Users className="h-4 w-4 text-amber-500" />,
  unusual_country: <Globe className="h-4 w-4 text-blue-500" />,
  impossible_travel: <Zap className="h-4 w-4 text-destructive" />,
};

const typeLabels: Record<string, string> = {
  simultaneous_sessions: 'Sessões Simultâneas',
  unusual_country: 'País Incomum',
  impossible_travel: 'Viagem Impossível',
};

const severityColors: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-orange-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-muted text-muted-foreground',
};

export default function SecurityAlertsPanel() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [active, recent] = await Promise.all([
      fetchActiveSessions(),
      fetchRecentSessions(24),
    ]);
    setAlerts(analyzeLoginSecurity(active, recent));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  usePresenceRealtime(load);

  const bySeverity = (s: string) => alerts.filter(a => a.severity === s).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" /> Alertas de Segurança
        </h2>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total" count={alerts.length} color="text-foreground" />
        <SummaryCard label="Crítico" count={bySeverity('critical')} color="text-destructive" />
        <SummaryCard label="Alto" count={bySeverity('high')} color="text-orange-500" />
        <SummaryCard label="Médio" count={bySeverity('medium')} color="text-amber-500" />
      </div>

      {/* Alert list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Alertas Detectados ({alerts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {alerts.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <ShieldAlert className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                Nenhum alerta detectado
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map(alert => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors"
                  >
                    <div className="mt-0.5">{typeIcons[alert.type]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{alert.title}</span>
                        <Badge className={`text-[9px] h-4 ${severityColors[alert.severity]}`}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] h-4">
                          {typeLabels[alert.type]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        {new Date(alert.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <div className={`text-xl font-bold ${color}`}>{count}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      </CardContent>
    </Card>
  );
}
