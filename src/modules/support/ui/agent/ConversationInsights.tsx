/**
 * ConversationInsights — Per-conversation analytics sidebar.
 * Shows duration, message count, response times, topic tags.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Clock, MessageSquare, Timer, Hash, BarChart3,
  User, Shield, Loader2, Calendar,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { SupportTicket } from '@/domains/support/types';

interface InsightData {
  messageCount: number;
  agentMessages: number;
  clientMessages: number;
  internalNotes: number;
  chatSessionCount: number;
  totalChatMessages: number;
  durationMinutes: number;
  firstResponseMin: number | null;
  resolutionHours: number | null;
  isAssigned: boolean;
  assigneeName: string | null;
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return `${h}h ${m}min`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export default function ConversationInsights({ ticket }: { ticket: SupportTicket }) {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [messagesRes, sessionsRes, chatMsgsRes] = await Promise.all([
          supabase.from('support_ticket_messages').select('id, sender_type, is_internal').eq('ticket_id', ticket.id),
          supabase.from('support_chat_sessions').select('id').eq('ticket_id', ticket.id),
          supabase.from('support_chat_messages').select('id, sender_type').eq('session_id', ticket.id), // approximate
        ]);

        const msgs = messagesRes.data ?? [];
        const sessions = sessionsRes.data ?? [];

        const durationMinutes = Math.round((Date.now() - new Date(ticket.created_at).getTime()) / 60000);
        const firstResponseMin = ticket.first_response_at
          ? Math.round((new Date(ticket.first_response_at).getTime() - new Date(ticket.created_at).getTime()) / 60000)
          : null;
        const resolutionHours = ticket.resolved_at
          ? Math.round((new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()) / 3600000 * 10) / 10
          : null;

        setData({
          messageCount: msgs.length,
          agentMessages: msgs.filter(m => m.sender_type === 'platform_agent').length,
          clientMessages: msgs.filter(m => m.sender_type === 'tenant_user').length,
          internalNotes: msgs.filter(m => m.is_internal).length,
          chatSessionCount: sessions.length,
          totalChatMessages: chatMsgsRes.data?.length ?? 0,
          durationMinutes,
          firstResponseMin,
          resolutionHours,
          isAssigned: !!ticket.assigned_to,
          assigneeName: null, // could fetch from platform_users
        });
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, [ticket.id, ticket.created_at, ticket.first_response_at, ticket.resolved_at, ticket.assigned_to]);

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }

  if (!data) return null;

  const responseColor = data.firstResponseMin !== null
    ? data.firstResponseMin <= 15 ? 'hsl(145 60% 42%)' : data.firstResponseMin <= 60 ? 'hsl(35 80% 50%)' : 'hsl(0 70% 50%)'
    : 'hsl(var(--muted-foreground))';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> Insights da Conversa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Timing */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <Clock className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-sm font-bold text-foreground">{formatDuration(data.durationMinutes)}</p>
            <p className="text-[9px] text-muted-foreground">Duração Total</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <Timer className="h-3.5 w-3.5 mx-auto mb-1" style={{ color: responseColor }} />
            <p className="text-sm font-bold" style={{ color: responseColor }}>
              {data.firstResponseMin !== null ? formatDuration(data.firstResponseMin) : '—'}
            </p>
            <p className="text-[9px] text-muted-foreground">1ª Resposta</p>
          </div>
        </div>

        {/* Message breakdown */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> Mensagens ({data.messageCount})
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-foreground">Cliente</span>
              </div>
              <Badge variant="secondary" className="text-[10px]">{data.clientMessages}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-primary" />
                <span className="text-xs text-foreground">Agente</span>
              </div>
              <Badge variant="secondary" className="text-[10px]">{data.agentMessages}</Badge>
            </div>
            {data.internalNotes > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="h-3 w-3 text-[hsl(35_80%_50%)]" />
                  <span className="text-xs text-foreground">Notas Internas</span>
                </div>
                <Badge variant="outline" className="text-[10px]">{data.internalNotes}</Badge>
              </div>
            )}
          </div>
        </div>

        {/* Chat sessions */}
        {data.chatSessionCount > 0 && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Sessões de Chat</span>
              <Badge variant="secondary" className="text-[10px]">{data.chatSessionCount}</Badge>
            </div>
          </div>
        )}

        {/* Resolution */}
        {data.resolutionHours !== null && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Resolução
              </span>
              <Badge variant="secondary" className="text-[10px]">{data.resolutionHours}h</Badge>
            </div>
          </div>
        )}

        {/* Tags */}
        {ticket.tags && ticket.tags.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Tags</p>
            <div className="flex flex-wrap gap-1">
              {ticket.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-[9px]">{tag}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
