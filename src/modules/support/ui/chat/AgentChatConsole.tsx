import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Clock, CheckCircle2, AlertCircle, Loader2,
  MessageSquare, Building2, Package, Layers, UserCheck,
  Radio, Circle, Timer,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { TicketService } from '@/domains/support/ticket-service';
import LiveChatWindow from '../LiveChatWindow';
import type { SupportTicket, TicketStatus } from '@/domains/support/types';

// ── Configs ──

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: 'Aberto', color: 'hsl(210 65% 50%)', icon: AlertCircle },
  awaiting_agent: { label: 'Aguardando', color: 'hsl(35 80% 50%)', icon: Clock },
  awaiting_customer: { label: 'Aguard. Cliente', color: 'hsl(280 60% 55%)', icon: Clock },
  in_progress: { label: 'Em Andamento', color: 'hsl(200 70% 50%)', icon: Loader2 },
  resolved: { label: 'Resolvido', color: 'hsl(145 60% 42%)', icon: CheckCircle2 },
  closed: { label: 'Fechado', color: 'hsl(0 0% 50%)', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', color: 'hsl(0 60% 50%)', icon: AlertCircle },
};

const PRIORITY_CONFIG: Record<string, { color: string }> = {
  low: { color: 'hsl(200 50% 55%)' },
  medium: { color: 'hsl(35 80% 50%)' },
  high: { color: 'hsl(20 80% 50%)' },
  urgent: { color: 'hsl(0 70% 50%)' },
};

const CATEGORY_LABELS: Record<string, string> = {
  billing: 'Faturamento', technical: 'Técnico', feature_request: 'Solicitação',
  bug_report: 'Bug', account: 'Conta', general: 'Geral',
};

