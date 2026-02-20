/**
 * Employee Corrective Actions History Tab
 *
 * Shows safety tasks and automated actions taken for a specific employee.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ShieldCheck, Clock, CheckCircle2, AlertTriangle, ArrowUpCircle,
} from 'lucide-react';

interface CorrectiveAction {
  id: string;
  descricao: string;
  status: string;
  priority: string;
  prazo: string | null;
  escalation_count: number;
  metadata: any;
  created_at: string;
  completed_at: string | null;
}

const priorityLabels: Record<string, string> = {
  critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa',
};

interface Props {
  employeeId: string;
  tenantId: string;
}

export function CorrectiveActionsTab({ employeeId, tenantId }: Props) {
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId || !tenantId) return;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('safety_tasks')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(50);

      setActions((data ?? []) as any[]);
      setLoading(false);
    }

    load();
  }, [employeeId, tenantId]);

  const pending = actions.filter(a => a.status === 'pending');
  const done = actions.filter(a => a.status === 'done');

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Carregando histórico...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardDescription className="text-xs">Total</CardDescription>
            <CardTitle className="text-xl">{actions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardDescription className="text-xs">Pendentes</CardDescription>
            <CardTitle className="text-xl text-chart-4">{pending.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardDescription className="text-xs">Concluídas</CardDescription>
            <CardTitle className="text-xl text-chart-1">{done.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Actions List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Histórico de Ações Corretivas
          </CardTitle>
          <CardDescription>Tarefas de segurança geradas automaticamente para este colaborador</CardDescription>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma ação corretiva registrada para este colaborador.
            </p>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {actions.map(action => {
                  const isOverdue = action.status === 'pending' && action.prazo && new Date(action.prazo) < new Date();
                  const actionType = action.metadata?.action_type;

                  return (
                    <div
                      key={action.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        isOverdue ? 'border-destructive/30 bg-destructive/5' : 'bg-card hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-sm font-medium leading-snug">{action.descricao}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {actionType && (
                              <Badge variant="outline" className="text-[10px] h-5">{actionType}</Badge>
                            )}
                            {action.prazo && (
                              <span>Prazo: {new Date(action.prazo).toLocaleDateString('pt-BR')}</span>
                            )}
                            <span>{new Date(action.created_at).toLocaleDateString('pt-BR')}</span>
                            {action.escalation_count > 0 && (
                              <span className="flex items-center gap-1 text-destructive">
                                <ArrowUpCircle className="h-3 w-3" />
                                Escalação ×{action.escalation_count}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={action.priority === 'critical' || action.priority === 'high' ? 'destructive' : 'secondary'}>
                            {priorityLabels[action.priority] ?? action.priority}
                          </Badge>
                          {action.status === 'done' ? (
                            <CheckCircle2 className="h-4 w-4 text-chart-1" />
                          ) : isOverdue ? (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          ) : (
                            <Clock className="h-4 w-4 text-chart-4" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
