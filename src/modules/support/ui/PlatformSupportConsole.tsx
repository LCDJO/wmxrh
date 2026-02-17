import { useState, useEffect, useCallback } from 'react';
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
  MessageSquare, Clock, CheckCircle2, AlertCircle, Send, Users,
  BookOpen, Search, Star, ArrowLeft, Loader2, Eye, Lock, BarChart3,
  Plus, Inbox, UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { TicketService } from '@/domains/support/ticket-service';
import { WikiService } from '@/domains/support/wiki-service';
import { EvaluationService } from '@/domains/support/evaluation-service';
import type {
  SupportTicket, TicketMessage, WikiArticle, WikiCategory,
  SupportEvaluation, TicketStatus,
} from '@/domains/support/types';

// ── Shared configs ──

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: 'Aberto', color: 'hsl(210 65% 50%)', icon: AlertCircle },
  awaiting_agent: { label: 'Aguardando Agente', color: 'hsl(35 80% 50%)', icon: Clock },
  awaiting_customer: { label: 'Aguardando Cliente', color: 'hsl(280 60% 55%)', icon: Clock },
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
  billing: 'Faturamento', technical: 'Técnico', feature_request: 'Solicitação',
  bug_report: 'Bug', account: 'Conta', general: 'Geral',
};

// ── Main Component ──

const PlatformSupportConsole = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('queue');

  if (!user) return <div className="p-6 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <Inbox className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Console de Suporte</h1>
          <p className="text-sm text-muted-foreground">Gerencie tickets, wiki e avaliações</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="queue" className="gap-2"><Inbox className="h-4 w-4" /> Fila</TabsTrigger>
          <TabsTrigger value="wiki" className="gap-2"><BookOpen className="h-4 w-4" /> Wiki</TabsTrigger>
          <TabsTrigger value="evaluations" className="gap-2"><Star className="h-4 w-4" /> Avaliações</TabsTrigger>
          <TabsTrigger value="metrics" className="gap-2"><BarChart3 className="h-4 w-4" /> Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          <TicketQueue userId={user.id} />
        </TabsContent>
        <TabsContent value="wiki" className="mt-4">
          <WikiManager userId={user.id} />
        </TabsContent>
        <TabsContent value="evaluations" className="mt-4">
          <EvaluationsPanel />
        </TabsContent>
        <TabsContent value="metrics" className="mt-4">
          <MetricsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ── Ticket Queue ──

