/**
 * ConversationInsights — Per-conversation analytics.
 * Metrics: total duration, message count, avg agent response time, sentiment (AI-ready).
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Clock, MessageSquare, Timer, BarChart3,
  User, Shield, Loader2, Calendar, Brain, Zap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { SupportTicket } from '@/domains/support/types';

interface InsightData {
  durationMinutes: number;
  totalMessages: number;
  agentMessages: number;
  clientMessages: number;
  systemMessages: number;
  chatSessionCount: number;
  firstResponseMin: number | null;
  avgAgentResponseMin: number | null;
  resolutionHours: number | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null; // AI-ready
}

function formatDuration(mins: number): string {
  if (mins < 1) return '<1min';
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return `${h}h ${m > 0 ? `${m}min` : ''}`.trim();
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/**
 * Calculate average agent response time from chat messages.
 * For each client message, find the next agent message and compute the delta.
 */
function calcAvgAgentResponse(messages: Array<{ sender_type: string; created_at: string }>): number | null {
  if (messages.length < 2) return null;

  const sorted = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const responseTimes: number[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].sender_type === 'tenant') {
      // Find next agent reply
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].sender_type === 'agent') {
          const delta = (new Date(sorted[j].created_at).getTime() - new Date(sorted[i].created_at).getTime()) / 60000;
          responseTimes.push(delta);
          break;
        }
      }
    }
  }

  if (responseTimes.length === 0) return null;
  return Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
}

const SENTIMENT_CONFIG = {
  positive: { label: 'Positivo', color: 'hsl(145 60% 42%)', icon: '😊' },
  neutral: { label: 'Neutro', color: 'hsl(35 80% 50%)', icon: '😐' },
  negative: { label: 'Negativo', color: 'hsl(0 70% 50%)', icon: '😟' },
};

