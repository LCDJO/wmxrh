/**
 * PlatformPlans — CRUD de planos SaaS para Platform Admins
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PLATFORM_MODULES } from '@/domains/platform/platform-modules';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
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
  Link2, Info, RefreshCw,
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

// ── Module tree: root modules with their dependency children ──
// Only root modules are selectable. Children are auto-included/excluded.
interface ModuleTreeNode {
  key: string;
  children: ModuleTreeNode[];
}

interface ModuleTreeGroup {
  label: string;
  trees: ModuleTreeNode[];
}

// Build the dependency tree. A "child" is a module whose `requires` includes the parent.
// Roots are modules with no dependencies, or whose dependencies are in other groups.

const MODULE_TREE_GROUPS: ModuleTreeGroup[] = [
  {
    label: 'Organização',
    trees: [
      { key: 'companies', children: [] },
      { key: 'groups', children: [] },
      { key: 'departments', children: [] },
      { key: 'positions', children: [] },
    ],
  },
  {
    label: 'Gestão de Pessoas',
    trees: [
      {
        key: 'core_hr',
        children: [
          { key: 'employees', children: [] },
          { key: 'compensation', children: [
            { key: 'compensation_engine', children: [] },
            { key: 'payroll_sim', children: [] },
            { key: 'payroll_simulation', children: [] },
          ]},
          { key: 'benefits', children: [] },
          { key: 'health', children: [
            { key: 'nr_training', children: [] },
          ]},
          { key: 'workforce_intel', children: [] },
          { key: 'workforce_intelligence', children: [] },
        ],
      },
    ],
  },
  {
    label: 'Compliance & Legal',
    trees: [
      {
        key: 'agreements',
        children: [
          { key: 'compliance', children: [
            { key: 'labor_rules', children: [] },
            { key: 'labor_compliance', children: [] },
          ]},
          { key: 'audit', children: [] },
          { key: 'fleet', children: [
            { key: 'fleet_traccar', children: [] },
          ]},
        ],
      },
      {
        key: 'esocial',
        children: [
          { key: 'esocial_governance', children: [] },
        ],
      },
    ],
  },
  {
    label: 'Plataforma SaaS',
    trees: [
      { key: 'iam', children: [] },
      { key: 'tenant_admin', children: [] },
      { key: 'billing', children: [] },
      { key: 'automation', children: [] },
      { key: 'observability', children: [] },
      { key: 'analytics', children: [] },
      { key: 'autonomous_ops', children: [] },
      { key: 'support_module', children: [] },
    ],
  },
  {
    label: 'Growth & Marketing',
    trees: [
      { key: 'ads', children: [] },
      { key: 'growth', children: [] },
      { key: 'landing_engine', children: [] },
      { key: 'website_engine', children: [] },
    ],
  },
];

// ── Collect all keys in a subtree (node + all descendants) ──
function collectTreeKeys(node: ModuleTreeNode): string[] {
  return [node.key, ...node.children.flatMap(collectTreeKeys)];
}

// ── Cross-tree dependencies (root modules that require modules from other trees) ──
// ── Helper: find a node by key in a tree ──
function findNode(node: ModuleTreeNode, key: string): ModuleTreeNode | null {
  if (node.key === key) return node;
  for (const child of node.children) {
    const found = findNode(child, key);
    if (found) return found;
  }
  return null;
}

const CROSS_TREE_DEPS: Record<string, string[]> = {
  core_hr: ['agreements'],
  esocial: ['core_hr', 'compliance'],
  autonomous_ops: ['observability', 'analytics'],
  health: ['agreements'],
  employees: ['core_hr'],
  labor_compliance: ['labor_rules'],
  fleet_traccar: ['fleet'],
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
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SaasPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<SaasPlan | null>(null);
  const [form, setForm] = useState<PlanFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

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

  /** Toggle a root module — adds/removes entire subtree + cross-tree deps */
  const toggleRootModule = (node: ModuleTreeNode) => {
    setForm(prev => {
      const treeKeys = collectTreeKeys(node);
      const isEnabled = prev.allowed_modules.includes(node.key);

      if (isEnabled) {
        // Remove entire subtree
        const toRemove = new Set(treeKeys);
        return { ...prev, allowed_modules: prev.allowed_modules.filter(m => !toRemove.has(m)) };
      } else {
        // Add entire subtree + cross-tree dependencies
        const crossDeps = treeKeys.flatMap(k => CROSS_TREE_DEPS[k] ?? []);
        // Recursively resolve cross-deps' own subtrees
        const allCrossDeps = new Set<string>();
        const resolveCross = (keys: string[]) => {
          for (const k of keys) {
            if (allCrossDeps.has(k)) continue;
            allCrossDeps.add(k);
            // Find the tree node for this key and add its subtree
            for (const group of MODULE_TREE_GROUPS) {
              for (const tree of group.trees) {
                const found = findNode(tree, k);
                if (found) collectTreeKeys(found).forEach(ck => allCrossDeps.add(ck));
              }
            }
            // Also resolve cross-deps of cross-deps
            const moreCross = CROSS_TREE_DEPS[k] ?? [];
            resolveCross(moreCross);
          }
        };
        resolveCross(crossDeps);

        const newModules = [...new Set([...prev.allowed_modules, ...treeKeys, ...allCrossDeps])];
        if (allCrossDeps.size > 0) {
          const crossLabels = [...allCrossDeps]
            .filter(k => !prev.allowed_modules.includes(k) && !treeKeys.includes(k))
            .map(k => MODULE_LABEL_MAP[k] ?? k);
          if (crossLabels.length > 0) {
            toast.info('Dependências entre grupos incluídas', {
              description: crossLabels.join(', '),
            });
          }
        }
        return { ...prev, allowed_modules: newModules };
      }
    });
  };

  /** For non-module arrays (payment methods, feature flags) */
  const toggleArrayItem = (field: 'allowed_payment_methods' | 'feature_flags', item: string) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item],
    }));
  };

  // ── Sync Modules: detect missing modules in each plan ──
  const getMissingModulesPerPlan = () => {
    return plans.map(plan => {
      const existing = new Set(plan.allowed_modules ?? []);
      const missing = ALL_MODULES.filter(m => !existing.has(m));
      return { plan, missing };
    });
  };

  const handleSyncModules = async (planId: string, modulesToAdd: string[]) => {
    setSyncing(true);
    const plan = plans.find(p => p.id === planId);
    if (!plan) { setSyncing(false); return; }
    
    const newModules = [...new Set([...(plan.allowed_modules ?? []), ...modulesToAdd])];
    const { error } = await supabase
      .from('saas_plans')
      .update({ allowed_modules: newModules })
      .eq('id', planId);
    
    if (error) {
      toast.error('Erro ao atualizar módulos');
      logger.error('Erro ao sincronizar módulos', { error });
    } else {
      toast.success(`${modulesToAdd.length} módulo(s) adicionado(s) ao plano ${plan.name}`);
    }
    setSyncing(false);
    fetchPlans();
  };

  const handleSyncAllPlans = async () => {
    setSyncing(true);
    const perPlan = getMissingModulesPerPlan();
    let totalAdded = 0;

    for (const { plan, missing } of perPlan) {
      if (missing.length === 0) continue;
      const newModules = [...new Set([...(plan.allowed_modules ?? []), ...missing])];
      const { error } = await supabase
        .from('saas_plans')
        .update({ allowed_modules: newModules })
        .eq('id', plan.id);
      if (!error) totalAdded += missing.length;
    }

    if (totalAdded > 0) {
      toast.success(`${totalAdded} módulo(s) adicionado(s) em todos os planos`);
    } else {
      toast.info('Todos os planos já possuem todos os módulos');
    }
    setSyncing(false);
    fetchPlans();
  };

  if (loading) return <PlansSkeleton />;

  const syncData = getMissingModulesPerPlan();
  const totalMissing = syncData.reduce((s, d) => s + d.missing.length, 0);

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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSyncDialogOpen(true)} className="gap-2 relative">
            <RefreshCw className="h-4 w-4" /> Atualizar Módulos
            {totalMissing > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-amber-500 text-white border-0">
                {totalMissing}
              </Badge>
            )}
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Plano
          </Button>
        </div>
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

            {/* Modules — Tree-based with dependencies */}
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

              <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border border-border/50">
                <Info className="h-3 w-3 shrink-0" />
                <span>Selecione o módulo raiz para ativar/desativar todo o grupo com suas dependências.</span>
              </div>

              {/* Select All Modules */}
              <button
                type="button"
                onClick={() => {
                  const allSelected = form.allowed_modules.length === ALL_MODULES.length;
                  setForm(prev => ({
                    ...prev,
                    allowed_modules: allSelected ? [] : [...ALL_MODULES],
                  }));
                  toast.info(allSelected ? 'Todos os módulos removidos' : 'Todos os módulos selecionados');
                }}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border text-sm font-semibold transition-all',
                  form.allowed_modules.length === ALL_MODULES.length
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {form.allowed_modules.length === ALL_MODULES.length
                  ? <Check className="h-4 w-4" />
                  : <Puzzle className="h-4 w-4 opacity-50" />
                }
                Todos os módulos
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {ALL_MODULES.length} módulos
                </Badge>
              </button>

              <TooltipProvider delayDuration={200}>
                {MODULE_TREE_GROUPS.map(group => {
                  const allGroupKeys = group.trees.flatMap(collectTreeKeys);
                  const groupEnabled = allGroupKeys.filter(k => form.allowed_modules.includes(k)).length;
                  return (
                    <div key={group.label} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {group.label}
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {groupEnabled}/{allGroupKeys.length}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {group.trees.map(tree => (
                          <ModuleTreeRow
                            key={tree.key}
                            node={tree}
                            depth={0}
                            enabledModules={form.allowed_modules}
                            onToggleRoot={toggleRootModule}
                          />
                        ))}
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

      {/* ═══ Sync Modules Dialog ═══ */}
      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" /> Atualizar Módulos dos Planos
            </DialogTitle>
            <DialogDescription>
              Visualize todos os módulos desenvolvidos e sincronize com os planos. Módulos faltantes são destacados para fácil identificação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Summary */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div className="text-sm">
                <span className="font-medium text-foreground">{ALL_MODULES.length}</span>{' '}
                <span className="text-muted-foreground">módulos registrados</span>
                {totalMissing > 0 && (
                  <>
                    {' · '}
                    <span className="font-medium text-amber-500">{totalMissing}</span>{' '}
                    <span className="text-muted-foreground">pendentes de sincronização</span>
                  </>
                )}
              </div>
              <Button
                size="sm"
                variant="default"
                className="gap-2"
                disabled={totalMissing === 0 || syncing}
                onClick={handleSyncAllPlans}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
                Liberar Todos
              </Button>
            </div>

            {/* Per-plan breakdown */}
            {syncData.map(({ plan, missing }) => (
              <div key={plan.id} className="rounded-xl border border-border overflow-hidden">
                {/* Plan header */}
                <div className="flex items-center justify-between bg-muted/50 px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        R$ {plan.price.toFixed(2).replace('.', ',')} / {plan.billing_cycle === 'monthly' ? 'mês' : 'ano'}
                        {' · '}
                        {(plan.allowed_modules ?? []).length} módulos ativos
                      </p>
                    </div>
                  </div>
                  {missing.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 text-xs"
                      disabled={syncing}
                      onClick={() => handleSyncModules(plan.id, missing)}
                    >
                      <Plus className="h-3 w-3" />
                      Adicionar {missing.length} módulo(s)
                    </Button>
                  )}
                  {missing.length === 0 && (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 bg-emerald-50">
                      <Check className="h-3 w-3 mr-1" /> Completo
                    </Badge>
                  )}
                </div>

                {/* Module grid */}
                <div className="p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {ALL_MODULES.map(moduleKey => {
                      const isIncluded = (plan.allowed_modules ?? []).includes(moduleKey);
                      const isMissing = missing.includes(moduleKey);
                      return (
                        <div
                          key={moduleKey}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all',
                            isIncluded
                              ? 'border-primary/30 bg-primary/5 text-foreground'
                              : 'border-amber-300 bg-amber-50 text-amber-700',
                          )}
                        >
                          {isIncluded
                            ? <Check className="h-3 w-3 text-primary shrink-0" />
                            : <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                          }
                          <span className="truncate">{MODULE_LABEL_MAP[moduleKey] ?? moduleKey}</span>
                          {isMissing && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 ml-auto shrink-0"
                              disabled={syncing}
                              onClick={() => handleSyncModules(plan.id, [moduleKey])}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Tree Row Component ──

interface ModuleTreeRowProps {
  node: ModuleTreeNode;
  depth: number;
  enabledModules: string[];
  onToggleRoot: (node: ModuleTreeNode) => void;
}

function ModuleTreeRow({ node, depth, enabledModules, onToggleRoot }: ModuleTreeRowProps) {
  const isEnabled = enabledModules.includes(node.key);
  const isRoot = depth === 0;
  const hasChildren = node.children.length > 0;
  const childCount = collectTreeKeys(node).length - 1;

  return (
    <div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={isRoot ? () => onToggleRoot(node) : undefined}
            disabled={!isRoot}
            className={cn(
              'flex items-center gap-2 w-full text-left text-xs font-medium rounded-lg border px-3 py-2 transition-all',
              isEnabled
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground',
              isRoot
                ? 'cursor-pointer hover:border-primary/40'
                : 'cursor-default opacity-80',
            )}
            style={{ marginLeft: depth * 20 }}
          >
            {isEnabled
              ? <Check className="h-3 w-3 shrink-0" />
              : <X className="h-3 w-3 opacity-30 shrink-0" />
            }
            {depth > 0 && (
              <span className="text-muted-foreground/40 text-[10px] mr-0.5">└</span>
            )}
            <span className="truncate">{MODULE_LABEL_MAP[node.key] ?? node.key}</span>
            {isRoot && hasChildren && (
              <Badge variant="outline" className="ml-auto text-[9px] px-1.5 py-0 shrink-0">
                +{childCount} dep{childCount > 1 ? 's' : ''}
              </Badge>
            )}
            {!isRoot && (
              <span className="ml-auto text-[9px] text-muted-foreground/60 italic shrink-0">auto</span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[240px] text-xs">
          <p className="font-medium">{MODULE_LABEL_MAP[node.key] ?? node.key}</p>
          <p className="text-muted-foreground mt-0.5">{MODULE_DESC_MAP[node.key] ?? ''}</p>
          {!isRoot && (
            <p className="text-[10px] text-muted-foreground/80 mt-1 italic">
              Gerenciado automaticamente pelo módulo raiz
            </p>
          )}
        </TooltipContent>
      </Tooltip>
      {node.children.map(child => (
        <ModuleTreeRow
          key={child.key}
          node={child}
          depth={depth + 1}
          enabledModules={enabledModules}
          onToggleRoot={onToggleRoot}
        />
      ))}
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
