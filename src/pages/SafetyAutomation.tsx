import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ShieldCheck, Workflow, ClipboardList, Zap, AlertTriangle, Clock,
  CheckCircle2, XCircle, ArrowUpCircle, RefreshCw,
} from 'lucide-react';
import { runEscalationScan, getEscalationSummary } from '@/domains/safety-automation';
import { useToast } from '@/hooks/use-toast';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface WorkflowRow {
  id: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  created_at: string;
  employee_id: string | null;
}

interface TaskRow {
  id: string;
  descricao: string;
  status: string;
  priority: string;
  prazo: string;
  escalation_count: number;
  employee_id: string | null;
  created_at: string;
}

interface AuditInsight {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: any;
  created_at: string;
}

// ═══════════════════════════════════════════════════════
// PRIORITY / STATUS HELPERS
// ═══════════════════════════════════════════════════════

const priorityConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  critical: { label: 'Crítica', variant: 'destructive' },
  high: { label: 'Alta', variant: 'destructive' },
  medium: { label: 'Média', variant: 'default' },
  low: { label: 'Baixa', variant: 'secondary' },
};

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  open: { label: 'Aberto', icon: Clock, className: 'text-chart-4' },
  in_progress: { label: 'Em Andamento', icon: RefreshCw, className: 'text-chart-2' },
  resolved: { label: 'Resolvido', icon: CheckCircle2, className: 'text-chart-1' },
  cancelled: { label: 'Cancelado', icon: XCircle, className: 'text-muted-foreground' },
  pending: { label: 'Pendente', icon: Clock, className: 'text-chart-4' },
  done: { label: 'Concluída', icon: CheckCircle2, className: 'text-chart-1' },
};

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = priorityConfig[priority] ?? { label: priority, variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function StatusIcon({ status }: { status: string }) {
  const cfg = statusConfig[status];
  if (!cfg) return <Badge variant="outline">{status}</Badge>;
  const Icon = cfg.icon;
  return (
    <span className={`flex items-center gap-1.5 text-sm font-medium ${cfg.className}`}>
      <Icon className="h-4 w-4" />
      {cfg.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════

export default function SafetyAutomation() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { toast } = useToast();

  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [actions, setActions] = useState<AuditInsight[]>([]);
  const [escalationSummary, setEscalationSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    loadAll();
  }, [tenantId]);

  async function loadAll() {
    if (!tenantId) return;
    setLoading(true);

    const [wfRes, taskRes, actRes] = await Promise.all([
      supabase
        .from('safety_workflows' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('safety_tasks')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .like('action', 'safety_insight:%')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    setWorkflows((wfRes.data ?? []) as any[]);
    setTasks((taskRes.data ?? []) as any[]);
    setActions((actRes.data ?? []) as any[]);

    const summary = await getEscalationSummary(tenantId);
    setEscalationSummary(summary);

    setLoading(false);
  }

  async function handleRunEscalation() {
    if (!tenantId) return;
    const results = await runEscalationScan(tenantId);
    toast({
      title: 'Escalação executada',
      description: `${results.length} tarefa(s) escalada(s).`,
    });
    loadAll();
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const activeWorkflows = workflows.filter((w: any) => w.status === 'open' || w.status === 'in_progress');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Automação de Segurança
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Workflows, tarefas e ações automáticas de segurança do trabalho
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={handleRunEscalation}>
            <ArrowUpCircle className="h-4 w-4 mr-1.5" />
            Executar Escalação
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Workflows Ativos</CardDescription>
            <CardTitle className="text-2xl">{activeWorkflows.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tarefas Pendentes</CardDescription>
            <CardTitle className="text-2xl">{pendingTasks.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Escaladas</CardDescription>
            <CardTitle className="text-2xl">{escalationSummary?.escalated_count ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ações Executadas</CardDescription>
            <CardTitle className="text-2xl">{actions.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="workflows" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workflows" className="gap-1.5">
            <Workflow className="h-4 w-4" />Workflows Ativos
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />Tarefas Pendentes
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-1.5">
            <Zap className="h-4 w-4" />Ações Executadas
          </TabsTrigger>
        </TabsList>

        {/* ── Workflows Ativos ── */}
        <TabsContent value="workflows">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Workflows Ativos</CardTitle>
              <CardDescription>Automações de segurança em execução</CardDescription>
            </CardHeader>
            <CardContent>
              {activeWorkflows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum workflow ativo no momento.</p>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-3">
                    {activeWorkflows.map((wf: any) => (
                      <div key={wf.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                        <div className="space-y-1 min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{wf.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Tipo: {wf.type}</span>
                            <span>•</span>
                            <span>{new Date(wf.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <PriorityBadge priority={wf.priority} />
                          <StatusIcon status={wf.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tarefas Pendentes ── */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tarefas Pendentes</CardTitle>
              <CardDescription>Ações corretivas aguardando resolução</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma tarefa pendente.</p>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-3">
                    {pendingTasks.map((task: any) => {
                      const isOverdue = task.prazo && new Date(task.prazo) < new Date();
                      return (
                        <div key={task.id} className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${isOverdue ? 'border-destructive/30 bg-destructive/5' : 'bg-card hover:bg-muted/30'}`}>
                          <div className="space-y-1 min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{task.descricao}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Prazo: {task.prazo ? new Date(task.prazo).toLocaleDateString('pt-BR') : '—'}</span>
                              {task.escalation_count > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 text-destructive">
                                    <AlertTriangle className="h-3 w-3" />
                                    Escalação nível {task.escalation_count}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <PriorityBadge priority={task.priority ?? 'medium'} />
                            {isOverdue && <Badge variant="destructive">Vencida</Badge>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Ações Automáticas Executadas ── */}
        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações Automáticas Executadas</CardTitle>
              <CardDescription>Histórico de ações executadas pelo motor de automação</CardDescription>
            </CardHeader>
            <CardContent>
              {actions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma ação automática registrada.</p>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-3">
                    {actions.map((action: any) => (
                      <div key={action.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                        <div className="space-y-1 min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{action.metadata?.title ?? action.action}</p>
                          <p className="text-xs text-muted-foreground truncate">{action.metadata?.description ?? ''}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge variant={action.metadata?.severity === 'critical' ? 'destructive' : 'outline'}>
                            {action.metadata?.severity ?? 'info'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(action.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
