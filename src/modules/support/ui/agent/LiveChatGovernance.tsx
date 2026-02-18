/**
 * LiveChatGovernance — Session controls, SLA timers, internal notes, and audit indicators.
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Timer, Lock, CheckCircle2,
  Play, Pause, AlertTriangle, FileText,
  StickyNote, Send, Tag, Puzzle, Loader2, Trash2, Square,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ChatService } from '@/domains/support/chat-service';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { SupportTicket, TicketStatus, ChatNote, ChatSessionStatus } from '@/domains/support/types';
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

// ── Closure Dialog ──

const CLOSURE_CATEGORIES = [
  { value: 'billing', label: 'Financeiro' },
  { value: 'technical', label: 'Técnico' },
  { value: 'feature_request', label: 'Sugestão' },
  { value: 'bug_report', label: 'Bug' },
  { value: 'account', label: 'Conta' },
  { value: 'general', label: 'Geral' },
];

function ClosureDialog({
  open,
  onOpenChange,
  onConfirm,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (data: { summary: string; category: string; resolved: boolean }) => void;
  submitting: boolean;
}) {
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('');
  const [resolved, setResolved] = useState<boolean | null>(null);

  const isValid = summary.trim().length >= 10 && category && resolved !== null;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm({ summary: summary.trim(), category, resolved: resolved! });
  };

  // Reset on open
  useEffect(() => {
    if (open) { setSummary(''); setCategory(''); setResolved(null); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Encerrar Atendimento</DialogTitle>
          <DialogDescription>Preencha todos os campos obrigatórios para encerrar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Resumo do atendimento *</Label>
            <Textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Descreva o que foi tratado neste atendimento (mín. 10 caracteres)..."
              className="min-h-[80px] text-sm resize-none"
            />
            {summary.length > 0 && summary.trim().length < 10 && (
              <p className="text-[10px] text-destructive">Mínimo 10 caracteres</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Classificação do assunto *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {CLOSURE_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value} className="text-sm">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resolved? */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Status final *</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={resolved === true ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setResolved(true)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Resolvido
              </Button>
              <Button
                type="button"
                variant={resolved === false ? 'destructive' : 'outline'}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setResolved(false)}
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Não resolvido
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!isValid || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Encerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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

      <div className="flex items-center gap-1">
        <Puzzle className="h-3 w-3 text-muted-foreground" />
        <Input
          defaultValue={moduleRef ?? ''}
          placeholder="Módulo"
          className="h-6 w-28 text-[10px] border-dashed"
          onBlur={e => updateSession('module_reference', e.target.value || null)}
        />
      </div>

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
  const [activeSession, setActiveSession] = useState<{
    id: string;
    status: ChatSessionStatus;
    tags: string[];
    priority: string;
    module_reference: string | null;
  } | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showClosureDialog, setShowClosureDialog] = useState(false);
  const [closureSubmitting, setClosureSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    const { data, count } = await supabase
      .from('support_chat_sessions')
      .select('id, status, tags, priority, module_reference', { count: 'exact' })
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: false })
      .limit(1);
    setSessionCount(count ?? 0);
    if (data && data.length > 0) {
      const s = data[0];
      setActiveSession({
        id: s.id,
        status: s.status as ChatSessionStatus,
        tags: (s.tags as string[]) ?? [],
        priority: (s.priority as string) ?? 'medium',
        module_reference: s.module_reference as string | null,
      });
    } else {
      setActiveSession(null);
    }
  }, [ticket.id]);

  useEffect(() => { loadSession(); }, [loadSession]);

  // ── Agent Actions ──

  const handleStartSession = async () => {
    setActionLoading('start');
    try {
      // If session exists and is paused, resume it
      if (activeSession && activeSession.status === 'paused') {
        await ChatService.updateSessionStatus(activeSession.id, 'active');
      } else if (!activeSession || activeSession.status === 'closed') {
        // Create new session
        await ChatService.getOrCreateSession({
          ticket_id: ticket.id,
          tenant_id: ticket.tenant_id,
          assigned_agent_id: userId,
        });
      }
      // Also assign agent + set ticket to in_progress
      await supabase
        .from('support_tickets')
        .update({ status: 'in_progress' as TicketStatus, assigned_to: userId })
        .eq('id', ticket.id);
      onStatusChange?.('in_progress');
      toast.success('Atendimento iniciado');
      await loadSession();
    } catch { toast.error('Erro ao iniciar atendimento'); }
    finally { setActionLoading(null); }
  };

  const handlePauseSession = async () => {
    if (!activeSession) return;
    setActionLoading('pause');
    try {
      await ChatService.updateSessionStatus(activeSession.id, 'paused');
      toast.success('Atendimento pausado');
      await loadSession();
    } catch { toast.error('Erro ao pausar'); }
    finally { setActionLoading(null); }
  };

  const handleCloseSession = async (data: { summary: string; category: string; resolved: boolean }) => {
    if (!activeSession) return;
    setClosureSubmitting(true);
    try {
      // Update session with closure data
      const { error: sessionErr } = await supabase
        .from('support_chat_sessions')
        .update({
          status: 'closed',
          ended_at: new Date().toISOString(),
          closure_summary: data.summary,
          closure_category: data.category,
          closure_resolved: data.resolved,
        })
        .eq('id', activeSession.id);
      if (sessionErr) throw sessionErr;

      // Update ticket status
      const ticketStatus: TicketStatus = data.resolved ? 'resolved' : 'closed';
      const ticketUpdates: Record<string, unknown> = { status: ticketStatus };
      if (data.resolved) ticketUpdates.resolved_at = new Date().toISOString();
      else ticketUpdates.closed_at = new Date().toISOString();

      await supabase.from('support_tickets').update(ticketUpdates).eq('id', ticket.id);

      // Add system note with closure summary
      await supabase.from('support_chat_notes').insert({
        session_id: activeSession.id,
        agent_id: userId,
        note_text: `🔒 Encerramento: ${data.resolved ? '✅ Resolvido' : '⚠️ Não resolvido'}\nCategoria: ${data.category}\nResumo: ${data.summary}`,
        is_internal: true,
      });

      onStatusChange?.(ticketStatus);
      toast.success('Atendimento encerrado');
      setShowClosureDialog(false);
      await loadSession();
    } catch { toast.error('Erro ao encerrar atendimento'); }
    finally { setClosureSubmitting(false); }
  };

  const handleAddNote = () => {
    setShowNotes(true);
  };

  const slaColor = sla.responded
    ? 'hsl(145 60% 42%)'
    : sla.isBreached
      ? 'hsl(0 70% 50%)'
      : sla.isWarning
        ? 'hsl(35 80% 50%)'
        : 'hsl(145 60% 42%)';

  const sessionStatus = activeSession?.status ?? 'closed';
  const isActive = sessionStatus === 'active';
  const isPaused = sessionStatus === 'paused';
  const isClosed = sessionStatus === 'closed';

  return (
    <div className="flex flex-col h-full">
      {/* Governance Header */}
      <div className="px-4 py-2.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
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

          {/* Session badge */}
          {activeSession && (
            <Badge
              variant="outline"
              className={cn('text-[10px] gap-1', isActive && 'border-[hsl(145_60%_42%/0.4)] text-[hsl(145_60%_42%)]', isPaused && 'border-[hsl(35_80%_50%/0.4)] text-[hsl(35_80%_50%)]')}
            >
              {isActive ? <Play className="h-2.5 w-2.5" /> : isPaused ? <Pause className="h-2.5 w-2.5" /> : <Square className="h-2.5 w-2.5" />}
              {isActive ? 'Ativo' : isPaused ? 'Pausado' : 'Encerrado'}
            </Badge>
          )}

          {/* Audit badge */}
          <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" /> Auditável
          </Badge>

          {/* ── Agent Action Buttons ── */}
          <div className="ml-auto flex items-center gap-1.5">
            {/* Iniciar Atendimento / Retomar */}
            {(!activeSession || isClosed || isPaused) && (
              <Button
                size="sm"
                className="h-7 text-[10px] gap-1"
                onClick={handleStartSession}
                disabled={actionLoading === 'start'}
              >
                {actionLoading === 'start' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                {isPaused ? 'Retomar' : 'Iniciar Atendimento'}
              </Button>
            )}

            {/* Pausar */}
            {isActive && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1"
                onClick={handlePauseSession}
                disabled={actionLoading === 'pause'}
              >
                {actionLoading === 'pause' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pause className="h-3 w-3" />}
                Pausar
              </Button>
            )}

            {/* Encerrar */}
            {(isActive || isPaused) && (
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-[10px] gap-1"
                onClick={() => setShowClosureDialog(true)}
              >
                <Square className="h-3 w-3" /> Encerrar
              </Button>
            )}

            {/* Adicionar Observação */}
            <Button
              variant={showNotes ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-[10px] gap-1"
              onClick={handleAddNote}
            >
              <StickyNote className="h-3 w-3" /> Observação
            </Button>
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

        {showNotes && (
          <div className="w-[280px] shrink-0 bg-card flex flex-col">
            <InternalNotesPanel sessionId={activeSession?.id ?? null} agentId={userId} />
          </div>
        )}
      </div>

      {/* Closure Dialog */}
      <ClosureDialog
        open={showClosureDialog}
        onOpenChange={setShowClosureDialog}
        onConfirm={handleCloseSession}
        submitting={closureSubmitting}
      />
    </div>
  );
}
