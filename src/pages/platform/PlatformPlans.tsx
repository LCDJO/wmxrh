/**
 * PlatformPlans — CRUD de planos SaaS para Platform Admins
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PLATFORM_MODULES } from '@/domains/platform/platform-modules';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Package, Plus, Pencil, Trash2, CreditCard, Puzzle, Flag,
  AlertTriangle, Check, X, DollarSign, ToggleLeft, Users,
  Link2, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ── Derive module list from canonical source ──
const ALL_MODULES = PLATFORM_MODULES.map(m => m.key);
const MODULE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  PLATFORM_MODULES.map(m => [m.key, m.label])
);
const MODULE_DESC_MAP: Record<string, string> = Object.fromEntries(
  PLATFORM_MODULES.map(m => [m.key, m.description])
);

// ── Module groups for organized display ──
interface ModuleGroup {
  label: string;
  icon: string;
  modules: string[];
}

const MODULE_GROUPS: ModuleGroup[] = [
  {
    label: 'Gestão de Pessoas',
    icon: 'Users',
    modules: ['core_hr', 'compensation', 'benefits', 'health', 'compensation_engine'],
  },
  {
    label: 'Compliance & Legal',
    icon: 'Shield',
    modules: ['agreements', 'compliance', 'labor_rules', 'nr_training', 'esocial', 'esocial_governance'],
  },
  {
    label: 'Inteligência & Operações',
    icon: 'Brain',
    modules: ['payroll_sim', 'workforce_intel', 'fleet_traccar', 'support_module'],
  },
  {
    label: 'Plataforma SaaS',
    icon: 'Settings',
    modules: ['iam', 'tenant_admin', 'billing', 'automation', 'observability', 'analytics', 'autonomous_ops'],
  },
  {
    label: 'Growth & Marketing',
    icon: 'Rocket',
    modules: ['ads', 'growth', 'landing_engine', 'website_engine'],
  },
];

// ── Module dependencies: key → required modules ──
const MODULE_DEPENDENCIES: Record<string, { requires: string[]; reason: string }> = {
  core_hr:            { requires: ['agreements'],           reason: 'RH Core exige Termos & Documentos para compliance de admissão' },
  compensation:       { requires: ['core_hr'],              reason: 'Remuneração depende do cadastro de colaboradores (RH Core)' },
  compensation_engine:{ requires: ['compensation'],         reason: 'Motor de Compensação depende do módulo de Remuneração' },
  benefits:           { requires: ['core_hr'],              reason: 'Benefícios depende do cadastro de colaboradores (RH Core)' },
  health:             { requires: ['core_hr', 'agreements'],reason: 'Saúde Ocupacional exige RH Core e Termos (ASO, PCMSO)' },
  payroll_sim:        { requires: ['compensation'],         reason: 'Simulação de Folha depende de Remuneração' },
  compliance:         { requires: ['agreements'],           reason: 'Compliance exige Termos & Documentos para conformidade' },
  labor_rules:        { requires: ['compliance'],           reason: 'Regras Trabalhistas depende de Compliance' },
  nr_training:        { requires: ['health'],               reason: 'Treinamentos NR depende de Saúde Ocupacional' },
  esocial:            { requires: ['core_hr', 'compliance'],reason: 'eSocial exige RH Core e Compliance' },
  esocial_governance: { requires: ['esocial'],              reason: 'Governança eSocial depende do módulo eSocial' },
  workforce_intel:    { requires: ['core_hr'],              reason: 'Inteligência RH depende de dados de RH Core' },
  fleet_traccar:      { requires: ['agreements'],           reason: 'Frota exige Termos (responsabilidade veicular, GPS)' },
  autonomous_ops:     { requires: ['observability', 'analytics'], reason: 'Autonomous Ops depende de Observabilidade e Analytics' },
};

const ALL_PAYMENT_METHODS = [
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'invoice', label: 'Fatura' },
  { value: 'bank_transfer', label: 'Transferência' },
  { value: 'crypto', label: 'Crypto (futuro)' },
];

const COMMON_FEATURE_FLAGS = [
  'basic_dashboard', 'advanced_filters', 'export_reports', 'bulk_actions',
  'custom_branding', 'api_access', 'sso', 'audit_trail', 'cognitive_hints',
  'workforce_ai', 'custom_roles', 'multi_company',
];

interface SaasPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_cycle: string;
  allowed_modules: string[];
  allowed_payment_methods: string[];
  feature_flags: string[];
  is_active: boolean;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

type PlanFormData = {
  name: string;
  description: string;
  price: string;
  billing_cycle: string;
  is_active: boolean;
  allowed_modules: string[];
  allowed_payment_methods: string[];
  feature_flags: string[];
  max_employees: string;
  unlimited_employees: boolean;
};

const emptyForm: PlanFormData = {
  name: '',
  description: '',
  price: '0',
  billing_cycle: 'monthly',
  is_active: true,
  allowed_modules: [],
  allowed_payment_methods: [],
  feature_flags: [],
  max_employees: '',
  unlimited_employees: true,
};

export default function PlatformPlans() {
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SaasPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<SaasPlan | null>(null);
  const [form, setForm] = useState<PlanFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('saas_plans')
      .select('*')
      .order('price', { ascending: true });
    if (error) {
      toast.error('Erro ao carregar planos');
      logger.error('Erro ao carregar planos', { error });
    } else {
      setPlans((data ?? []) as SaasPlan[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const openCreate = () => {
    setEditingPlan(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (plan: SaasPlan) => {
    setEditingPlan(plan);
    const maxEmp = (plan as any).max_employees;
    setForm({
      name: plan.name,
      description: plan.description ?? '',
      price: String(plan.price),
      billing_cycle: plan.billing_cycle,
      is_active: plan.is_active,
      allowed_modules: plan.allowed_modules ?? [],
      allowed_payment_methods: plan.allowed_payment_methods ?? [],
      feature_flags: plan.feature_flags ?? [],
      max_employees: maxEmp != null ? String(maxEmp) : '',
      unlimited_employees: maxEmp == null,
    });
    setDialogOpen(true);
  };

  const openDelete = (plan: SaasPlan) => {
    setDeletingPlan(plan);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: parseFloat(form.price) || 0,
      billing_cycle: form.billing_cycle,
      is_active: form.is_active,
      allowed_modules: form.allowed_modules,
      allowed_payment_methods: form.allowed_payment_methods,
      feature_flags: form.feature_flags,
      max_employees: form.unlimited_employees ? null : (parseInt(form.max_employees) || null),
    };

    if (editingPlan) {
      const { error } = await supabase
        .from('saas_plans')
        .update(payload)
        .eq('id', editingPlan.id);
      if (error) { toast.error('Erro ao atualizar plano'); logger.error('Erro ao atualizar plano', { error }); }
      else { toast.success('Plano atualizado'); }
    } else {
      const { error } = await supabase
        .from('saas_plans')
        .insert(payload);
      if (error) { toast.error('Erro ao criar plano'); logger.error('Erro ao criar plano', { error }); }
      else { toast.success('Plano criado'); }
    }

    setSaving(false);
    setDialogOpen(false);
    fetchPlans();
  };

  const handleDelete = async () => {
    if (!deletingPlan) return;
    const { error } = await supabase.from('saas_plans').delete().eq('id', deletingPlan.id);
    if (error) { toast.error('Erro ao excluir plano'); logger.error('Erro ao excluir plano', { error }); }
    else { toast.success('Plano excluído'); }
    setDeleteDialogOpen(false);
    setDeletingPlan(null);
    fetchPlans();
  };

  const toggleActive = async (plan: SaasPlan) => {
    const { error } = await supabase
      .from('saas_plans')
      .update({ is_active: !plan.is_active })
      .eq('id', plan.id);
    if (error) { toast.error('Erro ao alterar status'); }
    else { toast.success(plan.is_active ? 'Plano desativado' : 'Plano ativado'); fetchPlans(); }
  };

  const toggleArrayItem = (field: 'allowed_modules' | 'allowed_payment_methods' | 'feature_flags', item: string) => {
    setForm(prev => {
      const current = prev[field];
      if (current.includes(item)) {
        // Removing: also check if other enabled modules depend on this one
        if (field === 'allowed_modules') {
          const dependents = Object.entries(MODULE_DEPENDENCIES)
            .filter(([key, dep]) => dep.requires.includes(item) && current.includes(key))
            .map(([key]) => MODULE_LABEL_MAP[key] ?? key);
          if (dependents.length > 0) {
            toast.error(`Não é possível remover "${MODULE_LABEL_MAP[item] ?? item}"`, {
              description: `Módulos dependentes ativos: ${dependents.join(', ')}. Desative-os primeiro.`,
            });
            return prev;
          }
        }
        return { ...prev, [field]: current.filter(i => i !== item) };
      } else {
        // Adding: auto-enable dependencies
        if (field === 'allowed_modules') {
          const deps = MODULE_DEPENDENCIES[item];
          if (deps) {
            const missing = deps.requires.filter(r => !current.includes(r));
            if (missing.length > 0) {
              const newModules = [...new Set([...current, item, ...missing])];
              toast.info(`Dependências adicionadas automaticamente`, {
                description: `${missing.map(m => MODULE_LABEL_MAP[m] ?? m).join(', ')} — ${deps.reason}`,
              });
              return { ...prev, [field]: newModules };
            }
          }
        }
        return { ...prev, [field]: [...current, item] };
      }
    });
  };

  if (loading) return <PlansSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Gestão de Planos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie, edite e configure planos SaaS, módulos, meios de pagamento e feature flags.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Plano
        </Button>
      </div>

      {/* Plan cards grid */}
      {plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Package className="h-10 w-10" />
            <p className="text-sm">Nenhum plano cadastrado.</p>
            <Button variant="outline" size="sm" onClick={openCreate} className="gap-2">
              <Plus className="h-3.5 w-3.5" /> Criar primeiro plano
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map(plan => (
            <Card key={plan.id} className={`relative transition-all ${!plan.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-display flex items-center gap-2">
                      {plan.name}
                      {!plan.is_active && (
                        <Badge variant="secondary" className="text-[10px]">Inativo</Badge>
                      )}
                    </CardTitle>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{plan.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(plan)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => openDelete(plan)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Price */}
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold font-display text-foreground">
                    R$ {plan.price.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    /{plan.billing_cycle === 'monthly' ? 'mês' : 'ano'}
                  </span>
                </div>

                {/* Employee limit */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  Colaboradores: {(plan as any).max_employees ? `até ${(plan as any).max_employees}` : 'Ilimitado'}
                </div>

                <Separator />

                {/* Modules */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Puzzle className="h-3.5 w-3.5" /> Módulos ({plan.allowed_modules?.length ?? 0})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(plan.allowed_modules ?? []).map(m => (
                      <Badge key={m} variant="outline" className="text-[10px] font-normal">{m}</Badge>
                    ))}
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5" /> Pagamentos ({plan.allowed_payment_methods?.length ?? 0})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(plan.allowed_payment_methods ?? []).map(m => (
                      <Badge key={m} variant="secondary" className="text-[10px] font-normal">
                        {ALL_PAYMENT_METHODS.find(p => p.value === m)?.label ?? m}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Feature Flags */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Flag className="h-3.5 w-3.5" /> Feature Flags ({plan.feature_flags?.length ?? 0})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(plan.feature_flags ?? []).map(f => (
                      <Badge key={f} variant="outline" className="text-[10px] font-normal bg-accent/50">{f}</Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Toggle active */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => toggleActive(plan)}
                  >
                    <ToggleLeft className="h-3.5 w-3.5" />
                    {plan.is_active ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ═══ Create / Edit Dialog ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingPlan ? 'Editar Plano' : 'Novo Plano'}
            </DialogTitle>
            <DialogDescription>
              Configure nome, preço, módulos, meios de pagamento e feature flags.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Basic info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Professional" />
              </div>
              <div className="space-y-2">
                <Label>Preço (R$)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-9" type="number" step="0.01" min="0" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ciclo de Cobrança</Label>
                <Select value={form.billing_cycle} onValueChange={v => setForm(p => ({ ...p, billing_cycle: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex items-end gap-3 pb-1">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
                  <Label className="text-sm">Ativo</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Descrição do plano..." rows={2} />
            </div>

            <Separator />

            {/* Employee Limits */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">Limite de Colaboradores</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.unlimited_employees}
                  onCheckedChange={v => setForm(p => ({ ...p, unlimited_employees: v, max_employees: v ? '' : p.max_employees }))}
                />
                <Label className="text-sm text-muted-foreground">Ilimitado</Label>
              </div>
              {!form.unlimited_employees && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Máximo de colaboradores permitidos</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.max_employees}
                    onChange={e => setForm(p => ({ ...p, max_employees: e.target.value }))}
                    placeholder="Ex: 5, 20, 100"
                    className="max-w-[200px]"
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Modules — Grouped & Dependency-aware */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Puzzle className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-semibold">Módulos Permitidos</Label>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {form.allowed_modules.length} / {ALL_MODULES.length} selecionados
                </Badge>
              </div>

              {/* Dependency legend */}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border border-border/50">
                <Link2 className="h-3 w-3 shrink-0" />
                <span>Módulos com <strong className="text-foreground">●</strong> possuem dependências. Ao ativar, dependências são incluídas automaticamente.</span>
              </div>

              <TooltipProvider delayDuration={200}>
                {MODULE_GROUPS.map(group => {
                  const groupEnabled = group.modules.filter(m => form.allowed_modules.includes(m)).length;
                  return (
                    <div key={group.label} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {group.label}
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {groupEnabled}/{group.modules.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {group.modules.map(mod => {
                          const isEnabled = form.allowed_modules.includes(mod);
                          const deps = MODULE_DEPENDENCIES[mod];
                          const hasDeps = !!deps;
                          const missingDeps = deps?.requires.filter(r => !form.allowed_modules.includes(r)) ?? [];

                          return (
                            <Tooltip key={mod}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => toggleArrayItem('allowed_modules', mod)}
                                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                                    isEnabled
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'border-border text-muted-foreground hover:border-primary/30'
                                  }`}
                                >
                                  {isEnabled
                                    ? <Check className="h-3 w-3 shrink-0" />
                                    : <X className="h-3 w-3 opacity-30 shrink-0" />
                                  }
                                  <span className="truncate">{MODULE_LABEL_MAP[mod] ?? mod}</span>
                                  {hasDeps && (
                                    <span className={`ml-auto h-1.5 w-1.5 rounded-full shrink-0 ${
                                      isEnabled && missingDeps.length === 0 ? 'bg-primary' : 'bg-muted-foreground/40'
                                    }`} />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[260px] text-xs">
                                <p className="font-medium">{MODULE_LABEL_MAP[mod] ?? mod}</p>
                                <p className="text-muted-foreground mt-0.5">{MODULE_DESC_MAP[mod] ?? ''}</p>
                                {hasDeps && (
                                  <div className="mt-1.5 pt-1.5 border-t border-border/50">
                                    <p className="flex items-center gap-1 text-[10px] font-medium">
                                      <Link2 className="h-2.5 w-2.5" /> Dependências:
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">{deps!.reason}</p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {deps!.requires.map(r => (
                                        <Badge key={r} variant={form.allowed_modules.includes(r) ? 'default' : 'destructive'} className="text-[9px] px-1.5 py-0">
                                          {MODULE_LABEL_MAP[r] ?? r}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </TooltipProvider>
            </div>

            <Separator />

            {/* Payment Methods */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">Meios de Pagamento</Label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_PAYMENT_METHODS.map(pm => (
                  <button
                    key={pm.value}
                    type="button"
                    onClick={() => toggleArrayItem('allowed_payment_methods', pm.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                      form.allowed_payment_methods.includes(pm.value)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    {form.allowed_payment_methods.includes(pm.value)
                      ? <Check className="h-3 w-3" />
                      : <X className="h-3 w-3 opacity-30" />
                    }
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Feature Flags */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">Feature Flags</Label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COMMON_FEATURE_FLAGS.map(ff => (
                  <button
                    key={ff}
                    type="button"
                    onClick={() => toggleArrayItem('feature_flags', ff)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                      form.feature_flags.includes(ff)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    {form.feature_flags.includes(ff)
                      ? <Check className="h-3 w-3" />
                      : <X className="h-3 w-3 opacity-30" />
                    }
                    {ff}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? 'Salvando...' : editingPlan ? 'Atualizar' : 'Criar Plano'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete confirmation ═══ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Excluir Plano
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o plano <strong>{deletingPlan?.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} className="gap-2">
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlansSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-72 mt-2" /></div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}><CardContent className="pt-5 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
