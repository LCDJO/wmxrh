/**
 * My Sessions — User-facing page showing active and historical sessions.
 * Users can terminate other sessions from this view.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Monitor, Smartphone, Tablet, Globe, Clock, LogOut, Shield, History, MapPin, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionHistory } from '@/modules/user-activity/hooks/useSessionHistory';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getActiveSessionId } from '@/domains/session/session-tracker';

const deviceIcons: Record<string, typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

const logoutReasonLabels: Record<string, string> = {
  user_logout: 'Logout manual',
  new_login: 'Substituída por novo login',
  admin_logout: 'Encerrada por administrador',
  session_timeout: 'Timeout por inatividade',
};

interface ActiveSession {
  id: string;
  ip_address: string | null;
  city: string | null;
  country: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  login_at: string;
  last_activity: string;
  status: string;
  is_vpn: boolean;
  asn_name: string | null;
}

export default function MySessionsPage() {
  const { user } = useAuth();
  const { history, loading: historyLoading, refresh: refreshHistory } = useSessionHistory(user?.id);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);

  const currentSessionId = getActiveSessionId();

  // Fetch active sessions for current user
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('user_sessions')
        .select('id, ip_address, city, country, browser, os, device_type, login_at, last_activity, status, is_vpn, asn_name')
        .eq('user_id', user.id)
        .in('status', ['online', 'idle'])
        .order('login_at', { ascending: false });
      setActiveSessions((data ?? []) as ActiveSession[]);
      setLoadingActive(false);
    })();
  }, [user?.id]);

  const handleTerminate = async (sessionId: string) => {
    setTerminatingId(sessionId);
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ status: 'offline', logout_at: new Date().toISOString(), logout_reason: 'user_logout' } as any)
        .eq('id', sessionId)
        .eq('user_id', user?.id ?? '')
        .select('id');

      if (error) throw error;
      toast.success('Sessão encerrada');
      setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
      refreshHistory();
    } catch {
      toast.error('Erro ao encerrar sessão');
    } finally {
      setTerminatingId(null);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '—';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `${h}h ${m}min`;
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Minhas Sessões
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie seus dispositivos conectados e visualize o histórico de acessos.
        </p>
      </div>

      {/* Active Sessions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-emerald-500" /> Sessões Ativas
            <Badge variant="secondary" className="ml-auto">{activeSessions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingActive ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Carregando...</div>
          ) : activeSessions.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma sessão ativa</div>
          ) : (
            <div className="divide-y divide-border/30">
              {activeSessions.map(s => {
                const DevIcon = deviceIcons[s.device_type ?? 'desktop'] ?? Monitor;
                const isCurrent = s.id === currentSessionId;
                const elapsed = Math.round((Date.now() - new Date(s.last_activity).getTime()) / 60000);

                return (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.status === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <DevIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {s.browser} / {s.os}
                        {isCurrent && <Badge variant="default" className="text-[10px] h-4 px-1.5">Esta sessão</Badge>}
                        {s.is_vpn && <Badge variant="destructive" className="text-[10px] h-4 px-1">VPN</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {[s.city, s.country].filter(Boolean).join(', ') || '—'}
                        <span>•</span>
                        <span className="font-mono">{s.ip_address}</span>
                        {s.asn_name && <><span>•</span><span className="truncate max-w-[120px]">{s.asn_name}</span></>}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        Login: {formatTime(s.login_at)} • Última atividade: {elapsed < 1 ? 'agora' : `${elapsed}m atrás`}
                      </div>
                    </div>
                    {!isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-xs gap-1 text-destructive hover:text-destructive"
                        onClick={() => handleTerminate(s.id)}
                        disabled={terminatingId === s.id}
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Encerrar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" /> Histórico de Sessões
            <Badge variant="secondary" className="ml-auto">{history.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {historyLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Carregando...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Nenhum histórico disponível</div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="divide-y divide-border/30">
                {history.map(h => {
                  const DevIcon = deviceIcons[h.device_type ?? 'desktop'] ?? Monitor;
                  const isHighRisk = h.risk_score >= 61;

                  return (
                    <div key={h.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                      <DevIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs font-medium">
                          {h.browser} / {h.os}
                          {isHighRisk && (
                            <Badge variant="destructive" className="text-[8px] h-4 px-1 gap-0.5">
                              <AlertTriangle className="h-2.5 w-2.5" /> Risco {h.risk_score}
                            </Badge>
                          )}
                          {h.is_vpn && <Badge variant="outline" className="text-[8px] h-4 px-1">VPN</Badge>}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          <span className="font-mono">{h.ip_address}</span>
                          <span> • </span>
                          {[h.city, h.country].filter(Boolean).join(', ') || '—'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-muted-foreground">
                          {formatTime(h.login_at)} → {formatTime(h.logout_at)}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDuration(h.duration_seconds)}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] h-5 shrink-0">
                        {logoutReasonLabels[h.logout_reason] ?? h.logout_reason}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
