/**
 * LiveChatGovernance — Session controls, SLA timers, and audit indicators.
 * Wraps the chat window with governance controls for open/close,
 * real-time SLA timer, and session audit trail.
 */
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Shield, Timer, Lock, CheckCircle2, XCircle,
  Play, Pause, AlertTriangle, Clock, Eye, FileText,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { SupportTicket, TicketStatus } from '@/domains/support/types';
import LiveChatWindow from '../LiveChatWindow';

interface GovernanceProps {
  ticket: SupportTicket;
  userId: string;
  onStatusChange?: (newStatus: TicketStatus) => void;
}

function useSlaTimer(createdAt: string, firstResponseAt: string | null) {
  const [elapsed, setElapsed] = useState(0);
  const slaLimitMin = 30; // 30 min SLA target

  useEffect(() => {
    if (firstResponseAt) {
      // Already responded — show static value
      setElapsed(Math.round((new Date(firstResponseAt).getTime() - new Date(createdAt).getTime()) / 60000));
      return;
    }

    // Live counter
    const update = () => setElapsed(Math.round((Date.now() - new Date(createdAt).getTime()) / 60000));
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, [createdAt, firstResponseAt]);

  const isBreached = elapsed > slaLimitMin;
  const isWarning = elapsed > slaLimitMin * 0.7 && !isBreached;
  const percentage = Math.min((elapsed / slaLimitMin) * 100, 100);

  return { elapsed, isBreached, isWarning, percentage, responded: !!firstResponseAt };
}

function formatElapsed(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ''}`;
}

export default function LiveChatGovernance({ ticket, userId, onStatusChange }: GovernanceProps) {
  const sla = useSlaTimer(ticket.created_at, ticket.first_response_at);
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    supabase
      .from('support_chat_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('ticket_id', ticket.id)
      .then(({ count }) => setSessionCount(count ?? 0));
  }, [ticket.id]);

  const handleStatusUpdate = async (status: string) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: status as TicketStatus, updated_at: new Date().toISOString() })
        .eq('id', ticket.id);
      if (error) throw error;
      toast.success('Status atualizado');
      onStatusChange?.(status as TicketStatus);
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const slaColor = sla.responded
    ? 'hsl(145 60% 42%)'
    : sla.isBreached
      ? 'hsl(0 70% 50%)'
      : sla.isWarning
        ? 'hsl(35 80% 50%)'
        : 'hsl(145 60% 42%)';

  return (
    <div className="flex flex-col h-full">
      {/* Governance Header */}
      <div className="px-4 py-2.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          {/* SLA Timer */}
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border',
            sla.responded
              ? 'border-[hsl(145_60%_42%/0.3)] bg-[hsl(145_60%_42%/0.06)]'
              : sla.isBreached
                ? 'border-[hsl(0_70%_50%/0.3)] bg-[hsl(0_70%_50%/0.06)] animate-pulse'
                : sla.isWarning
                  ? 'border-[hsl(35_80%_50%/0.3)] bg-[hsl(35_80%_50%/0.06)]'
                  : 'border-border bg-muted/30'
          )}>
            {sla.responded ? (
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: slaColor }} />
            ) : sla.isBreached ? (
              <AlertTriangle className="h-3.5 w-3.5" style={{ color: slaColor }} />
            ) : (
              <Timer className="h-3.5 w-3.5" style={{ color: slaColor }} />
            )}
            <span style={{ color: slaColor }}>
              {sla.responded ? `Respondido em ${formatElapsed(sla.elapsed)}` : `SLA: ${formatElapsed(sla.elapsed)}`}
            </span>
          </div>

          {/* Session count */}
          <Badge variant="outline" className="text-[10px] gap-1">
            <FileText className="h-3 w-3" /> {sessionCount} sessão(ões)
          </Badge>

          {/* Audit badge */}
          <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" /> Auditável
          </Badge>

          {/* Status control */}
          <div className="ml-auto flex items-center gap-2">
            <Select value={ticket.status} onValueChange={handleStatusUpdate}>
              <SelectTrigger className="h-7 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open" className="text-xs">Aberto</SelectItem>
                <SelectItem value="in_progress" className="text-xs">Em Andamento</SelectItem>
                <SelectItem value="awaiting_customer" className="text-xs">Aguard. Cliente</SelectItem>
                <SelectItem value="resolved" className="text-xs">Resolvido</SelectItem>
                <SelectItem value="closed" className="text-xs">Fechado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 min-h-0">
        <LiveChatWindow
          key={ticket.id}
          ticketId={ticket.id}
          tenantId={ticket.tenant_id}
          userId={userId}
          senderType="agent"
          assignedAgentId={ticket.assigned_to}
          ticketSubject={ticket.subject}
        />
      </div>
    </div>
  );
}
