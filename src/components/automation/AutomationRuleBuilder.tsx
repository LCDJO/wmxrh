/**
 * AutomationRuleBuilder — Low-code rule creation/editing dialog.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Zap, Filter, Play } from 'lucide-react';
import { toast } from 'sonner';
import type { RuleCondition, RuleAction, AutomationRule, ConditionOperator, ActionType } from '@/domains/automation/automation.types';
import { TRIGGER_EVENT_CATALOG, ACTION_TYPE_CATALOG } from '@/domains/automation/automation.types';
import { createAutomationRule, updateAutomationRule } from '@/domains/automation';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  existingRule?: AutomationRule;
  onSaved: () => void;
}

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: '==', label: '==' },
  { value: '!=', label: '!=' },
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: 'contains', label: 'contém' },
  { value: 'not_contains', label: 'não contém' },
  { value: 'exists', label: 'existe' },
  { value: 'not_exists', label: 'não existe' },
];

export function AutomationRuleBuilder({ open, onOpenChange, tenantId, existingRule, onSaved }: Props) {
  const isEditing = !!existingRule;

  const [name, setName] = useState(existingRule?.name ?? '');
  const [description, setDescription] = useState(existingRule?.description ?? '');
  const [triggerEvent, setTriggerEvent] = useState(existingRule?.trigger_event ?? '');
  const [conditions, setConditions] = useState<RuleCondition[]>(existingRule?.conditions ?? []);
  const [actions, setActions] = useState<RuleAction[]>(existingRule?.actions ?? [{ type: 'notify_platform_admin', config: { message: '' } }]);
  const [priority, setPriority] = useState(existingRule?.priority ?? 0);
  const [saving, setSaving] = useState(false);

  const selectedTrigger = TRIGGER_EVENT_CATALOG.find(t => t.value === triggerEvent);

  function addCondition() {
    const field = selectedTrigger?.payload_fields[0] ?? '';
    setConditions(prev => [...prev, { field, operator: '==', value: '' }]);
  }

  function removeCondition(idx: number) {
    setConditions(prev => prev.filter((_, i) => i !== idx));
  }

  function updateCondition(idx: number, patch: Partial<RuleCondition>) {
    setConditions(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  }

  function addAction() {
    setActions(prev => [...prev, { type: 'log_audit', config: { action: '' } }]);
  }

  function removeAction(idx: number) {
    setActions(prev => prev.filter((_, i) => i !== idx));
  }

  function updateAction(idx: number, type: ActionType) {
    const catalog = ACTION_TYPE_CATALOG.find(a => a.value === type);
    const config: Record<string, unknown> = {};
    catalog?.config_fields.forEach(f => { config[f.key] = ''; });
    setActions(prev => prev.map((a, i) => i === idx ? { type, config } : a));
  }

  function updateActionConfig(idx: number, key: string, value: string) {
    setActions(prev => prev.map((a, i) => i === idx ? { ...a, config: { ...a.config, [key]: value } } : a));
  }

  async function handleSave() {
    if (!name || !triggerEvent || actions.length === 0) {
      toast.error('Preencha nome, evento de trigger e pelo menos 1 ação.');
      return;
    }
    setSaving(true);
    try {
      if (isEditing && existingRule) {
        await updateAutomationRule(existingRule.id, { name, description, trigger_event: triggerEvent, conditions, actions, priority });
      } else {
        await createAutomationRule({ tenant_id: tenantId, name, description, trigger_event: triggerEvent, conditions, actions, is_active: true, priority, created_by: null });
      }
      toast.success(isEditing ? 'Regra atualizada!' : 'Regra criada!');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar regra.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            {isEditing ? 'Editar Regra' : 'Nova Regra de Automação'}
          </DialogTitle>
          <DialogDescription>
            Configure o trigger, condições (IF) e ações (THEN) da regra.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name & Description */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Auto-heal módulo degradado" />
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o objetivo desta regra..." rows={2} />
          </div>

          {/* Trigger Event */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Play className="h-3.5 w-3.5 text-primary" /> Evento de Trigger</Label>
            <Select value={triggerEvent} onValueChange={setTriggerEvent}>
              <SelectTrigger><SelectValue placeholder="Selecione o evento..." /></SelectTrigger>
              <SelectContent>
                {TRIGGER_EVENT_CATALOG.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTrigger && (
              <p className="text-xs text-muted-foreground">{selectedTrigger.description} — Campos: {selectedTrigger.payload_fields.join(', ')}</p>
            )}
          </div>

          {/* Conditions (IF) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5"><Filter className="h-3.5 w-3.5 text-amber-500" /> Condições (IF)</Label>
              <Button variant="outline" size="sm" onClick={addCondition} className="gap-1 text-xs">
                <Plus className="h-3 w-3" /> Condição
              </Button>
            </div>
            {conditions.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Sem condições — a regra disparará sempre que o evento ocorrer.</p>
            )}
            {conditions.map((cond, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                <span className="text-xs font-mono text-muted-foreground min-w-[16px]">IF</span>
                <Select value={cond.field} onValueChange={v => updateCondition(idx, { field: v })}>
                  <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(selectedTrigger?.payload_fields ?? []).map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={cond.operator} onValueChange={v => updateCondition(idx, { operator: v as ConditionOperator })}>
                  <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map(op => (
                      <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cond.operator !== 'exists' && cond.operator !== 'not_exists' && (
                  <Input
                    className="h-8 text-xs flex-1"
                    value={String(cond.value)}
                    onChange={e => updateCondition(idx, { value: e.target.value })}
                    placeholder="valor"
                  />
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCondition(idx)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          {/* Actions (THEN) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-green-500" /> Ações (THEN)</Label>
              <Button variant="outline" size="sm" onClick={addAction} className="gap-1 text-xs">
                <Plus className="h-3 w-3" /> Ação
              </Button>
            </div>
            {actions.map((action, idx) => {
              const catalog = ACTION_TYPE_CATALOG.find(a => a.value === action.type);
              return (
                <div key={idx} className="p-2 rounded-md border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground min-w-[28px]">THEN</span>
                    <Select value={action.type} onValueChange={v => updateAction(idx, v as ActionType)}>
                      <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPE_CATALOG.map(a => (
                          <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAction(idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  {catalog?.config_fields.map(cf => (
                    <div key={cf.key} className="flex items-center gap-2 pl-10">
                      <Label className="text-xs min-w-[80px]">{cf.label}</Label>
                      {cf.type === 'select' ? (
                        <Select value={String(action.config[cf.key] ?? '')} onValueChange={v => updateActionConfig(idx, cf.key, v)}>
                          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {cf.options?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          className="h-8 text-xs flex-1"
                          type={cf.type}
                          value={String(action.config[cf.key] ?? '')}
                          onChange={e => updateActionConfig(idx, cf.key, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            {saving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar Regra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