export default function ConversationInsights({ ticket }: { ticket: SupportTicket }) {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Fetch sessions first to get IDs for chat messages
        const { data: sessions } = await supabase
          .from('support_chat_sessions')
          .select('id')
          .eq('ticket_id', ticket.id);

        const sessionIds = (sessions ?? []).map(s => s.id);

        // Fetch chat messages for all sessions
        let chatMessages: Array<{ sender_type: string; created_at: string }> = [];
        if (sessionIds.length > 0) {
          const { data: msgs } = await supabase
            .from('support_chat_messages')
            .select('sender_type, created_at')
            .in('session_id', sessionIds)
            .order('created_at', { ascending: true });
          chatMessages = (msgs ?? []) as Array<{ sender_type: string; created_at: string }>;
        }

        // Also fetch ticket messages (legacy/fallback)
        const { data: ticketMsgs } = await supabase
          .from('support_ticket_messages')
          .select('sender_type, created_at')
          .eq('ticket_id', ticket.id);

        const allMessages = chatMessages.length > 0 ? chatMessages : (ticketMsgs ?? []);
        const totalMessages = allMessages.length;
        const agentMessages = allMessages.filter(m => m.sender_type === 'agent' || m.sender_type === 'platform_agent').length;
        const clientMessages = allMessages.filter(m => m.sender_type === 'tenant' || m.sender_type === 'tenant_user').length;
        const systemMessages = allMessages.filter(m => m.sender_type === 'system').length;

        const durationMinutes = Math.round((Date.now() - new Date(ticket.created_at).getTime()) / 60000);

        const firstResponseMin = ticket.first_response_at
          ? Math.round((new Date(ticket.first_response_at).getTime() - new Date(ticket.created_at).getTime()) / 60000)
          : null;

        const resolutionHours = ticket.resolved_at
          ? Math.round((new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()) / 3600000 * 10) / 10
          : null;

        const avgAgentResponseMin = calcAvgAgentResponse(allMessages);

        setData({
          durationMinutes,
          totalMessages,
          agentMessages,
          clientMessages,
          systemMessages,
          chatSessionCount: sessionIds.length,
          firstResponseMin,
          avgAgentResponseMin,
          resolutionHours,
          sentiment: null, // AI-ready: will be populated by future AI analysis
        });
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, [ticket.id, ticket.created_at, ticket.first_response_at, ticket.resolved_at]);

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }

  if (!data) return null;

  const responseColor = (mins: number | null) => {
    if (mins === null) return 'hsl(var(--muted-foreground))';
    if (mins <= 5) return 'hsl(145 60% 42%)';
    if (mins <= 15) return 'hsl(35 80% 50%)';
    return 'hsl(0 70% 50%)';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> Analytics da Conversa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* ── KPI Grid ── */}
        <div className="grid grid-cols-2 gap-2">
          {/* Total Duration */}
          <MetricCard
            icon={Clock}
            label="Tempo Total"
            value={formatDuration(data.durationMinutes)}
            iconColor="hsl(210 65% 50%)"
          />

          {/* Total Messages */}
          <MetricCard
            icon={MessageSquare}
            label="Mensagens"
            value={String(data.totalMessages)}
            iconColor="hsl(280 60% 55%)"
          />

          {/* First Response */}
          <MetricCard
            icon={Zap}
            label="1ª Resposta"
            value={data.firstResponseMin !== null ? formatDuration(data.firstResponseMin) : '—'}
            iconColor={responseColor(data.firstResponseMin)}
          />

          {/* Avg Agent Response */}
          <MetricCard
            icon={Timer}
            label="Resp. Média Agente"
            value={data.avgAgentResponseMin !== null ? formatDuration(data.avgAgentResponseMin) : '—'}
            iconColor={responseColor(data.avgAgentResponseMin)}
          />
        </div>

        <Separator />

        {/* ── Message Breakdown ── */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Distribuição</p>
          <div className="space-y-1">
            <BreakdownRow icon={User} label="Cliente" count={data.clientMessages} total={data.totalMessages} color="hsl(210 65% 50%)" />
            <BreakdownRow icon={Shield} label="Agente" count={data.agentMessages} total={data.totalMessages} color="hsl(145 60% 42%)" />
            {data.systemMessages > 0 && (
              <BreakdownRow icon={Zap} label="Sistema" count={data.systemMessages} total={data.totalMessages} color="hsl(0 0% 50%)" />
            )}
          </div>
        </div>

        {/* ── Resolution ── */}
        {data.resolutionHours !== null && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Tempo até Resolução
              </span>
              <Badge variant="secondary" className="text-[10px]">{data.resolutionHours}h</Badge>
            </div>
          </>
        )}

        {/* ── Sessions ── */}
        {data.chatSessionCount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Sessões de Chat</span>
            <Badge variant="outline" className="text-[10px]">{data.chatSessionCount}</Badge>
          </div>
        )}

        <Separator />

        {/* ── Sentiment (AI-Ready) ── */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Brain className="h-3 w-3" /> Sentimento
          </p>
          {data.sentiment ? (
            <div className="flex items-center gap-2">
              <span className="text-base">{SENTIMENT_CONFIG[data.sentiment].icon}</span>
              <Badge
                variant="outline"
                className="text-[10px]"
                style={{
                  borderColor: `${SENTIMENT_CONFIG[data.sentiment].color}40`,
                  color: SENTIMENT_CONFIG[data.sentiment].color,
                }}
              >
                {SENTIMENT_CONFIG[data.sentiment].label}
              </Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-1">
              <div className="h-6 w-6 rounded bg-muted/50 flex items-center justify-center">
                <Brain className="h-3 w-3 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Análise por IA</p>
                <p className="text-[9px] text-muted-foreground/60">Disponível em breve</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Tags ── */}
        {ticket.tags && ticket.tags.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Tags</p>
              <div className="flex flex-wrap gap-1">
                {ticket.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-[9px]">{tag}</Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Sub-components ──

function MetricCard({ icon: Icon, label, value, iconColor }: {
  icon: typeof Clock;
  label: string;
  value: string;
  iconColor: string;
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-2.5 text-center">
      <Icon className="h-3.5 w-3.5 mx-auto mb-1" style={{ color: iconColor }} />
      <p className="text-sm font-bold text-foreground">{value}</p>
      <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}

function BreakdownRow({ icon: Icon, label, count, total, color }: {
  icon: typeof User;
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3 w-3 shrink-0" style={{ color }} />
      <span className="text-xs text-foreground w-14">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] text-muted-foreground w-8 text-right">{count}</span>
    </div>
  );
}
