/**
 * AutomationRulesPanel — Lists, toggles, and manages automation rules.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Zap, Plus, Pencil, Trash2, History, Filter, Play } from 'lucide-react';
import { toast } from 'sonner';
import { fetchAutomationRules, deleteAutomationRule, toggleAutomationRule } from '@/domains/automation';
import type { AutomationRule } from '@/domains/automation';
import { TRIGGER_EVENT_CATALOG, ACTION_TYPE_CATALOG } from '@/domains/automation/automation.types';
import { AutomationRuleBuilder } from './AutomationRuleBuilder';
import { AutomationExecutionLog } from './AutomationExecutionLog';

interface Props {
  tenantId: string;
}

export function AutomationRulesPanel({ tenantId }: Props) {
  const queryClient = useQueryClient();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | undefined>();
  const [logRuleId, setLogRuleId] = useState<string | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['automation-rules', tenantId],
    queryFn: () => fetchAutomationRules(tenantId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['automation-rules', tenantId] });

  async function handleToggle(rule: AutomationRule) {
    try {
      await toggleAutomationRule(rule.id, !rule.is_active);
      toast.success(`Regra "${rule.name}" ${rule.is_active ? 'desativada' : 'ativada'}.`);
      invalidate();
    } catch {
      toast.error('Erro ao alterar status.');
    }
  }

  async function handleDelete(rule: AutomationRule) {
    if (!confirm(`Excluir regra "${rule.name}"?`)) return;
    try {
      await deleteAutomationRule(rule.id);
      toast.success('Regra excluída.');
      invalidate();
    } catch {
      toast.error('Erro ao excluir.');
    }
  }

  function openEditor(rule?: AutomationRule) {
    setEditingRule(rule);
    setBuilderOpen(true);
  }

  function getTriggerLabel(eventType: string) {
    return TRIGGER_EVENT_CATALOG.find(t => t.value === eventType)?.label ?? eventType;
  }

  function getActionLabel(actionType: string) {
    return ACTION_TYPE_CATALOG.find(a => a.value === actionType)?.label ?? actionType;
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Automação de Regras
            </h2>
            <p className="text-sm text-muted-foreground">
              Crie regras low-code: IF condição THEN ação
            </p>
          </div>
          <Button onClick={() => openEditor()} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova Regra
          </Button>
        </div>

        {/* Rules List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Zap className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Nenhuma regra criada ainda.</p>
              <Button variant="outline" className="mt-4 gap-1.5" onClick={() => openEditor()}>
                <Plus className="h-4 w-4" /> Criar Primeira Regra
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {rules.map(rule => (
              <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">{rule.name}</h3>
                        <Badge variant={rule.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {rule.is_active ? 'Ativa' : 'Inativa'}
                        </Badge>
                        {rule.priority > 0 && (
                          <Badge variant="outline" className="text-[10px]">P{rule.priority}</Badge>
                        )}
                      </div>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground">{rule.description}</p>
                      )}

                      {/* Visual rule summary */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <Badge variant="outline" className="gap-1 font-mono bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20">
                          <Play className="h-2.5 w-2.5" />
                          {getTriggerLabel(rule.trigger_event)}
                        </Badge>
                        {rule.conditions.length > 0 && (
                          <>
                            <span className="text-muted-foreground">→</span>
                            <Badge variant="outline" className="gap-1 font-mono bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20">
                              <Filter className="h-2.5 w-2.5" />
                              {rule.conditions.length} condição(ões)
                            </Badge>
                          </>
                        )}
                        <span className="text-muted-foreground">→</span>
                        {rule.actions.map((a, i) => (
                          <Badge key={i} variant="outline" className="gap-1 font-mono bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20">
                            <Zap className="h-2.5 w-2.5" />
                            {getActionLabel(a.type)}
                          </Badge>
                        ))}
                      </div>

                      {rule.trigger_count > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          Disparada {rule.trigger_count}x • Último: {rule.last_triggered_at ? new Date(rule.last_triggered_at).toLocaleString('pt-BR') : '—'}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch checked={rule.is_active} onCheckedChange={() => handleToggle(rule)} />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLogRuleId(rule.id)} title="Histórico">
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditor(rule)} title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(rule)} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Builder Dialog */}
      <AutomationRuleBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        tenantId={tenantId}
        existingRule={editingRule}
        onSaved={invalidate}
      />

      {/* Execution Log Dialog */}
      {logRuleId && (
        <AutomationExecutionLog
          ruleId={logRuleId}
          open={!!logRuleId}
          onOpenChange={open => { if (!open) setLogRuleId(null); }}
        />
      )}
    </>
  );
}
