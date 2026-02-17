import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  MessageSquare, Clock, CheckCircle2, AlertCircle,
  Send, Star, ArrowLeft, Loader2, Plus, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { TicketService } from '@/domains/support/ticket-service';
import { EvaluationService } from '@/domains/support/evaluation-service';
import type { SupportTicket, TicketMessage } from '@/domains/support/types';

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
  billing: 'Faturamento', technical: 'Técnico', feature_request: 'Solicitação',
  bug_report: 'Bug', account: 'Conta', general: 'Geral',
};

export default function SupportTickets() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [search, setSearch] = useState('');

  const loadTickets = useCallback(async () => {
    if (!currentTenant) return;
    try {
      setLoading(true);
      const data = await TicketService.listByTenant(currentTenant.id);
      setTickets(data);
    } catch { toast.error('Erro ao carregar chamados'); }
    finally { setLoading(false); }
  }, [currentTenant]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  if (!user || !currentTenant) return null;

  const filtered = tickets.filter(t =>
    t.subject.toLowerCase().includes(search.toLowerCase())
  );

  if (selectedTicket) {
    return (
      <TicketDetail
        ticket={selectedTicket}
        userId={user.id}
        tenantId={currentTenant.id}
        onBack={() => { setSelectedTicket(null); loadTickets(); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meus Chamados</h1>
          <p className="text-sm text-muted-foreground">{tickets.length} chamado(s) registrado(s)</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar chamados..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" className="gap-2" onClick={() => navigate('/support/new')}>
          <Plus className="h-4 w-4" /> Novo Chamado
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum chamado encontrado.</p>
            <p className="text-xs mt-1">Clique em "Novo Chamado" para abrir um ticket.</p>
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

// ── Ticket Detail + Chat ──

function TicketDetail({ ticket, userId, tenantId, onBack }: { ticket: SupportTicket; userId: string; tenantId: string; onBack: () => void }) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agentRating, setAgentRating] = useState(0);
  const [systemRating, setSystemRating] = useState(0);
  const [evalFeedback, setEvalFeedback] = useState('');
  const [existingEval, setExistingEval] = useState(false);
  const [submittingEval, setSubmittingEval] = useState(false);

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

  const handleSubmitEvaluation = async () => {
    if (agentRating === 0 && systemRating === 0) return;
    try {
      setSubmittingEval(true);
      await EvaluationService.createTicketEvaluation({
        ticket_id: ticket.id,
        tenant_id: tenantId,
        agent_id: ticket.assigned_to,
        agent_score: agentRating > 0 ? agentRating : null,
        system_score: systemRating > 0 ? systemRating : null,
        comment: evalFeedback || undefined,
      });
      toast.success('Avaliação enviada! Obrigado pelo feedback.');
      setExistingEval(true);
    } catch { toast.error('Erro ao enviar avaliação'); }
    finally { setSubmittingEval(false); }
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
        <CardContent className="py-4 px-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{ticket.subject}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {CATEGORY_LABELS[ticket.category]} · Criado em {new Date(ticket.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
            <Badge style={{ backgroundColor: `${st.color}15`, color: st.color }}>{st.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-3">{ticket.description}</p>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card>
        <CardContent className="py-4 px-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Conversação</h3>
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
        </CardContent>
      </Card>

      {/* Evaluation Card — shown inline when ticket is resolved/closed */}
      {isResolved && !existingEval && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardContent className="py-5 px-5 space-y-5">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Avalie este atendimento</h3>
            </div>

            {/* Agent rating */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Avaliação do Atendente</p>
              <p className="text-[11px] text-muted-foreground">Como foi a qualidade do suporte recebido?</p>
              <StarRatingRow value={agentRating} onChange={setAgentRating} />
            </div>

            {/* System rating */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Avaliação do Sistema</p>
              <p className="text-[11px] text-muted-foreground">Como avalia a experiência geral com a plataforma?</p>
              <StarRatingRow value={systemRating} onChange={setSystemRating} />
            </div>

            {/* Feedback */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Comentário <span className="text-muted-foreground font-normal">(opcional)</span></p>
              <Textarea
                placeholder="Deixe um comentário sobre sua experiência..."
                value={evalFeedback}
                onChange={e => setEvalFeedback(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>

            <Button
              onClick={handleSubmitEvaluation}
              disabled={submittingEval || (agentRating === 0 && systemRating === 0)}
              className="w-full gap-2"
            >
              {submittingEval ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar Avaliação
            </Button>
          </CardContent>
        </Card>
      )}

      {isResolved && existingEval && (
        <Card className="border-green-500/20 bg-green-500/[0.03]">
          <CardContent className="py-4 px-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <p className="text-sm text-foreground">Você já avaliou este chamado. Obrigado!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Star Rating Row Component ──

function StarRatingRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const labels = ['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente'];

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              className="h-6 w-6 transition-colors"
              fill={(hover || value) >= n ? 'hsl(45 93% 47%)' : 'transparent'}
              stroke={(hover || value) >= n ? 'hsl(45 93% 47%)' : 'hsl(var(--muted-foreground))'}
            />
          </button>
        ))}
      </div>
      {(hover || value) > 0 && (
        <span className="text-xs text-muted-foreground">{labels[hover || value]}</span>
      )}
    </div>
  );
}
