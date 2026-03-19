/**
 * PolicyFormDialog — Create or Edit a platform policy
 */
import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/core/use-toast';
import { getPlatformPolicyGovernanceEngine } from '@/domains/platform-policy-governance';
import type { PlatformPolicy, PolicyCategory, PolicyAppliesTo, PolicyScope, PolicyType } from '@/domains/platform-policy-governance/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: PlatformPolicy | null;
  onSaved: () => void;
}

const CATEGORIES: { value: PolicyCategory; label: string }[] = [
  { value: 'terms_of_use', label: 'Termos de Uso' },
  { value: 'privacy', label: 'Privacidade' },
  { value: 'security', label: 'Segurança' },
  { value: 'billing', label: 'Faturamento' },
  { value: 'conduct', label: 'Conduta' },
];

const SCOPES: { value: PolicyScope; label: string }[] = [
  { value: 'global', label: 'Global (SaaS)' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'api', label: 'API' },
  { value: 'billing', label: 'Billing' },
  { value: 'custom', label: 'Custom' },
];

const APPLIES_TO: { value: PolicyAppliesTo; label: string }[] = [
  { value: 'tenant', label: 'Tenant' },
  { value: 'user', label: 'Usuário' },
  { value: 'developer', label: 'Desenvolvedor' },
];

const TYPES: { value: PolicyType; label: string }[] = [
  { value: 'terms_of_service', label: 'Termos de Serviço' },
  { value: 'acceptable_use', label: 'Uso Aceitável' },
  { value: 'privacy_policy', label: 'Política de Privacidade' },
  { value: 'data_processing', label: 'Processamento de Dados' },
  { value: 'sla', label: 'SLA' },
  { value: 'custom', label: 'Custom' },
];

export function PolicyFormDialog({ open, onOpenChange, policy, onSaved }: Props) {
  const { toast } = useToast();
  const isEdit = !!policy;
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<PolicyCategory>('terms_of_use');
  const [scope, setScope] = useState<PolicyScope>('global');
  const [appliesTo, setAppliesTo] = useState<PolicyAppliesTo>('tenant');
  const [policyType, setPolicyType] = useState<PolicyType>('terms_of_service');
  const [isMandatory, setIsMandatory] = useState(false);
  const [requiresReacceptance, setRequiresReacceptance] = useState(false);
  const [graceDays, setGraceDays] = useState(7);

  useEffect(() => {
    if (policy) {
      setName(policy.name);
      setSlug(policy.slug);
      setDescription(policy.description ?? '');
      setCategory(policy.category);
      setScope(policy.scope);
      setAppliesTo(policy.applies_to);
      setPolicyType(policy.policy_type);
      setIsMandatory(policy.is_mandatory);
      setRequiresReacceptance(policy.requires_re_acceptance_on_update);
      setGraceDays(policy.grace_period_days);
    } else {
      setName(''); setSlug(''); setDescription('');
      setCategory('terms_of_use'); setScope('global');
      setAppliesTo('tenant'); setPolicyType('terms_of_service');
      setIsMandatory(false); setRequiresReacceptance(false); setGraceDays(7);
    }
  }, [policy, open]);

  const generateSlug = (val: string) =>
    val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) {
      toast({ title: 'Nome e slug são obrigatórios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const engine = getPlatformPolicyGovernanceEngine();
      if (isEdit) {
        await engine.updatePolicy(policy!.id, {
          name, description, category, scope, applies_to: appliesTo,
          policy_type: policyType, is_mandatory: isMandatory,
          requires_re_acceptance_on_update: requiresReacceptance,
          grace_period_days: graceDays,
        });
        toast({ title: 'Política atualizada com sucesso' });
      } else {
        await engine.createPolicy({
          slug, name, description, category, scope, applies_to: appliesTo,
          policy_type: policyType, is_mandatory: isMandatory,
          requires_re_acceptance_on_update: requiresReacceptance,
          grace_period_days: graceDays,
        });
        toast({ title: 'Política criada com sucesso' });
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Política' : 'Nova Política'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Altere os campos da política.' : 'Preencha os campos para criar uma nova política.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={e => { setName(e.target.value); if (!isEdit) setSlug(generateSlug(e.target.value)); }} />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input value={slug} onChange={e => setSlug(e.target.value)} disabled={isEdit} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={policyType} onValueChange={v => setPolicyType(v as PolicyType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={v => setCategory(v as PolicyCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Escopo</Label>
              <Select value={scope} onValueChange={v => setScope(v as PolicyScope)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SCOPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Aplica-se a</Label>
              <Select value={appliesTo} onValueChange={v => setAppliesTo(v as PolicyAppliesTo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{APPLIES_TO.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Período de graça (dias)</Label>
            <Input type="number" min={0} value={graceDays} onChange={e => setGraceDays(Number(e.target.value))} />
          </div>

          <div className="flex items-center justify-between">
            <Label>Obrigatória</Label>
            <Switch checked={isMandatory} onCheckedChange={setIsMandatory} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Exigir re-aceite ao atualizar</Label>
            <Switch checked={requiresReacceptance} onCheckedChange={setRequiresReacceptance} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
