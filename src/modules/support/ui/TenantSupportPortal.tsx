import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Plus, MessageSquare, Clock, CheckCircle2, AlertCircle, Send,
  BookOpen, Search, Star, ArrowLeft, Loader2, Filter,
  Circle, Radio,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { TicketService } from '@/domains/support/ticket-service';
import { WikiService } from '@/domains/support/wiki-service';
import { EvaluationService } from '@/domains/support/evaluation-service';
import { useSupportModuleVersion } from '@/domains/platform-versioning/use-support-module-version';
import LiveChatWindow from './LiveChatWindow';
import type { SupportTicket, TicketMessage, WikiArticle, TicketPriority, TicketCategory, TicketStatus } from '@/domains/support/types';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: 'Aberto', color: 'hsl(210 65% 50%)', icon: AlertCircle },
  awaiting_agent: { label: 'Aguardando Agente', color: 'hsl(35 80% 50%)', icon: Clock },
  awaiting_customer: { label: 'Aguardando Resposta', color: 'hsl(280 60% 55%)', icon: Clock },
  in_progress: { label: 'Em Andamento', color: 'hsl(200 70% 50%)', icon: Loader2 },
  resolved: { label: 'Resolvido', color: 'hsl(145 60% 42%)', icon: CheckCircle2 },
  closed: { label: 'Fechado', color: 'hsl(0 0% 50%)', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', color: 'hsl(0 60% 50%)', icon: AlertCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'hsl(200 50% 55%)' },
  medium: { label: 'Média', color: 'hsl(35 80% 50%)' },
  high: { label: 'Alta', color: 'hsl(20 80% 50%)' },
  urgent: { label: 'Urgente', color: 'hsl(0 70% 50%)' },
};

const CATEGORY_LABELS: Record<string, string> = {
  billing: 'Faturamento',
  technical: 'Técnico',
  feature_request: 'Solicitação',
  bug_report: 'Bug',
  account: 'Conta',
  general: 'Geral',
};

// ── Main Component ──