function TicketQueue({ userId }: { userId: string }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selected, setSelected] = useState<SupportTicket | null>(null);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const statusFilter = filter !== 'all' ? filter as TicketStatus : undefined;
      const data = await TicketService.listAll(statusFilter ? { status: statusFilter } : undefined);
      setTickets(data);
    } catch { toast.error('Erro ao carregar tickets'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  if (selected) {
    return (
      <AgentTicketView
        ticket={selected}
        userId={userId}
        onBack={() => { setSelected(null); loadTickets(); }}
      />
    );
  }

  const statusCounts = tickets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: tickets.length, color: 'hsl(210 65% 50%)' },
          { label: 'Abertos', value: statusCounts['open'] ?? 0, color: 'hsl(35 80% 50%)' },
          { label: 'Em Andamento', value: statusCounts['in_progress'] ?? 0, color: 'hsl(200 70% 50%)' },
          { label: 'Resolvidos', value: statusCounts['resolved'] ?? 0, color: 'hsl(145 60% 42%)' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="py-3 px-4">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 items-center">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {tickets.map(ticket => {
            const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
            const pr = PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG.medium;
            const StatusIcon = st.icon;
            return (
              <Card key={ticket.id} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setSelected(ticket)}>
                <CardContent className="py-3 px-4 flex items-center gap-4">
                  <StatusIcon className="h-5 w-5 shrink-0" style={{ color: st.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {CATEGORY_LABELS[ticket.category]} · {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                      {ticket.assigned_to ? ' · Atribuído' : ' · Não atribuído'}
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

// ── Agent Ticket View ──

function AgentTicketView({ ticket, userId, onBack }: { ticket: SupportTicket; userId: string; onBack: () => void }) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState<string>(ticket.status);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const msgs = await TicketService.getMessages(ticket.id);
      setMessages(msgs);
    } catch { toast.error('Erro ao carregar mensagens'); }
    finally { setLoading(false); }
  }, [ticket.id]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const handleSend = async () => {
    if (!newMsg.trim()) return;
    try {
      setSending(true);
      await TicketService.sendMessage(
        { ticket_id: ticket.id, content: newMsg, sender_type: 'platform_agent', is_internal: isInternal },
        userId,
      );
      setNewMsg('');
      setIsInternal(false);
      await loadMessages();
    } catch { toast.error('Erro ao enviar'); }
    finally { setSending(false); }
  };

  const handleAssign = async () => {
    try {
      await TicketService.assign(ticket.id, userId);
      toast.success('Ticket atribuído a você');
    } catch { toast.error('Erro ao atribuir'); }
  };

  const handleStatusChange = async () => {
    if (newStatus === ticket.status) return;
    try {
      await TicketService.updateStatus(ticket.id, newStatus as TicketStatus);
      toast.success('Status atualizado');
    } catch { toast.error('Erro ao atualizar status'); }
  };

  const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar à Fila
      </Button>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{ticket.subject}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Tenant: {ticket.tenant_id.slice(0, 8)}… · {CATEGORY_LABELS[ticket.category]} · {new Date(ticket.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
            <Badge style={{ backgroundColor: `${st.color}15`, color: st.color }}>{st.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
          <div className="flex gap-2 pt-2 border-t">
            {!ticket.assigned_to && (
              <Button size="sm" variant="outline" onClick={handleAssign} className="gap-2">
                <UserCheck className="h-4 w-4" /> Assumir Ticket
              </Button>
            )}
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleStatusChange} disabled={newStatus === ticket.status}>
              Atualizar Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Conversação</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {messages.map(msg => {
                  const isAgent = msg.sender_type === 'platform_agent';
                  return (
                    <div key={msg.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        msg.is_internal
                          ? 'bg-amber-500/10 border border-amber-500/20 text-foreground'
                          : isAgent
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                      }`}>
                        {msg.is_internal && (
                          <div className="flex items-center gap-1 text-[10px] text-amber-600 mb-1">
                            <Lock className="h-3 w-3" /> Nota interna
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isAgent ? (msg.is_internal ? 'text-muted-foreground' : 'text-primary-foreground/60') : 'text-muted-foreground'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}{isAgent ? 'Você' : 'Cliente'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <div className="flex gap-2 mt-4 items-end">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={e => setIsInternal(e.target.checked)}
                    className="rounded border-border"
                  />
                  <Lock className="h-3 w-3" /> Nota interna
                </label>
              </div>
              <Input
                placeholder={isInternal ? 'Nota interna (invisível ao cliente)...' : 'Responder ao cliente...'}
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              />
            </div>
            <Button size="icon" onClick={handleSend} disabled={sending || !newMsg.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Wiki Manager ──

function WikiManager({ userId }: { userId: string }) {
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [categories, setCategories] = useState<WikiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [arts, cats] = await Promise.all([WikiService.listAll(), WikiService.listCategories()]);
      setArticles(arts);
      setCategories(cats);
    } catch { toast.error('Erro ao carregar wiki'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{articles.length} artigo(s)</p>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo Artigo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Novo Artigo</DialogTitle></DialogHeader>
            <NewArticleForm
              categories={categories}
              userId={userId}
              onCreated={() => { setShowNew(false); load(); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {articles.map(a => (
            <Card key={a.id}>
              <CardContent className="py-3 px-4 flex items-center gap-4">
                <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.support_wiki_categories?.name ?? 'Sem categoria'} · {a.view_count} views
                  </p>
                </div>
                <Badge variant={a.is_published ? 'default' : 'secondary'} className="text-[10px]">
                  {a.is_published ? 'Publicado' : 'Rascunho'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewArticleForm({ categories, userId, onCreated }: { categories: WikiCategory[]; userId: string; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [publish, setPublish] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Preencha título e conteúdo');
      return;
    }
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    try {
      setSubmitting(true);
      await WikiService.create({
        title,
        slug,
        content_html: content,
        content_plain: content.replace(/<[^>]*>/g, ''),
        category_id: categoryId || null,
        is_published: publish,
        published_at: publish ? new Date().toISOString() : null,
        author_id: userId,
      });
      toast.success('Artigo criado!');
      onCreated();
    } catch { toast.error('Erro ao criar artigo'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-4">
      <Input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} />
      <Select value={categoryId} onValueChange={setCategoryId}>
        <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
        <SelectContent>
          {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Textarea placeholder="Conteúdo (HTML)" value={content} onChange={e => setContent(e.target.value)} rows={8} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)} />
        Publicar imediatamente
      </label>
      <Button onClick={handleSubmit} disabled={submitting} className="w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Criar Artigo
      </Button>
    </div>
  );
}

// ── Evaluations Panel ──

function EvaluationsPanel() {
  const [evaluations, setEvaluations] = useState<SupportEvaluation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    EvaluationService.listAll()
      .then(setEvaluations)
      .catch(() => toast.error('Erro ao carregar avaliações'))
      .finally(() => setLoading(false));
  }, []);

  const avgRating = evaluations.length > 0
    ? (evaluations.reduce((s, e) => s + e.rating, 0) / evaluations.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <p className="text-3xl font-bold text-foreground">{avgRating}</p>
            <div className="flex justify-center gap-0.5 my-1">
              {[1, 2, 3, 4, 5].map(n => (
                <Star key={n} className="h-4 w-4" fill={parseFloat(avgRating) >= n ? 'hsl(45 90% 55%)' : 'transparent'} stroke="hsl(45 90% 55%)" />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Nota Média</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <p className="text-3xl font-bold text-foreground">{evaluations.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total de Avaliações</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <p className="text-3xl font-bold text-foreground">
              {evaluations.filter(e => e.rating >= 4).length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Positivas (≥4★)</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {evaluations.map(ev => (
            <Card key={ev.id}>
              <CardContent className="py-3 px-4 flex items-center gap-4">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} className="h-3.5 w-3.5" fill={ev.rating >= n ? 'hsl(45 90% 55%)' : 'transparent'} stroke="hsl(45 90% 55%)" />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{ev.feedback || 'Sem comentário'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(ev.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Metrics Dashboard ──

function MetricsDashboard() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    TicketService.listAll()
      .then(setTickets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const total = tickets.length;
  const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
  const avgResolutionMs = tickets
    .filter(t => t.resolved_at)
    .map(t => new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime());
  const avgHours = avgResolutionMs.length > 0
    ? (avgResolutionMs.reduce((a, b) => a + b, 0) / avgResolutionMs.length / 3600000).toFixed(1)
    : '—';

  const byCategory = Object.entries(
    tickets.reduce((acc, t) => { acc[t.category] = (acc[t.category] ?? 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: total, color: 'hsl(210 65% 50%)' },
          { label: 'Resolvidos', value: resolved, color: 'hsl(145 60% 42%)' },
          { label: 'Taxa Resolução', value: total > 0 ? `${Math.round(resolved / total * 100)}%` : '—', color: 'hsl(280 60% 55%)' },
          { label: 'Tempo Médio (h)', value: avgHours, color: 'hsl(35 80% 50%)' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="py-4 px-4">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Por Categoria</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {byCategory.map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-sm text-foreground">{CATEGORY_LABELS[cat] ?? cat}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(count / total) * 100}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PlatformSupportConsole;
