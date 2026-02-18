import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
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
  Plus, Inbox, UserCheck, Building2, Package, Layers, Radio,
  Shield, Zap, Trophy, TrendingUp, XCircle, Timer,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { TicketService } from '@/domains/support/ticket-service';
import { WikiService } from '@/domains/support/wiki-service';
import { EvaluationService } from '@/domains/support/evaluation-service';
import LiveChatWindow from './LiveChatWindow';
import AgentChatConsole from './chat/AgentChatConsole';
import { useAgentAlerts, AgentAlertBanner } from './agent/AgentAlertService';
import AgentPerformancePanel from './agent/AgentPerformancePanel';
import ConversationInsights from './agent/ConversationInsights';
import LiveChatGovernance from './agent/LiveChatGovernance';
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

// ── Main Component (V2) ──

const PlatformSupportConsole = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (!user) return <div className="p-6 text-muted-foreground">Carregando...</div>;

  return <ConsoleV2 userId={user.id} activeTab={activeTab} setActiveTab={setActiveTab} />;
};

function ConsoleV2({ userId, activeTab, setActiveTab }: { userId: string; activeTab: string; setActiveTab: (t: string) => void }) {
  const alertService = useAgentAlerts(userId);

  const handleAlertClick = (alert: { ticketId?: string }) => {
    if (alert.ticketId) {
      setActiveTab('livechat');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Console de Suporte</h1>
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Zap className="h-3 w-3" /> V2
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Atendimento governado com alertas em tempo real</p>
        </div>
      </div>

      {/* Alert Banner */}
      <AgentAlertBanner
        alerts={alertService.alerts}
        unreadCount={alertService.unreadCount}
        soundEnabled={alertService.soundEnabled}
        onToggleSound={() => alertService.setSoundEnabled(!alertService.soundEnabled)}
        onMarkRead={alertService.markRead}
        onMarkAllRead={alertService.markAllRead}
        onClearAll={alertService.clearAll}
        onAlertClick={handleAlertClick}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2"><BarChart3 className="h-4 w-4" /> Dashboard</TabsTrigger>
          <TabsTrigger value="livechat" className="gap-2"><Radio className="h-4 w-4" /> Chat ao Vivo</TabsTrigger>
          <TabsTrigger value="performance" className="gap-2"><Star className="h-4 w-4" /> Performance</TabsTrigger>
          <TabsTrigger value="queue" className="gap-2"><Inbox className="h-4 w-4" /> Fila</TabsTrigger>
          <TabsTrigger value="wiki" className="gap-2"><BookOpen className="h-4 w-4" /> Wiki</TabsTrigger>
          <TabsTrigger value="evaluations" className="gap-2"><Star className="h-4 w-4" /> Avaliações</TabsTrigger>
          <TabsTrigger value="metrics" className="gap-2"><BarChart3 className="h-4 w-4" /> Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <AgentDashboardV2 userId={userId} onNavigate={setActiveTab} />
        </TabsContent>
        <TabsContent value="livechat" className="mt-4">
          <AgentChatConsoleV2 userId={userId} />
        </TabsContent>
        <TabsContent value="performance" className="mt-4">
          <AgentPerformancePanel userId={userId} />
        </TabsContent>
        <TabsContent value="queue" className="mt-4">
          <TicketQueue userId={userId} />
        </TabsContent>
        <TabsContent value="wiki" className="mt-4">
          <WikiManager userId={userId} />
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
}

// ── Agent Dashboard V2 — Enhanced with full metrics + ranking ──

interface AgentRankEntry {
  agent_id: string;
  name: string;
  resolved: number;
  avgScore: number;
  avgResponseMin: number | null;
}

function AgentDashboardV2({ userId, onNavigate }: { userId: string; onNavigate: (tab: string) => void }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [evaluations, setEvaluations] = useState<SupportEvaluation[]>([]);
  const [allEvaluations, setAllEvaluations] = useState<SupportEvaluation[]>([]);
  const [ranking, setRanking] = useState<AgentRankEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([TicketService.listAll(), EvaluationService.listAll()])
      .then(async ([t, allEvals]) => {
        setTickets(t);
        setAllEvaluations(allEvals);
        setEvaluations(allEvals.filter(ev => ev.agent_id === userId));

        // Build ranking from all agents
        const agentIds = [...new Set(t.filter(tk => tk.assigned_to).map(tk => tk.assigned_to!))];
        const { data: platformUsers } = await supabase
          .from('platform_users')
          .select('user_id, display_name')
          .in('user_id', agentIds);
        const nameMap = new Map((platformUsers ?? []).map(u => [u.user_id, u.display_name ?? 'Agente']));

        const rankEntries: AgentRankEntry[] = agentIds.map(aid => {
          const agentTickets = t.filter(tk => tk.assigned_to === aid);
          const resolved = agentTickets.filter(tk => tk.status === 'resolved' || tk.status === 'closed').length;
          const agentEvals = allEvals.filter(e => e.agent_id === aid);
          const avgScore = agentEvals.length > 0
            ? Math.round((agentEvals.reduce((s, e) => s + (e.agent_score ?? 0), 0) / agentEvals.length) * 10) / 10
            : 0;
          const respTimes = agentTickets
            .filter(tk => tk.first_response_at)
            .map(tk => (new Date(tk.first_response_at!).getTime() - new Date(tk.created_at).getTime()) / 60000);
          const avgResp = respTimes.length > 0
            ? Math.round(respTimes.reduce((a, b) => a + b, 0) / respTimes.length)
            : null;
          return { agent_id: aid, name: (nameMap.get(aid) as string) ?? 'Agente', resolved, avgScore, avgResponseMin: avgResp };
        });
        // Sort by score desc, then resolved desc
        rankEntries.sort((a, b) => b.avgScore - a.avgScore || b.resolved - a.resolved);
        setRanking(rankEntries);
      })
      .catch(() => toast.error('Erro ao carregar dashboard'))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const myTickets = tickets.filter(t => t.assigned_to === userId);
  const resolved = myTickets.filter(t => t.status === 'resolved' || t.status === 'closed');
  const unresolved = myTickets.filter(t => !['resolved', 'closed', 'cancelled'].includes(t.status));
  const activeChats = myTickets.filter(t => t.status === 'in_progress').length;
  const openCount = tickets.filter(t => t.status === 'open' || t.status === 'awaiting_agent').length;

  const avgScore = evaluations.length > 0
    ? (evaluations.reduce((s, e) => s + (e.agent_score ?? 0), 0) / evaluations.length).toFixed(1)
    : '—';

  // Avg first response time
  const responseTimesMs = myTickets
    .filter(t => t.first_response_at)
    .map(t => new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime());
  const avgResponseMin = responseTimesMs.length > 0
    ? Math.round(responseTimesMs.reduce((a, b) => a + b, 0) / responseTimesMs.length / 60000)
    : null;
  const avgResponseLabel = avgResponseMin != null
    ? avgResponseMin < 60 ? `${avgResponseMin}min` : `${(avgResponseMin / 60).toFixed(1)}h`
    : '—';

  // Avg resolution time
  const resolutionTimesMs = resolved
    .filter(t => t.resolved_at)
    .map(t => new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime());
  const avgResolutionMin = resolutionTimesMs.length > 0
    ? Math.round(resolutionTimesMs.reduce((a, b) => a + b, 0) / resolutionTimesMs.length / 60000)
    : null;
  const avgResolutionLabel = avgResolutionMin != null
    ? avgResolutionMin < 60 ? `${avgResolutionMin}min` : avgResolutionMin < 1440 ? `${(avgResolutionMin / 60).toFixed(1)}h` : `${(avgResolutionMin / 1440).toFixed(1)}d`
    : '—';

  // SLA at risk
  const slaAtRisk = tickets.filter(t =>
    ['open', 'awaiting_agent'].includes(t.status) &&
    !t.first_response_at &&
    (Date.now() - new Date(t.created_at).getTime()) > 15 * 60000
  ).length;

  // My ranking position
  const myRankPos = ranking.findIndex(r => r.agent_id === userId) + 1;

  return (
    <div className="space-y-5">
      {/* SLA Warning */}
      {slaAtRisk > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[hsl(0_70%_50%/0.3)] bg-[hsl(0_70%_50%/0.05)]">
          <AlertCircle className="h-5 w-5 text-[hsl(0_70%_50%)] shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{slaAtRisk} ticket(s) com SLA em risco</p>
            <p className="text-xs text-muted-foreground">Sem resposta há mais de 15 minutos</p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-1 text-xs" onClick={() => onNavigate('queue')}>
            <Inbox className="h-3.5 w-3.5" /> Ver Fila
          </Button>
        </div>
      )}

      {/* KPIs — 8 metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Chats Ativos', value: activeChats, icon: Radio, color: 'hsl(200 70% 50%)', tab: 'livechat' },
          { label: 'Resolvidos', value: resolved.length, icon: CheckCircle2, color: 'hsl(145 60% 42%)', tab: 'metrics' },
          { label: 'Não Resolvidos', value: unresolved.length, icon: XCircle, color: 'hsl(35 80% 50%)', tab: 'queue' },
          { label: 'Nota Média', value: avgScore, icon: Star, color: 'hsl(45 90% 55%)', tab: 'evaluations' },
          { label: 'Tempo Resposta', value: avgResponseLabel, icon: Timer, color: 'hsl(210 65% 50%)', tab: 'performance' },
          { label: 'Tempo Resolução', value: avgResolutionLabel, icon: Clock, color: 'hsl(280 60% 55%)', tab: 'performance' },
          { label: 'Aguardando', value: openCount, icon: AlertCircle, color: 'hsl(20 80% 50%)', tab: 'queue' },
          { label: 'Ranking', value: myRankPos > 0 ? `#${myRankPos}` : '—', icon: Trophy, color: 'hsl(45 90% 55%)', tab: 'performance' },
        ].map(k => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => onNavigate(k.tab)}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4" style={{ color: k.color }} />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{k.label}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{k.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Ranking Interno */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[hsl(45_90%_55%)]" /> Ranking Interno
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ranking.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados de ranking.</p>
            ) : (
              <div className="space-y-1.5">
                {ranking.slice(0, 5).map((r, i) => {
                  const isMe = r.agent_id === userId;
                  return (
                    <div
                      key={r.agent_id}
                      className={`flex items-center gap-2 py-1.5 px-2 rounded-md text-xs ${
                        isMe ? 'bg-primary/10 font-semibold' : ''
                      }`}
                    >
                      <span className="w-5 text-center font-bold text-muted-foreground">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                      <span className="flex-1 truncate text-foreground">{r.name}{isMe ? ' (Você)' : ''}</span>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3" fill="hsl(45 90% 55%)" stroke="hsl(45 90% 55%)" />
                        <span className="text-foreground">{r.avgScore || '—'}</span>
                      </div>
                      <span className="text-muted-foreground">{r.resolved} res.</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Evaluations */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" /> Avaliações Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {evaluations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma avaliação recebida.</p>
            ) : (
              <div className="space-y-2">
                {evaluations.slice(0, 4).map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} className="h-3 w-3" fill={(ev.agent_score ?? 0) >= n ? 'hsl(45 90% 55%)' : 'transparent'} stroke="hsl(45 90% 55%)" />
                      ))}
                    </div>
                    <p className="text-xs text-foreground flex-1 truncate">{ev.comment || 'Sem comentário'}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Urgent Tickets */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-[hsl(0_70%_50%)]" /> Tickets Urgentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const urgent = tickets.filter(t => t.priority === 'urgent' && !['resolved', 'closed', 'cancelled'].includes(t.status));
              if (urgent.length === 0) return <p className="text-xs text-muted-foreground text-center py-4">Nenhum ticket urgente.</p>;
              return (
                <div className="space-y-2">
                  {urgent.slice(0, 4).map(t => (
                    <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                      <Badge variant="secondary" className="text-[9px]" style={{ backgroundColor: 'hsl(0 70% 50%/0.1)', color: 'hsl(0 70% 50%)' }}>
                        Urgente
                      </Badge>
                      <p className="text-xs text-foreground flex-1 truncate">{t.subject}</p>
                      <span className="text-[10px] text-muted-foreground">{getTimeOpen(t.created_at)}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Agent Chat Console V2 (with Governance + Insights) ──

function AgentChatConsoleV2({ userId }: { userId: string }) {
  const [tickets, setTickets] = useState<TicketWithTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TicketWithTenant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState<string>('open');

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await TicketService.listAll();
      const tenantIds = [...new Set(data.map(t => t.tenant_id))];
      const { data: tenants } = await supabase.from('tenants').select('id, name').in('id', tenantIds);
      const tenantMap = new Map((tenants ?? []).map(t => [t.id, t.name]));
      setTickets(data.map(t => ({ ...t, tenant_name: (tenantMap.get(t.tenant_id) as string) ?? t.tenant_id.slice(0, 8) })));
    } catch { toast.error('Erro ao carregar conversas'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const filteredTickets = tickets.filter(t => {
    if (statusTab === 'open' && !['open', 'awaiting_agent', 'in_progress'].includes(t.status)) return false;
    if (statusTab === 'waiting' && t.status !== 'awaiting_customer') return false;
    if (statusTab === 'closed' && !['resolved', 'closed', 'cancelled'].includes(t.status)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.subject.toLowerCase().includes(q) && !(t.tenant_name ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const openCount = tickets.filter(t => ['open', 'awaiting_agent', 'in_progress'].includes(t.status)).length;
  const waitingCount = tickets.filter(t => t.status === 'awaiting_customer').length;
  const closedCount = tickets.filter(t => ['resolved', 'closed', 'cancelled'].includes(t.status)).length;

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[500px] border border-border rounded-xl overflow-hidden bg-background shadow-lg">
      {/* LEFT: Conversation List */}
      <div className="w-[300px] shrink-0 border-r border-border flex flex-col bg-card">
        <div className="px-3 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Radio className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Conversas</h2>
            <Badge variant="secondary" className="ml-auto text-[9px]">{tickets.length}</Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-8 text-xs" />
          </div>
        </div>

        <div className="flex border-b border-border shrink-0">
          {[
            { key: 'open', label: 'Abertas', count: openCount },
            { key: 'waiting', label: 'Aguard.', count: waitingCount },
            { key: 'closed', label: 'Fechadas', count: closedCount },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusTab(tab.key)}
              className={`flex-1 py-2 text-[10px] font-medium border-b-2 transition-colors ${
                statusTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma conversa</p>
            </div>
          ) : (
            filteredTickets.map(ticket => {
              const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
              const pr = PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG.medium;
              return (
                <button
                  key={ticket.id}
                  onClick={() => setSelected(ticket)}
                  className={`w-full text-left px-3 py-3 border-b border-border transition-colors hover:bg-muted/50 ${
                    selected?.id === ticket.id ? 'bg-muted/80' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-primary">{(ticket.tenant_name ?? 'T')[0].toUpperCase()}</span>
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background" style={{ backgroundColor: pr.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold text-foreground truncate">{ticket.tenant_name}</p>
                        <span className="text-[9px] text-muted-foreground shrink-0">{getTimeOpen(ticket.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-foreground/70 truncate mt-0.5">{ticket.subject}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge variant="secondary" className="text-[8px] px-1 py-0" style={{ backgroundColor: `${st.color}15`, color: st.color }}>
                          {st.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </ScrollArea>
      </div>

      {/* CENTER: Governed Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <MessageSquare className="h-9 w-9 opacity-30" />
            </div>
            <p className="text-sm font-medium">Selecione uma conversa</p>
            <p className="text-xs mt-1">Escolha um ticket para iniciar o atendimento governado</p>
          </div>
        ) : (
          <LiveChatGovernance
            key={selected.id}
            ticket={selected}
            userId={userId}
            onStatusChange={() => loadTickets()}
          />
        )}
      </div>

      {/* RIGHT: Insights Sidebar */}
      {selected && (
        <div className="w-[280px] shrink-0 border-l border-border bg-card overflow-y-auto">
          <div className="p-3 space-y-3">
            <ConversationInsights ticket={selected} />
            <TenantInfoCard tenantId={selected.tenant_id} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared helpers ──

interface TicketWithTenant extends SupportTicket {
  tenant_name?: string;
}

function getTimeOpen(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ── Ticket Queue (kept from V1) ──

function TicketQueue({ userId }: { userId: string }) {
  const [tickets, setTickets] = useState<TicketWithTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<SupportTicket | null>(null);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const statusFilter = filter !== 'all' ? filter as TicketStatus : undefined;
      const data = await TicketService.listAll(statusFilter ? { status: statusFilter } : undefined);
      const tenantIds = [...new Set(data.map(t => t.tenant_id))];
      const { data: tenants } = await supabase.from('tenants').select('id, name').in('id', tenantIds);
      const tenantMap = new Map((tenants ?? []).map(t => [t.id, t.name]));
      setTickets(data.map(t => ({ ...t, tenant_name: (tenantMap.get(t.tenant_id) as string) ?? t.tenant_id.slice(0, 8) })));
    } catch { toast.error('Erro ao carregar tickets'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const filteredTickets = tickets.filter(t => {
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.subject.toLowerCase().includes(q) && !(t.tenant_name ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (selected) {
    return <AgentTicketView ticket={selected} userId={userId} onBack={() => { setSelected(null); loadTickets(); }} />;
  }

  const statusCounts = tickets.reduce((acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: tickets.length, color: 'hsl(210 65% 50%)' },
          { label: 'Abertos', value: statusCounts['open'] ?? 0, color: 'hsl(35 80% 50%)' },
          { label: 'Em Andamento', value: statusCounts['in_progress'] ?? 0, color: 'hsl(200 70% 50%)' },
          { label: 'Resolvidos', value: statusCounts['resolved'] ?? 0, color: 'hsl(145 60% 42%)' },
        ].map(s => (
          <Card key={s.label}><CardContent className="py-3 px-4"><p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-xs py-1.5 px-3">{filteredTickets.length} resultado(s)</Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Tempo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTickets.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum ticket.</TableCell></TableRow>
            ) : filteredTickets.map(ticket => {
              const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
              const pr = PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG.medium;
              const StatusIcon = st.icon;
              return (
                <TableRow key={ticket.id} className="cursor-pointer" onClick={() => setSelected(ticket)}>
                  <TableCell><div className="flex items-center gap-2"><StatusIcon className="h-4 w-4 shrink-0" style={{ color: st.color }} /><Badge variant="secondary" className="text-[10px]" style={{ backgroundColor: `${st.color}15`, color: st.color }}>{st.label}</Badge></div></TableCell>
                  <TableCell className="font-medium text-sm">{ticket.tenant_name}</TableCell>
                  <TableCell><p className="text-sm truncate max-w-[220px]">{ticket.subject}</p></TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]" style={{ backgroundColor: `${pr.color}15`, color: pr.color }}>{pr.label}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[ticket.category]}</Badge></TableCell>
                  <TableCell className="text-right"><span className="text-xs font-mono text-muted-foreground">{getTimeOpen(ticket.created_at)}</span></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Agent Ticket View (kept from V1, now with governance) ──

function AgentTicketView({ ticket, userId, onBack }: { ticket: SupportTicket; userId: string; onBack: () => void }) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      setMessages(await TicketService.getMessages(ticket.id));
    } catch { toast.error('Erro ao carregar mensagens'); }
    finally { setLoading(false); }
  }, [ticket.id]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const handleSend = async () => {
    if (!newMsg.trim()) return;
    try {
      setSending(true);
      await TicketService.sendMessage({ ticket_id: ticket.id, content: newMsg, sender_type: 'platform_agent', is_internal: isInternal }, userId);
      setNewMsg(''); setIsInternal(false);
      await loadMessages();
    } catch { toast.error('Erro ao enviar'); }
    finally { setSending(false); }
  };

  const handleAssign = async () => {
    try { await TicketService.assign(ticket.id, userId); toast.success('Atribuído'); } catch { toast.error('Erro'); }
  };

  const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{CATEGORY_LABELS[ticket.category]} · {new Date(ticket.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <Badge style={{ backgroundColor: `${st.color}15`, color: st.color }}>{st.label}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
              {!ticket.assigned_to && (
                <Button size="sm" variant="outline" onClick={handleAssign} className="gap-2"><UserCheck className="h-4 w-4" /> Assumir</Button>
              )}
            </CardContent>
          </Card>

          {/* Governed Chat */}
          <div className="h-[500px] border border-border rounded-lg overflow-hidden">
            <LiveChatGovernance ticket={ticket} userId={userId} />
          </div>
        </div>

        <div className="space-y-4">
          <ConversationInsights ticket={ticket} />
          <TenantInfoCard tenantId={ticket.tenant_id} />
        </div>
      </div>
    </div>
  );
}

// ── Tenant Info Card (kept from V1) ──

function TenantInfoCard({ tenantId }: { tenantId: string }) {
  const [info, setInfo] = useState<{
    name: string; plan: string; status: string; modules: string[];
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
      } catch { toast.error('Erro ao carregar tenant'); }
      finally { setLoading(false); }
    }
    load();
  }, [tenantId]);

  if (loading) return <Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  if (!info) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div><p className="text-xs text-muted-foreground">Empresa</p><p className="text-sm font-semibold text-foreground">{info.name}</p></div>
        <div>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Plano</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-xs capitalize">{info.plan}</Badge>
            <Badge variant="outline" className="text-[10px] capitalize">{info.status}</Badge>
          </div>
        </div>
        {info.modules.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Layers className="h-3 w-3" /> Módulos</p>
            <div className="flex flex-wrap gap-1 mt-1">{info.modules.map(m => <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>)}</div>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Histórico</p>
          <div className="grid grid-cols-3 gap-2 mt-1">
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
      </CardContent>
    </Card>
  );
}

// ── Wiki Manager (kept from V1) ──

function WikiManager({ userId }: { userId: string }) {
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [categories, setCategories] = useState<WikiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [arts, cats] = await Promise.all([WikiService.listAll(), WikiService.listCategories()]);
      setArticles(arts); setCategories(cats);
    } catch { toast.error('Erro ao carregar wiki'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{articles.length} artigo(s)</p>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo Artigo</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Novo Artigo</DialogTitle></DialogHeader>
            <NewArticleForm categories={categories} userId={userId} onCreated={() => { setShowNew(false); load(); }} />
          </DialogContent>
        </Dialog>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {articles.map(a => (
            <Card key={a.id}><CardContent className="py-3 px-4 flex items-center gap-4">
              <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.support_wiki_categories?.name ?? 'Sem categoria'} · {a.view_count} views</p>
              </div>
              <Badge variant={a.is_published ? 'default' : 'secondary'} className="text-[10px]">{a.is_published ? 'Publicado' : 'Rascunho'}</Badge>
            </CardContent></Card>
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
    if (!title.trim() || !content.trim()) { toast.error('Preencha título e conteúdo'); return; }
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    try {
      setSubmitting(true);
      await WikiService.create({ title, slug, content_html: content, content_plain: content.replace(/<[^>]*>/g, ''), category_id: categoryId || null, is_published: publish, published_at: publish ? new Date().toISOString() : null, author_id: userId });
      toast.success('Artigo criado!'); onCreated();
    } catch { toast.error('Erro ao criar'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-4">
      <Input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} />
      <Select value={categoryId} onValueChange={setCategoryId}>
        <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
        <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
      </Select>
      <Textarea placeholder="Conteúdo" value={content} onChange={e => setContent(e.target.value)} rows={8} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)} /> Publicar</label>
      <Button onClick={handleSubmit} disabled={submitting} className="w-full">{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Criar</Button>
    </div>
  );
}

// ── Evaluations (kept from V1) ──

function EvaluationsPanel() {
  const [evaluations, setEvaluations] = useState<SupportEvaluation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    EvaluationService.listAll().then(setEvaluations).catch(() => toast.error('Erro')).finally(() => setLoading(false));
  }, []);

  const avgRating = evaluations.length > 0 ? (evaluations.reduce((s, e) => s + (e.agent_score ?? 0), 0) / evaluations.length).toFixed(1) : '—';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="py-4 px-4 text-center">
          <p className="text-3xl font-bold text-foreground">{avgRating}</p>
          <div className="flex justify-center gap-0.5 my-1">{[1,2,3,4,5].map(n => <Star key={n} className="h-4 w-4" fill={parseFloat(avgRating) >= n ? 'hsl(45 90% 55%)' : 'transparent'} stroke="hsl(45 90% 55%)" />)}</div>
          <p className="text-xs text-muted-foreground">Nota Média</p>
        </CardContent></Card>
        <Card><CardContent className="py-4 px-4 text-center"><p className="text-3xl font-bold text-foreground">{evaluations.length}</p><p className="text-xs text-muted-foreground mt-1">Total</p></CardContent></Card>
        <Card><CardContent className="py-4 px-4 text-center"><p className="text-3xl font-bold text-foreground">{evaluations.filter(e => (e.agent_score ?? 0) >= 4).length}</p><p className="text-xs text-muted-foreground mt-1">Positivas (≥4★)</p></CardContent></Card>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {evaluations.map(ev => (
            <Card key={ev.id}><CardContent className="py-3 px-4 flex items-center gap-4">
              <div className="flex gap-0.5">{[1,2,3,4,5].map(n => <Star key={n} className="h-3.5 w-3.5" fill={(ev.agent_score ?? 0) >= n ? 'hsl(45 90% 55%)' : 'transparent'} stroke="hsl(45 90% 55%)" />)}</div>
              <div className="flex-1 min-w-0"><p className="text-sm text-foreground truncate">{ev.comment || 'Sem comentário'}</p><p className="text-xs text-muted-foreground">{new Date(ev.created_at).toLocaleDateString('pt-BR')}</p></div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Metrics Dashboard (kept from V1) ──

function MetricsDashboard() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { TicketService.listAll().then(setTickets).catch(() => {}).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const total = tickets.length;
  const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
  const avgResolutionMs = tickets.filter(t => t.resolved_at).map(t => new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime());
  const avgHours = avgResolutionMs.length > 0 ? (avgResolutionMs.reduce((a, b) => a + b, 0) / avgResolutionMs.length / 3600000).toFixed(1) : '—';

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
          <Card key={s.label}><CardContent className="py-4 px-4"><p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>
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
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${(count / total) * 100}%` }} /></div>
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