const TenantSupportPortal = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [activeTab, setActiveTab] = useState('tickets');

  // Resolve feature flags for this tenant — respects active sandbox preview sessions
  const { flag, isPreview, loading: flagsLoading } = useSupportModuleVersion(currentTenant?.id);

  const liveChatEnabled = flag('live_chat_enabled', true);
  const wikiEnabled = flag('wiki_enabled', true);

  if (!currentTenant || !user) {
    return <div className="p-6 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de Suporte</h1>
          <p className="text-sm text-muted-foreground">Abra tickets e consulte a base de conhecimento</p>
        </div>
        {isPreview && (
          <span className="ml-auto text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            Preview ativo
          </span>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tickets" className="gap-2">
            <MessageSquare className="h-4 w-4" /> Meus Tickets
          </TabsTrigger>
          {wikiEnabled && (
            <TabsTrigger value="wiki" className="gap-2">
              <BookOpen className="h-4 w-4" /> Base de Conhecimento
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="tickets" className="mt-4">
          <TicketPanel
            tenantId={currentTenant.id}
            userId={user.id}
            liveChatEnabled={liveChatEnabled}
            evaluationEnabled={flag('ticket_evaluation_enabled', true)}
          />
        </TabsContent>

        {wikiEnabled && (
          <TabsContent value="wiki" className="mt-4">
            <WikiPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

// ── Ticket Panel ──

function TicketPanel({
  tenantId,
  userId,
  liveChatEnabled,
  evaluationEnabled,
}: {
  tenantId: string;
  userId: string;
  liveChatEnabled: boolean;
  evaluationEnabled: boolean;
}) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await TicketService.listByTenant(tenantId);
      setTickets(data);
    } catch { toast.error('Erro ao carregar tickets'); }
    finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (searchQuery && !t.subject.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [tickets, statusFilter, searchQuery]);

  if (selectedTicket) {
    return (
      <TicketDetail
        ticket={selectedTicket}
        userId={userId}
        tenantId={tenantId}
        liveChatEnabled={liveChatEnabled}
        evaluationEnabled={evaluationEnabled}
        onBack={() => { setSelectedTicket(null); loadTickets(); }}
      />
    );
  }

  // Quick status counts
  const openCount = tickets.filter(t => ['open', 'awaiting_agent', 'in_progress'].includes(t.status)).length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold text-foreground">{tickets.length}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold" style={{ color: 'hsl(35 80% 50%)' }}>{openCount}</p>
            <p className="text-[10px] text-muted-foreground">Em Aberto</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold" style={{ color: 'hsl(145 60% 42%)' }}>{resolvedCount}</p>
            <p className="text-[10px] text-muted-foreground">Resolvidos</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tickets..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Novo Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Abrir Novo Ticket</DialogTitle>
            </DialogHeader>
            <NewTicketForm
              tenantId={tenantId}
              userId={userId}
              onCreated={() => { setShowNewTicket(false); loadTickets(); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum ticket encontrado.</p>
            <p className="text-xs mt-1">Clique em "Novo Ticket" para solicitar suporte.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(ticket => {
            const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
            const pr = PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG.medium;
            const StatusIcon = st.icon;
            return (
              <Card
                key={ticket.id}
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => setSelectedTicket(ticket)}
              >
                <CardContent className="py-3 px-4 flex items-center gap-4">
                  <StatusIcon className="h-5 w-5 shrink-0" style={{ color: st.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {CATEGORY_LABELS[ticket.category]} · {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]" style={{ backgroundColor: `${pr.color}15`, color: pr.color }}>
                    {pr.label}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]" style={{ backgroundColor: `${st.color}15`, color: st.color }}>
                    {st.label}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── New Ticket Form ──

// ── Visual Timeline ──

function TicketTimeline({ ticket }: { ticket: SupportTicket }) {
  const LIFECYCLE: Array<{ key: string; label: string; color: string; dateField?: keyof SupportTicket }> = [
    { key: 'created', label: 'Criado', color: 'hsl(210 65% 50%)', dateField: 'created_at' },
    { key: 'first_response', label: 'Primeira Resposta', color: 'hsl(200 70% 50%)', dateField: 'first_response_at' },
    { key: 'resolved', label: 'Resolvido', color: 'hsl(145 60% 42%)', dateField: 'resolved_at' },
  ];

  // Determine which steps are done
  const steps = LIFECYCLE.map(step => {
    const dateVal = step.dateField ? (ticket as any)[step.dateField] : null;
    const done = !!dateVal;
    return { ...step, done, date: dateVal ? new Date(dateVal as string) : null };
  });

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
                step.done
                  ? 'border-transparent'
                  : 'border-muted bg-background'
              }`}
              style={step.done ? { backgroundColor: step.color } : undefined}
            >
              {step.done ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              ) : (
                <Circle className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <p className={`text-[10px] mt-1.5 text-center leading-tight max-w-[70px] ${step.done ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {step.label}
            </p>
            {step.date && (
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {step.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                {' '}
                {step.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 w-10 mx-1 rounded-full transition-colors ${
                steps[i + 1].done ? 'bg-primary' : 'bg-muted'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function NewTicketForm({ tenantId, userId, onCreated }: { tenantId: string; userId: string; onCreated: () => void }) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [category, setCategory] = useState<TicketCategory>('general');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      toast.error('Preencha assunto e descrição');
      return;
    }
    try {
      setSubmitting(true);
      await TicketService.create({ tenant_id: tenantId, subject, description, priority, category }, userId);
      toast.success('Ticket criado com sucesso!');
      onCreated();
    } catch { toast.error('Erro ao criar ticket'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-4">
      <Input placeholder="Assunto" value={subject} onChange={e => setSubject(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Select value={category} onValueChange={v => setCategory(v as TicketCategory)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={v => setPriority(v as TicketPriority)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Textarea placeholder="Descreva seu problema em detalhes..." value={description} onChange={e => setDescription(e.target.value)} rows={5} />
      <Button onClick={handleSubmit} disabled={submitting} className="w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Enviar Ticket
      </Button>
    </div>
  );
}

// ── Ticket Detail + Chat ──

function TicketDetail({
  ticket,
  userId,
  tenantId,
  liveChatEnabled,
  evaluationEnabled,
  onBack,
}: {
  ticket: SupportTicket;
  userId: string;
  tenantId: string;
  liveChatEnabled: boolean;
  evaluationEnabled: boolean;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [evaluation, setEvaluation] = useState<{ rating: number; feedback: string } | null>(null);
  const [existingEval, setExistingEval] = useState(false);
  const [showEvalDialog, setShowEvalDialog] = useState(false);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const msgs = await TicketService.getMessages(ticket.id);
      setMessages(msgs);
      const ev = await EvaluationService.getByTicket(ticket.id);
      if (ev) setExistingEval(true);
    } catch { toast.error('Erro ao carregar mensagens'); }
    finally { setLoading(false); }
  }, [ticket.id]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const handleSend = async () => {
    if (!newMsg.trim()) return;
    try {
      setSending(true);
      await TicketService.sendMessage({ ticket_id: ticket.id, content: newMsg, sender_type: 'tenant_user' }, userId);
      setNewMsg('');
      await loadMessages();
    } catch { toast.error('Erro ao enviar mensagem'); }
    finally { setSending(false); }
  };

  const handleEvaluate = async () => {
    if (!evaluation || evaluation.rating === 0) return;
    try {
      await EvaluationService.createTicketEvaluation({
        ticket_id: ticket.id,
        tenant_id: tenantId,
        agent_id: ticket.assigned_to,
        agent_score: evaluation.rating,
        system_score: null,
        comment: evaluation.feedback || undefined,
      });
      toast.success('Avaliação enviada!');
      setExistingEval(true);
      setShowEvalDialog(false);
    } catch { toast.error('Erro ao enviar avaliação'); }
  };

  const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
  const canChat = !isResolved && ticket.status !== 'cancelled';

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{ticket.subject}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {CATEGORY_LABELS[ticket.category]} · Criado em {new Date(ticket.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
            <Badge style={{ backgroundColor: `${st.color}15`, color: st.color }}>{st.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>

          {/* ── Visual Timeline ── */}
          <div className="pt-3 border-t">
            <p className="text-xs font-medium text-foreground mb-3">Linha do Tempo</p>
            <TicketTimeline ticket={ticket} />
          </div>
        </CardContent>
      </Card>

      {/* Communication Tabs */}
      <Tabs defaultValue={liveChatEnabled ? 'chat' : 'messages'} className="w-full">
        <TabsList className="w-full justify-start">
          {liveChatEnabled && (
            <TabsTrigger value="chat" className="gap-2">
              <Radio className="h-3.5 w-3.5" /> Chat ao Vivo
            </TabsTrigger>
          )}
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-3.5 w-3.5" /> Mensagens
          </TabsTrigger>
        </TabsList>

        {liveChatEnabled && (
          <TabsContent value="chat" className="mt-3">
            <LiveChatWindow
              ticketId={ticket.id}
              tenantId={tenantId}
              userId={userId}
              senderType="tenant"
              assignedAgentId={ticket.assigned_to}
              ticketSubject={ticket.subject}
            />
          </TabsContent>
        )}

        <TabsContent value="messages" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Histórico de Mensagens</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : messages.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhuma mensagem ainda.</p>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3">
                    {messages.map(msg => {
                      const isMe = msg.sender_type === 'tenant_user';
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                              {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              {!isMe && ' · Suporte'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              {canChat && (
                <div className="flex gap-2 mt-4">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  />
                  <Button size="icon" onClick={handleSend} disabled={sending || !newMsg.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              )}

              {isResolved && !existingEval && evaluationEnabled && (
                <div className="mt-4 pt-4 border-t">
                  <Dialog open={showEvalDialog} onOpenChange={setShowEvalDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Star className="h-4 w-4" /> Avaliar Atendimento
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-sm">
                      <DialogHeader><DialogTitle>Avaliar Atendimento</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div className="flex justify-center gap-2">
                          {[1, 2, 3, 4, 5].map(n => (
                            <button
                              key={n}
                              onClick={() => setEvaluation(prev => ({ feedback: prev?.feedback ?? '', rating: n }))}
                              className="p-1 transition-transform hover:scale-110"
                            >
                              <Star
                                className="h-7 w-7"
                                fill={(evaluation?.rating ?? 0) >= n ? 'hsl(45 90% 55%)' : 'transparent'}
                                stroke={(evaluation?.rating ?? 0) >= n ? 'hsl(45 90% 55%)' : 'hsl(var(--muted-foreground))'}
                              />
                            </button>
                          ))}
                        </div>
                        <Textarea
                          placeholder="Comentários (opcional)"
                          value={evaluation?.feedback ?? ''}
                          onChange={e => setEvaluation(prev => ({ rating: prev?.rating ?? 0, feedback: e.target.value }))}
                          rows={3}
                        />
                        <Button onClick={handleEvaluate} className="w-full" disabled={!evaluation || evaluation.rating === 0}>
                          Enviar Avaliação
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Wiki Panel ──

function WikiPanel() {
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<WikiArticle | null>(null);

  useEffect(() => {
    WikiService.listPublished()
      .then(setArticles)
      .catch(() => toast.error('Erro ao carregar artigos'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = articles.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.tags ?? []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  if (selectedArticle) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedArticle(null)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>{selectedArticle.title}</CardTitle>
            {selectedArticle.support_wiki_categories && (
              <Badge variant="secondary" className="w-fit">{selectedArticle.support_wiki_categories.name}</Badge>
            )}
          </CardHeader>
          <CardContent>
            <SafeHtml
              html={selectedArticle.content_html}
              className="prose prose-sm dark:prose-invert max-w-none"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar artigo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum artigo encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(article => (
            <Card
              key={article.id}
              className="cursor-pointer hover:shadow-sm transition-shadow"
              onClick={() => setSelectedArticle(article)}
            >
              <CardContent className="py-4 px-4">
                <p className="text-sm font-medium text-foreground">{article.title}</p>
                {article.support_wiki_categories && (
                  <p className="text-xs text-muted-foreground mt-1">{article.support_wiki_categories.name}</p>
                )}
                {article.tags && article.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {article.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default TenantSupportPortal;