function getTimeOpen(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ── Tenant Card (sidebar item) ──

interface TicketWithTenant extends SupportTicket {
  tenant_name?: string;
}

function ConversationItem({
  ticket,
  isSelected,
  onClick,
}: {
  ticket: TicketWithTenant;
  isSelected: boolean;
  onClick: () => void;
}) {
  const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
  const pr = PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG.medium;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 border-b border-border transition-colors hover:bg-muted/50 ${
        isSelected ? 'bg-muted/80' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">
              {(ticket.tenant_name ?? 'T')[0].toUpperCase()}
            </span>
          </div>
          {/* Priority dot */}
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background"
            style={{ backgroundColor: pr.color }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-sm font-semibold text-foreground truncate">
              {ticket.tenant_name ?? 'Cliente'}
            </p>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {getTimeOpen(ticket.created_at)}
            </span>
          </div>
          <p className="text-xs text-foreground/80 truncate mt-0.5">{ticket.subject}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0"
              style={{ backgroundColor: `${st.color}15`, color: st.color }}
            >
              {st.label}
            </Badge>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
              {CATEGORY_LABELS[ticket.category] ?? ticket.category}
            </Badge>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Tenant Info Panel (right sidebar) ──

function TenantInfoPanel({ tenantId }: { tenantId: string }) {
  const [info, setInfo] = useState<{
    name: string;
    plan: string;
    status: string;
    modules: string[];
    ticketHistory: { total: number; open: number; resolved: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [tenantRes, subRes, modulesRes, ticketsRes] = await Promise.all([
          supabase.from('tenants').select('name, status').eq('id', tenantId).maybeSingle(),
          supabase.from('tenant_subscriptions').select('plan, status').eq('tenant_id', tenantId).maybeSingle(),
          supabase.from('tenant_modules').select('module_key').eq('tenant_id', tenantId).eq('is_active', true),
          supabase.from('support_tickets').select('id, status').eq('tenant_id', tenantId),
        ]);
        const tickets = ticketsRes.data ?? [];
        setInfo({
          name: tenantRes.data?.name ?? 'Desconhecido',
          plan: (subRes.data?.plan as string) ?? 'Sem plano',
          status: (subRes.data?.status as string) ?? tenantRes.data?.status ?? '—',
          modules: (modulesRes.data ?? []).map(m => m.module_key),
          ticketHistory: {
            total: tickets.length,
            open: tickets.filter(t => !['resolved', 'closed', 'cancelled'].includes(t.status)).length,
            resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
          },
        });
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!info) return null;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{info.name}</p>
          <p className="text-[10px] text-muted-foreground capitalize">{info.status}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Package className="h-3 w-3" /> Plano Ativo
          </p>
          <Badge variant="secondary" className="text-xs capitalize mt-1">{info.plan}</Badge>
        </div>

        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Layers className="h-3 w-3" /> Módulos
          </p>
          {info.modules.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-1">Nenhum</p>
          ) : (
            <div className="flex flex-wrap gap-1 mt-1">
              {info.modules.map(m => (
                <Badge key={m} variant="outline" className="text-[9px]">{m}</Badge>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> Tickets
          </p>
          <div className="grid grid-cols-3 gap-1.5 mt-1">
            {[
              { label: 'Total', value: info.ticketHistory.total, color: 'hsl(210 65% 50%)' },
              { label: 'Abertos', value: info.ticketHistory.open, color: 'hsl(35 80% 50%)' },
              { label: 'Resolv.', value: info.ticketHistory.resolved, color: 'hsl(145 60% 42%)' },
            ].map(s => (
              <div key={s.label} className="text-center py-1.5 bg-muted/50 rounded">
                <p className="text-base font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Response Time Badge ──

function ResponseTimeBadge({ ticket }: { ticket: SupportTicket }) {
  if (!ticket.first_response_at) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        <Timer className="h-3 w-3" />
        <span className="text-[10px]">Sem resposta</span>
      </div>
    );
  }
  const ms = new Date(ticket.first_response_at).getTime() - new Date(ticket.created_at).getTime();
  const mins = Math.floor(ms / 60000);
  const label = mins < 60 ? `${mins}min` : `${(mins / 60).toFixed(1)}h`;

  return (
    <div className="flex items-center gap-1" style={{ color: mins < 30 ? 'hsl(145 60% 42%)' : mins < 120 ? 'hsl(35 80% 50%)' : 'hsl(0 60% 50%)' }}>
      <Timer className="h-3 w-3" />
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  );
}

// ── Main Component ──

interface AgentChatConsoleProps {
  userId: string;
}

export default function AgentChatConsole({ userId }: AgentChatConsoleProps) {
  const [tickets, setTickets] = useState<TicketWithTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TicketWithTenant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState<string>('open');
  const [newStatus, setNewStatus] = useState<string>('');

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await TicketService.listAll();
      const tenantIds = [...new Set(data.map(t => t.tenant_id))];
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, name')
        .in('id', tenantIds);
      const tenantMap = new Map((tenants ?? []).map(t => [t.id, t.name]));
      setTickets(
        data.map(t => ({
          ...t,
          tenant_name: (tenantMap.get(t.tenant_id) as string) ?? t.tenant_id.slice(0, 8),
        })),
      );
    } catch {
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Filter tickets
  const filteredTickets = tickets.filter(t => {
    // Status tab filter
    if (statusTab === 'open' && !['open', 'awaiting_agent', 'in_progress'].includes(t.status)) return false;
    if (statusTab === 'waiting' && t.status !== 'awaiting_customer') return false;
    if (statusTab === 'closed' && !['resolved', 'closed', 'cancelled'].includes(t.status)) return false;
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !t.subject.toLowerCase().includes(q) &&
        !(t.tenant_name ?? '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const openCount = tickets.filter(t => ['open', 'awaiting_agent', 'in_progress'].includes(t.status)).length;
  const waitingCount = tickets.filter(t => t.status === 'awaiting_customer').length;
  const closedCount = tickets.filter(t => ['resolved', 'closed', 'cancelled'].includes(t.status)).length;

  const handleAssign = async () => {
    if (!selected) return;
    try {
      await TicketService.assign(selected.id, userId);
      toast.success('Ticket atribuído a você');
      loadTickets();
    } catch {
      toast.error('Erro ao atribuir');
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!selected) return;
    try {
      await TicketService.updateStatus(selected.id, status as TicketStatus);
      toast.success('Status atualizado');
      loadTickets();
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[500px] border border-border rounded-xl overflow-hidden bg-background shadow-lg">
      {/* ─── LEFT SIDEBAR: Conversation List ─── */}
      <div className="w-[340px] shrink-0 border-r border-border flex flex-col bg-card">
        {/* Sidebar header */}
        <div className="px-3 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <Radio className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Conversas</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente ou assunto..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs rounded-lg"
            />
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex border-b border-border shrink-0">
          {[
            { key: 'open', label: 'Abertas', count: openCount },
            { key: 'waiting', label: 'Aguardando', count: waitingCount },
            { key: 'closed', label: 'Encerradas', count: closedCount },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusTab(tab.key)}
              className={`flex-1 py-2 text-[11px] font-medium border-b-2 transition-colors ${
                statusTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredTickets.map(ticket => (
              <ConversationItem
                key={ticket.id}
                ticket={ticket}
                isSelected={selected?.id === ticket.id}
                onClick={() => setSelected(ticket)}
              />
            ))
          )}
        </ScrollArea>
      </div>

      {/* ─── CENTER: Chat Area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <MessageSquare className="h-9 w-9 opacity-30" />
            </div>
            <p className="text-sm font-medium">Selecione uma conversa</p>
            <p className="text-xs mt-1">Escolha um ticket na barra lateral para iniciar o atendimento</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Ticket info bar */}
            <div className="px-4 py-2 border-b border-border bg-card flex items-center gap-3 shrink-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{selected.subject}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[9px]">
                    {CATEGORY_LABELS[selected.category] ?? selected.category}
                  </Badge>
                  <ResponseTimeBadge ticket={selected} />
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!selected.assigned_to && (
                  <Button size="sm" variant="outline" onClick={handleAssign} className="gap-1 h-7 text-xs">
                    <UserCheck className="h-3 w-3" /> Assumir
                  </Button>
                )}
                <Select
                  value={selected.status}
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger className="w-36 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Chat window */}
            <div className="flex-1 min-h-0">
              <LiveChatWindow
                key={selected.id}
                ticketId={selected.id}
                tenantId={selected.tenant_id}
                userId={userId}
                senderType="agent"
                assignedAgentId={selected.assigned_to}
                ticketSubject={selected.subject}
                embedded
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── RIGHT SIDEBAR: Tenant Info ─── */}
      {selected && (
        <div className="w-[260px] shrink-0 border-l border-border bg-card overflow-y-auto hidden xl:block">
          <TenantInfoPanel tenantId={selected.tenant_id} />
        </div>
      )}
    </div>
  );
}
