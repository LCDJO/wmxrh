/**
 * AgentAlertService — Real-time alerts for new tickets, chats and SLA breaches.
 * Uses Supabase Realtime to subscribe to support_tickets and support_chat_sessions.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell, BellRing, AlertTriangle, MessageSquare, Clock,
  X, Volume2, VolumeX, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AgentAlert {
  id: string;
  type: 'new_ticket' | 'new_chat' | 'sla_warning' | 'escalation' | 'reassignment';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  ticketId?: string;
  tenantName?: string;
  createdAt: string;
  read: boolean;
}

const ALERT_ICONS = {
  new_ticket: MessageSquare,
  new_chat: BellRing,
  sla_warning: Clock,
  escalation: AlertTriangle,
  reassignment: AlertTriangle,
};

const SEVERITY_STYLES = {
  info: 'border-l-[hsl(210_65%_50%)] bg-[hsl(210_65%_50%/0.06)]',
  warning: 'border-l-[hsl(35_80%_50%)] bg-[hsl(35_80%_50%/0.06)]',
  critical: 'border-l-[hsl(0_70%_50%)] bg-[hsl(0_70%_50%/0.06)]',
};

interface AgentAlertServiceProps {
  agentId: string;
  onAlertClick?: (alert: AgentAlert) => void;
}

export function useAgentAlerts(agentId: string) {
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      // Use a simple beep via AudioContext
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.1;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch { /* silent fallback */ }
  }, [soundEnabled]);

  const addAlert = useCallback((alert: Omit<AgentAlert, 'id' | 'createdAt' | 'read'>) => {
    const newAlert: AgentAlert = {
      ...alert,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      read: false,
    };
    setAlerts(prev => [newAlert, ...prev].slice(0, 50));
    playNotificationSound();

    // Toast notification
    const toastFn = alert.severity === 'critical' ? toast.error : alert.severity === 'warning' ? toast.warning : toast.info;
    toastFn(alert.title, { description: alert.description, duration: 5000 });
  }, [playNotificationSound]);

  const markRead = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  }, []);

  const markAllRead = useCallback(() => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setAlerts([]);
  }, []);

  // Subscribe to new tickets
  useEffect(() => {
    const channel = supabase
      .channel('agent-alerts-tickets')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_tickets' },
        async (payload) => {
          const ticket = payload.new as { id: string; tenant_id: string; subject: string; priority: string };
          // Fetch tenant name
          const { data: tenant } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', ticket.tenant_id)
            .maybeSingle();

          const severity = ticket.priority === 'urgent' ? 'critical' : ticket.priority === 'high' ? 'warning' : 'info';
          addAlert({
            type: 'new_ticket',
            title: '🎫 Novo Ticket',
            description: `${tenant?.name ?? 'Cliente'}: ${ticket.subject}`,
            severity,
            ticketId: ticket.id,
            tenantName: tenant?.name ?? undefined,
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [agentId, addAlert]);

  // Subscribe to new chat sessions
  useEffect(() => {
    const channel = supabase
      .channel('agent-alerts-chats')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_chat_sessions' },
        async (payload) => {
          const session = payload.new as { id: string; tenant_id: string; protocol_number: string };
          const { data: tenant } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', session.tenant_id)
            .maybeSingle();

          addAlert({
            type: 'new_chat',
            title: '💬 Nova Sessão de Chat',
            description: `${tenant?.name ?? 'Cliente'} iniciou uma conversa (${session.protocol_number})`,
            severity: 'warning',
            tenantName: tenant?.name ?? undefined,
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [agentId, addAlert]);

  // SLA warning check — every 60s, check tickets without first_response > 15min
  useEffect(() => {
    const check = async () => {
      const fifteenMinAgo = new Date(Date.now() - 15 * 60000).toISOString();
      const { data } = await supabase
        .from('support_tickets')
        .select('id, subject, tenant_id, created_at')
        .in('status', ['open', 'awaiting_agent'])
        .is('first_response_at', null)
        .lt('created_at', fifteenMinAgo)
        .limit(10);

      if (data && data.length > 0) {
        for (const t of data) {
          const mins = Math.round((Date.now() - new Date(t.created_at).getTime()) / 60000);
          // Avoid duplicate alerts
          setAlerts(prev => {
            const exists = prev.some(a => a.ticketId === t.id && a.type === 'sla_warning' && !a.read);
            if (exists) return prev;
            const alert: AgentAlert = {
              id: crypto.randomUUID(),
              type: 'sla_warning',
              title: '⏰ SLA em Risco',
              description: `Ticket "${t.subject}" sem resposta há ${mins}min`,
              severity: mins > 30 ? 'critical' : 'warning',
              ticketId: t.id,
              createdAt: new Date().toISOString(),
              read: false,
            };
            return [alert, ...prev].slice(0, 50);
          });
        }
      }
    };

    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [agentId]);

  return {
    alerts,
    unreadCount: alerts.filter(a => !a.read).length,
    soundEnabled,
    setSoundEnabled,
    markRead,
    markAllRead,
    clearAll,
  };
}

// ── Alert Banner Component ──

export function AgentAlertBanner({
  alerts,
  unreadCount,
  soundEnabled,
  onToggleSound,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onAlertClick,
}: {
  alerts: AgentAlert[];
  unreadCount: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onAlertClick?: (alert: AgentAlert) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative">
      {/* Alert bar */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-2 rounded-lg border transition-all',
        unreadCount > 0
          ? 'border-[hsl(35_80%_50%/0.3)] bg-[hsl(35_80%_50%/0.05)]'
          : 'border-border bg-card'
      )}>
        <div className="relative">
          {unreadCount > 0 ? (
            <BellRing className="h-4.5 w-4.5 text-[hsl(35_80%_50%)] animate-pulse" />
          ) : (
            <Bell className="h-4.5 w-4.5 text-muted-foreground" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-[hsl(0_70%_50%)] text-[9px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {unreadCount > 0 ? (
            <p className="text-xs font-medium text-foreground">
              {unreadCount} alerta{unreadCount > 1 ? 's' : ''} não lido{unreadCount > 1 ? 's' : ''}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Sem alertas pendentes</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleSound}>
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </Button>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={onMarkAllRead}>
              Marcar todas lidas
            </Button>
          )}
          {alerts.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClearAll}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(p => !p)}>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
          </Button>
        </div>
      </div>

      {/* Expanded alert list */}
      {expanded && alerts.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 border border-border rounded-lg bg-card shadow-xl">
          <ScrollArea className="max-h-[300px]">
            {alerts.map(alert => {
              const Icon = ALERT_ICONS[alert.type];
              return (
                <button
                  key={alert.id}
                  onClick={() => {
                    onMarkRead(alert.id);
                    onAlertClick?.(alert);
                  }}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-border last:border-0 border-l-3 transition-colors hover:bg-muted/50',
                    SEVERITY_STYLES[alert.severity],
                    alert.read && 'opacity-50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="h-4 w-4 shrink-0 mt-0.5 text-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{alert.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{alert.description}</p>
                    </div>
                    <span className="text-[9px] text-muted-foreground shrink-0">
                      {new Date(alert.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!alert.read && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                    )}
                  </div>
                </button>
              );
            })}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
