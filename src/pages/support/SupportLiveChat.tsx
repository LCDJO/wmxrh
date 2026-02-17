import { useState, useEffect, useCallback } from 'react';
import { Headphones, Plus, Loader2, Clock, Hash, User, Calendar, Building2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { TicketService } from '@/domains/support/ticket-service';
import { ChatService } from '@/domains/support/chat-service';
import LiveChatWindow from '@/modules/support/ui/LiveChatWindow';
import type { SupportTicket } from '@/domains/support/types';
import type { ChatSession } from '@/domains/support/types';
import { supabase } from '@/integrations/supabase/client';

const STATUS_COLORS: Record<string, string> = {
  open: 'hsl(210 65% 50%)',
  awaiting_agent: 'hsl(35 80% 50%)',
  awaiting_customer: 'hsl(280 60% 55%)',
  in_progress: 'hsl(200 70% 50%)',
  resolved: 'hsl(145 60% 42%)',
  closed: 'hsl(0 0% 50%)',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  awaiting_agent: 'Aguardando',
  awaiting_customer: 'Resp. pendente',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

export default function SupportLiveChat() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showDetails, setShowDetails] = useState(true);

  const loadTickets = useCallback(async () => {
    if (!currentTenant) return;
    try {
      setLoading(true);
      const data = await TicketService.listByTenant(currentTenant.id);
      setTickets(data);
    } catch {
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  }, [currentTenant]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  // Load chat session when ticket is selected
  useEffect(() => {
    if (!selectedTicket || !currentTenant) {
      setChatSession(null);
      setAgentName(null);
      return;
    }
    let cancelled = false;
    async function loadSession() {
      try {
        const session = await ChatService.getOrCreateSession({
          ticket_id: selectedTicket!.id,
          tenant_id: currentTenant!.id,
          assigned_agent_id: selectedTicket!.assigned_to ?? undefined,
        });
        if (!cancelled) setChatSession(session);

        // Fetch agent name
        if (selectedTicket!.assigned_to) {
          const { data: agent } = await supabase
            .from('platform_users')
            .select('display_name')
            .eq('user_id', selectedTicket!.assigned_to)
            .maybeSingle();
          if (!cancelled && agent) setAgentName(agent.display_name ?? 'Agente');
        }
      } catch {
        // session will be created by LiveChatWindow
      }
    }
    loadSession();
    return () => { cancelled = true; };
  }, [selectedTicket, currentTenant]);

  const handleNewChat = async () => {
    if (!user || !currentTenant) return;
    try {
      setCreating(true);
      const ticket = await TicketService.create({
        tenant_id: currentTenant.id,
        subject: 'Chat ao Vivo',
        description: 'Atendimento iniciado via chat ao vivo.',
        category: 'general',
        priority: 'medium',
      }, user.id);
      await loadTickets();
      setSelectedTicket(ticket);
    } catch {
      toast.error('Erro ao iniciar conversa');
    } finally {
      setCreating(false);
    }
  };

  if (!user || !currentTenant) return null;

  return (
    <div className="flex h-[calc(100vh-120px)] rounded-xl border border-border overflow-hidden bg-background shadow-sm">
      {/* ── Left: Conversation list ── */}
      <div className="w-[320px] border-r border-border flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Headphones className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Conversas</h2>
          </div>
          <Button
            size="sm"
            variant="default"
            className="gap-1.5 h-8 text-xs"
            onClick={handleNewChat}
            disabled={creating}
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Nova conversa
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Headphones className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhuma conversa</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Nova conversa" para iniciar</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {tickets.map(ticket => {
                const isActive = selectedTicket?.id === ticket.id;
                const statusColor = STATUS_COLORS[ticket.status] ?? STATUS_COLORS.open;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-muted/50 ${
                      isActive ? 'bg-primary/5 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground truncate pr-2">{ticket.subject}</p>
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: statusColor }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(ticket.created_at).toLocaleDateString('pt-BR')} · {STATUS_LABELS[ticket.status] ?? ticket.status}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Center: Chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedTicket ? (
          <LiveChatWindow
            ticketId={selectedTicket.id}
            tenantId={currentTenant.id}
            userId={user.id}
            senderType="tenant"
            assignedAgentId={selectedTicket.assigned_to}
            ticketSubject={selectedTicket.subject}
            embedded
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="h-16 w-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto">
                <Headphones className="h-8 w-8 text-primary/40" />
              </div>
              <p className="text-sm text-muted-foreground">Selecione uma conversa ou inicie uma nova</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Details sidebar ── */}
      {selectedTicket && showDetails && (
        <div className="w-[280px] border-l border-border flex flex-col shrink-0 bg-muted/20">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Detalhes</h3>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowDetails(false)}>
              <span className="text-xs">✕</span>
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-5">
              {/* Protocol */}
              {chatSession?.protocol_number && (
                <DetailItem
                  icon={Hash}
                  label="Protocolo"
                  value={chatSession.protocol_number}
                  highlight
                />
              )}

              {/* Date */}
              <DetailItem
                icon={Calendar}
                label="Aberto em"
                value={new Date(selectedTicket.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                })}
              />

              {/* Time */}
              <DetailItem
                icon={Clock}
                label="Horário"
                value={new Date(selectedTicket.created_at).toLocaleTimeString('pt-BR', {
                  hour: '2-digit', minute: '2-digit',
                })}
              />

              <Separator />

              {/* Agent */}
              <DetailItem
                icon={User}
                label="Atendente"
                value={agentName ?? 'Aguardando atribuição'}
              />

              {/* Status */}
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</p>
                <Badge
                  variant="secondary"
                  className="text-xs"
                  style={{
                    backgroundColor: `${STATUS_COLORS[selectedTicket.status] ?? STATUS_COLORS.open}15`,
                    color: STATUS_COLORS[selectedTicket.status] ?? STATUS_COLORS.open,
                  }}
                >
                  {STATUS_LABELS[selectedTicket.status] ?? selectedTicket.status}
                </Badge>
              </div>

              <Separator />

              {/* Subject */}
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Assunto</p>
                <p className="text-sm text-foreground">{selectedTicket.subject}</p>
              </div>

              {/* Description */}
              {selectedTicket.description && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Descrição</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{selectedTicket.description}</p>
                </div>
              )}

              {/* Session info */}
              {chatSession && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Sessão</p>
                    <p className="text-xs text-muted-foreground font-mono">{chatSession.id.slice(0, 8)}</p>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Details toggle when hidden */}
      {selectedTicket && !showDetails && (
        <button
          onClick={() => setShowDetails(true)}
          className="w-10 border-l border-border flex items-center justify-center hover:bg-muted/50 transition-colors"
          title="Mostrar detalhes"
        >
          <Info className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

function DetailItem({ icon: Icon, label, value, highlight }: {
  icon: typeof Hash;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className={`text-sm ${highlight ? 'font-mono font-semibold text-primary' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}
