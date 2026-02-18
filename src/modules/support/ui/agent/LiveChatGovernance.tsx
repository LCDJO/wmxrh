/**
 * LiveChatGovernance — Session controls, SLA timers, internal notes, and audit indicators.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Shield, Timer, Lock, CheckCircle2, XCircle,
  Play, Pause, AlertTriangle, Clock, Eye, FileText,
  StickyNote, Plus, Send, Tag, Puzzle, Loader2, Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { SupportTicket, TicketStatus, ChatNote } from '@/domains/support/types';
import LiveChatWindow from '../LiveChatWindow';

interface GovernanceProps {
  ticket: SupportTicket;
  userId: string;
  onStatusChange?: (newStatus: TicketStatus) => void;
}

// ── SLA Timer Hook ──

function useSlaTimer(createdAt: string, firstResponseAt: string | null) {
  const [elapsed, setElapsed] = useState(0);
  const slaLimitMin = 30;

  useEffect(() => {
    if (firstResponseAt) {
      setElapsed(Math.round((new Date(firstResponseAt).getTime() - new Date(createdAt).getTime()) / 60000));
      return;
    }
    const update = () => setElapsed(Math.round((Date.now() - new Date(createdAt).getTime()) / 60000));
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, [createdAt, firstResponseAt]);

  const isBreached = elapsed > slaLimitMin;
  const isWarning = elapsed > slaLimitMin * 0.7 && !isBreached;
  return { elapsed, isBreached, isWarning, responded: !!firstResponseAt };
}

function formatElapsed(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ''}`;
}

// ── Internal Notes Panel ──

function InternalNotesPanel({ sessionId, agentId }: { sessionId: string | null; agentId: string }) {
  const [notes, setNotes] = useState<ChatNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadNotes = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    const { data } = await supabase
      .from('support_chat_notes')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    setNotes((data ?? []) as unknown as ChatNote[]);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  // Realtime subscription
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`chat-notes-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_chat_notes', filter: `session_id=eq.${sessionId}` }, () => loadNotes())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, loadNotes]);

  const handleSubmit = async () => {
    if (!newNote.trim() || !sessionId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('support_chat_notes')
        .insert({ session_id: sessionId, agent_id: agentId, note_text: newNote.trim(), is_internal: true });
      if (error) throw error;
      setNewNote('');
      toast.success('Nota adicionada');
    } catch { toast.error('Erro ao salvar nota'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('support_chat_notes').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir');
  };

  if (!sessionId) {
    return (
      <div className="text-center py-6">
        <StickyNote className="h-6 w-6 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">Inicie uma sessão para adicionar notas.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <StickyNote className="h-4 w-4 text-[hsl(35_80%_50%)]" />
        <span className="text-xs font-semibold text-foreground">Notas Internas</span>
        <Badge variant="outline" className="text-[9px] ml-auto gap-1">
          <Lock className="h-2.5 w-2.5" /> Só agentes
        </Badge>
      </div>

      {/* Input */}
      <div className="p-2 border-b border-border shrink-0">
        <div className="flex gap-1.5">
          <Textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Observação interna..."
            className="min-h-[60px] text-xs resize-none"
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSubmit(); }}
          />
          <Button size="icon" className="h-[60px] w-9 shrink-0" onClick={handleSubmit} disabled={submitting || !newNote.trim()}>
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Notes list */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhuma nota ainda.</p>
        ) : (
          <div className="p-2 space-y-2">
            {notes.map(note => (
              <div key={note.id} className="p-2.5 rounded-md bg-[hsl(35_80%_50%/0.06)] border border-[hsl(35_80%_50%/0.15)] text-xs">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-foreground whitespace-pre-wrap flex-1">{note.note_text}</p>
                  {note.agent_id === agentId && (
                    <button onClick={() => handleDelete(note.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">
                  {new Date(note.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ── Session Metadata Panel ──

function SessionMetadataBar({
  sessionId,
  tags,
  priority,
  moduleRef,
  onUpdate,
}: {
  sessionId: string | null;
  tags: string[];
  priority: string;
  moduleRef: string | null;
  onUpdate: () => void;
}) {
  const [newTag, setNewTag] = useState('');

  const updateSession = async (field: string, value: unknown) => {
    if (!sessionId) return;
    const { error } = await supabase
      .from('support_chat_sessions')
      .update({ [field]: value })
      .eq('id', sessionId);
    if (error) toast.error('Erro ao atualizar sessão');
    else onUpdate();
  };

  const addTag = () => {
    if (!newTag.trim()) return;
    const updated = [...tags, newTag.trim()];
    updateSession('tags', updated);
    setNewTag('');
  };

  const removeTag = (idx: number) => {
    const updated = tags.filter((_, i) => i !== idx);
    updateSession('tags', updated);
  };

  if (!sessionId) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap px-4 py-1.5 border-b border-border bg-muted/20 text-xs">
      {/* Priority */}
      <div className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3 text-muted-foreground" />
        <Select value={priority} onValueChange={v => updateSession('priority', v)}>
          <SelectTrigger className="h-6 w-24 text-[10px] border-dashed">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low" className="text-xs">Baixa</SelectItem>
            <SelectItem value="medium" className="text-xs">Média</SelectItem>
            <SelectItem value="high" className="text-xs">Alta</SelectItem>
            <SelectItem value="urgent" className="text-xs">Urgente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Module */}
      <div className="flex items-center gap-1">
        <Puzzle className="h-3 w-3 text-muted-foreground" />
        <Input
          defaultValue={moduleRef ?? ''}
          placeholder="Módulo"
          className="h-6 w-28 text-[10px] border-dashed"
          onBlur={e => updateSession('module_reference', e.target.value || null)}
        />
      </div>

      {/* Tags */}
      <div className="flex items-center gap-1 flex-wrap">
        <Tag className="h-3 w-3 text-muted-foreground" />
        {tags.map((tag, i) => (
          <Badge key={i} variant="secondary" className="text-[9px] gap-0.5 cursor-pointer hover:line-through" onClick={() => removeTag(i)}>
            {tag}
          </Badge>
        ))}
        <Input
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          placeholder="+ tag"
          className="h-5 w-16 text-[9px] border-dashed px-1"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
        />
      </div>
    </div>
  );
}

// ── Main Governance Component ──

export default function LiveChatGovernance({ ticket, userId, onStatusChange }: GovernanceProps) {
  const sla = useSlaTimer(ticket.created_at, ticket.first_response_at);
  const [sessionCount, setSessionCount] = useState(0);
  const [activeSession, setActiveSession] = useState<{ id: string; tags: string[]; priority: string; module_reference: string | null } | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  const loadSession = useCallback(async () => {
    const { data, count } = await supabase
      .from('support_chat_sessions')
      .select('id, tags, priority, module_reference', { count: 'exact' })
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: false })
      .limit(1);
    setSessionCount(count ?? 0);
    if (data && data.length > 0) {
      const s = data[0];
      setActiveSession({
        id: s.id,
        tags: (s.tags as string[]) ?? [],
        priority: (s.priority as string) ?? 'medium',
        module_reference: s.module_reference as string | null,
      });
    }
  }, [ticket.id]);

  useEffect(() => { loadSession(); }, [loadSession]);

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

          {/* Protocol */}
          {activeSession && (
            <Badge variant="outline" className="text-[10px] gap-1 font-mono">
              <FileText className="h-3 w-3" /> {sessionCount} sessão(ões)
            </Badge>
          )}

          {/* Audit badge */}
          <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" /> Auditável
          </Badge>

          {/* Notes toggle */}
          <Button
            variant={showNotes ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-[10px] gap-1"
            onClick={() => setShowNotes(p => !p)}
          >
            <StickyNote className="h-3 w-3" /> Notas
          </Button>

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

      {/* Session Metadata (tags, priority, module) */}
      <SessionMetadataBar
        sessionId={activeSession?.id ?? null}
        tags={activeSession?.tags ?? []}
        priority={activeSession?.priority ?? 'medium'}
        moduleRef={activeSession?.module_reference ?? null}
        onUpdate={loadSession}
      />

      {/* Main area: Chat + optional Notes panel */}
      <div className="flex-1 min-h-0 flex">
        {/* Chat Window */}
        <div className={cn('flex-1 min-h-0', showNotes && 'border-r border-border')}>
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

        {/* Internal Notes Sidebar */}
        {showNotes && (
          <div className="w-[280px] shrink-0 bg-card flex flex-col">
            <InternalNotesPanel sessionId={activeSession?.id ?? null} agentId={userId} />
          </div>
        )}
      </div>
    </div>
  );
}
