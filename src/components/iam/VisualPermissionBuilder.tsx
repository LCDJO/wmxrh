/**
 * Visual Permission Builder — Advanced graphical interface for role construction,
 * permission assignment, inheritance visualization, and real-time access preview.
 */
import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RoleSuggestionPanel } from '@/components/iam/RoleSuggestionPanel';
import { PermissionWarnings } from '@/components/iam/PermissionWarnings';
import { useRolePermissionsMatrixView, useRolePermissionsCached } from '@/domains/iam/read-models';
import { identityGateway } from '@/domains/iam/identity.gateway';
import { type CustomRole, type PermissionDefinition } from '@/domains/iam/iam.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/core/use-toast';
import { cn } from '@/lib/utils';
import {
  Shield, ShieldCheck, Users, Building2, Briefcase, DollarSign, Heart,
  Send, ScrollText, Brain, GraduationCap, AlertTriangle, Calculator,
  Eye, Plus, Pencil, Trash2, Settings, UserPlus, BarChart3, Lock,
  Search, Layers, ChevronRight, ArrowRight, Zap, Check, Monitor,
  Key, FileText, ChevronDown,
} from 'lucide-react';

// ══════════════════════════════════
// CONSTANTS
// ══════════════════════════════════

const RESOURCE_ICON: Record<string, typeof Users> = {
  employees: Users, companies: Building2, company: Building2,
  departments: Briefcase, positions: Briefcase, salary: DollarSign,
  benefits: ShieldCheck, health: Heart, esocial: Send, audit: ScrollText,
  iam: Lock, intelligence: Brain, agreements: ScrollText,
  training: GraduationCap, risk: AlertTriangle, payroll: Calculator, user: Users,
};

const ACTION_ICON: Record<string, typeof Eye> = {
  view: Eye, create: Plus, update: Pencil, delete: Trash2,
  manage: Settings, adjust: BarChart3, simulate: Calculator, invite: UserPlus,
};

const ACTION_ORDER = ['view', 'create', 'update', 'delete', 'manage', 'adjust', 'simulate', 'invite'];

const ACTION_LABELS: Record<string, string> = {
  view: 'Ler', create: 'Criar', update: 'Editar', delete: 'Excluir',
  manage: 'Gerenciar', adjust: 'Reajustar', simulate: 'Simular', invite: 'Convidar',
};

const RESOURCE_LABELS: Record<string, string> = {
  employees: 'Funcionários', companies: 'Empresas', company: 'Empresa',
  departments: 'Departamentos', positions: 'Cargos', salary: 'Salário',
  benefits: 'Benefícios', health: 'Saúde', esocial: 'eSocial',
  audit: 'Auditoria', iam: 'Acesso (IAM)', intelligence: 'Inteligência',
  agreements: 'Termos', training: 'Treinamentos', risk: 'Riscos',
  payroll: 'Folha', user: 'Usuários',
};

const RESOURCE_DESCRIPTIONS: Record<string, string> = {
  employees: 'Cadastro e gestão de funcionários',
  companies: 'Empresas do grupo econômico',
  departments: 'Departamentos organizacionais',
  positions: 'Cargos e funções',
  salary: 'Salários e remuneração',
  benefits: 'Planos de benefícios',
  health: 'Saúde ocupacional e exames',
  esocial: 'Eventos eSocial e transmissão',
  audit: 'Logs de auditoria e conformidade',
  iam: 'Controle de acesso e permissões',
  intelligence: 'Dashboards de inteligência',
  agreements: 'Termos e acordos trabalhistas',
  training: 'Treinamentos NR e certificações',
  risk: 'Exposição a riscos ocupacionais',
  payroll: 'Simulação de folha de pagamento',
  user: 'Gestão de usuários do sistema',
};

const MODULE_GROUPS: Record<string, { label: string; icon: typeof Users; resources: string[] }> = {
  people: {
    label: 'Pessoas & Organização',
    icon: Users,
    resources: ['employees', 'user', 'departments', 'positions'],
  },
  finance: {
    label: 'Financeiro & Compensação',
    icon: DollarSign,
    resources: ['salary', 'benefits', 'payroll'],
  },
  compliance: {
    label: 'Compliance & Segurança',
    icon: ShieldCheck,
    resources: ['health', 'risk', 'training', 'esocial', 'agreements'],
  },
  admin: {
    label: 'Administração',
    icon: Settings,
    resources: ['companies', 'company', 'iam', 'audit', 'intelligence'],
  },
};

// ══════════════════════════════════
// TYPES
// ══════════════════════════════════

interface Props {
  roles: CustomRole[];
  permissions: PermissionDefinition[];
  tenantId: string;
  userId?: string;
  /** UI hint only — real enforcement is in IdentityGateway via SecurityPipeline */
  canEdit: boolean;
  onInvalidate: () => void;
  /** SecurityContext for pipeline-enforced mutations (passed to gateway) */
  securityContext?: import('@/domains/security/kernel/identity.service').SecurityContext | null;
}

// ══════════════════════════════════
// COMPONENT
// ══════════════════════════════════

export function VisualPermissionBuilder({ roles, permissions, tenantId, userId, canEdit, onInvalidate, securityContext }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(Object.keys(MODULE_GROUPS)));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [compareRoleId, setCompareRoleId] = useState<string | null>(null);

  const selectedRole = roles.find(r => r.id === selectedRoleId) || null;

  // Load current role permissions
  const { data: rolePerms = [], isLoading: rolePermsLoading } = useRolePermissionsCached(selectedRoleId);
  const { data: comparePerms = [] } = useRolePermissionsCached(compareRoleId);

  const comparePermIds = useMemo(() => new Set(comparePerms.map(rp => rp.permission_id)), [comparePerms]);

  // Sync selected state when role changes
  const lastSyncedRoleId = useMemo(() => selectedRoleId, [selectedRoleId]);
  useMemo(() => {
    if (!rolePermsLoading && selectedRoleId) {
      const ids = new Set(rolePerms.map(rp => rp.permission_id));
      setSelected(ids);
      setDirty(false);
    }
  }, [rolePermsLoading, rolePerms, lastSyncedRoleId]);

  // Build matrix
  const { matrix, resources, actions } = useMemo(() => {
    const mat = new Map<string, Map<string, PermissionDefinition>>();
    const actSet = new Set<string>();
    permissions.forEach(p => {
      if (!mat.has(p.resource)) mat.set(p.resource, new Map());
      mat.get(p.resource)!.set(p.action, p);
      actSet.add(p.action);
    });
    const sortedActions = ACTION_ORDER.filter(a => actSet.has(a));
    const sortedResources = Array.from(mat.keys()).sort((a, b) =>
      (RESOURCE_LABELS[a] || a).localeCompare(RESOURCE_LABELS[b] || b)
    );
    return { matrix: mat, resources: sortedResources, actions: sortedActions };
  }, [permissions]);

  // Filter resources by search
  const filteredResources = useMemo(() => {
    if (!searchTerm) return resources;
    const q = searchTerm.toLowerCase();
    return resources.filter(r =>
      (RESOURCE_LABELS[r] || r).toLowerCase().includes(q) ||
      (RESOURCE_DESCRIPTIONS[r] || '').toLowerCase().includes(q)
    );
  }, [resources, searchTerm]);

  const toggle = useCallback((permId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(permId) ? next.delete(permId) : next.add(permId);
      return next;
    });
    setDirty(true);
  }, []);

  const toggleResource = useCallback((resource: string) => {
    const resPerms = matrix.get(resource);
    if (!resPerms) return;
    const ids = Array.from(resPerms.values()).map(p => p.id);
    const allOn = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => allOn ? next.delete(id) : next.add(id));
      return next;
    });
    setDirty(true);
  }, [matrix, selected]);

  const toggleGroup = useCallback((groupKey: string) => {
    const group = MODULE_GROUPS[groupKey];
    if (!group) return;
    const ids: string[] = [];
    group.resources.forEach(r => {
      const resMap = matrix.get(r);
      if (resMap) resMap.forEach(p => ids.push(p.id));
    });
    const allOn = ids.length > 0 && ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => allOn ? next.delete(id) : next.add(id));
      return next;
    });
    setDirty(true);
  }, [matrix, selected]);

  const toggleExpandGroup = useCallback((groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey);
      return next;
    });
  }, []);

  const saveMutation = useMutation({
    mutationFn: () => identityGateway.updateRolePermissions({
      role_id: selectedRoleId!,
      permission_ids: Array.from(selected),
      scope_type: 'tenant',
      granted_by: userId,
      tenant_id: tenantId,
      is_tenant_admin: canEdit,
      ctx: securityContext,
    }),
    onSuccess: () => {
      toast({ title: 'Permissões salvas com sucesso!' });
      qc.invalidateQueries({ queryKey: ['iam_role_perms', selectedRoleId] });
      setDirty(false);
      onInvalidate();
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  // Compute stats per group
  const groupStats = useMemo(() => {
    const stats: Record<string, { total: number; selected: number }> = {};
    Object.entries(MODULE_GROUPS).forEach(([key, group]) => {
      let total = 0;
      let sel = 0;
      group.resources.forEach(r => {
        const resMap = matrix.get(r);
        if (resMap) {
          resMap.forEach(p => {
            total++;
            if (selected.has(p.id)) sel++;
          });
        }
      });
      stats[key] = { total, selected: sel };
    });
    return stats;
  }, [matrix, selected]);

  // Access Preview computation
  const accessPreview = useMemo(() => {
    const preview: { resource: string; actions: string[] }[] = [];
    resources.forEach(r => {
      const resMap = matrix.get(r);
      if (!resMap) return;
      const acts: string[] = [];
      resMap.forEach((p, action) => {
        if (selected.has(p.id)) acts.push(action);
      });
      if (acts.length > 0) {
        preview.push({ resource: r, actions: acts });
      }
    });
    return preview;
  }, [resources, matrix, selected]);

  return (
    <div className="space-y-6">
      {/* Top Bar: Role Selector + Stats */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Role Selector Panel */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Selecionar Cargo
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {roles.map(role => {
              const isSelected = role.id === selectedRoleId;
              const isCompare = role.id === compareRoleId;
              return (
                <button
                  key={role.id}
                  onClick={() => {
                    if (isSelected) return;
                    setSelectedRoleId(role.id);
                    setCompareRoleId(null);
                    setDirty(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 flex items-center gap-2.5 group",
                    isSelected
                      ? "bg-primary/10 border border-primary/30 shadow-sm"
                      : "hover:bg-muted/60 border border-transparent",
                    isCompare && "ring-2 ring-info/30"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted/70 text-muted-foreground group-hover:bg-muted"
                  )}>
                    {role.is_system ? <Lock className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      isSelected ? "text-primary" : "text-foreground"
                    )}>{role.name}</p>
                    {role.description && (
                      <p className="text-[11px] text-muted-foreground truncate">{role.description}</p>
                    )}
                  </div>
                  {role.is_system && <Badge variant="secondary" className="text-[9px] shrink-0">Sys</Badge>}
                  {isSelected && <ChevronRight className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })}

            {/* Compare mode */}
            {selectedRoleId && (
              <>
                <Separator className="my-3" />
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider px-1">Comparar com</p>
                <div className="flex flex-wrap gap-1.5">
                  {roles.filter(r => r.id !== selectedRoleId).map(r => (
                    <button
                      key={r.id}
                      onClick={() => setCompareRoleId(prev => prev === r.id ? null : r.id)}
                      className={cn(
                        "text-[11px] px-2 py-1 rounded-md border transition-colors",
                        compareRoleId === r.id
                          ? "bg-accent border-primary/30 text-accent-foreground font-medium"
                          : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                      )}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        {selectedRole && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 self-start">
            <MiniStat icon={Key} label="Permissões" value={`${selected.size}/${permissions.length}`} accent />
            <MiniStat icon={Layers} label="Recursos" value={`${accessPreview.length}/${resources.length}`} />
            <MiniStat icon={Shield} label="Cargo" value={selectedRole.name} small />
            <MiniStat icon={selectedRole.is_system ? Lock : Zap} label="Tipo" value={selectedRole.is_system ? 'Sistema' : 'Custom'} />
          </div>
        )}
      </div>

      {/* Main Builder */}
      {!selectedRole ? (
        <Card className="border-dashed border-2 border-border/60">
          <CardContent className="py-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Layers className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-semibold text-foreground mb-1">Selecione um cargo</p>
            <p className="text-sm text-muted-foreground">Escolha um cargo na lista ao lado para construir suas permissões visualmente.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Permission Grid */}
          <Card className="overflow-hidden border-border/60">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center gap-3 justify-between">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Construtor de Permissões
                </CardTitle>
                <div className="relative w-56">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Filtrar recursos..."
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <div className="h-[60vh] overflow-y-auto">
              <div className="p-4 space-y-1">
                {Object.entries(MODULE_GROUPS).map(([groupKey, group]) => {
                  const groupResources = group.resources.filter(r => filteredResources.includes(r) && matrix.has(r));
                  if (groupResources.length === 0) return null;
                  const stats = groupStats[groupKey];
                  const isExpanded = expandedGroups.has(groupKey);
                  const allGroupOn = stats.total > 0 && stats.selected === stats.total;
                  const someGroupOn = stats.selected > 0;
                  const GroupIcon = group.icon;

                  return (
                    <div key={groupKey} className="rounded-xl border border-border/40 overflow-hidden mb-3">
                      {/* Group Header */}
                      <button
                        onClick={() => toggleExpandGroup(groupKey)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left",
                          allGroupOn ? "bg-primary/5" : "bg-muted/20 hover:bg-muted/40"
                        )}
                      >
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                          allGroupOn ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground"
                        )}>
                          <GroupIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-semibold",
                            allGroupOn ? "text-primary" : "text-foreground"
                          )}>{group.label}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {stats.selected}/{stats.total} permissões
                          </p>
                        </div>

                        {/* Group progress */}
                        <div className="w-20 h-1.5 bg-muted/60 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${stats.total > 0 ? (stats.selected / stats.total) * 100 : 0}%` }}
                          />
                        </div>

                        {canEdit && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                role="button"
                                onClick={e => { e.stopPropagation(); toggleGroup(groupKey); }}
                                className={cn(
                                  "flex h-7 w-7 items-center justify-center rounded-md border transition-colors cursor-pointer",
                                  allGroupOn
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : someGroupOn
                                      ? "bg-primary/20 border-primary/40 text-primary"
                                      : "bg-card border-border text-muted-foreground hover:border-primary/40"
                                )}
                              >
                                {allGroupOn ? <Check className="h-3.5 w-3.5" /> : someGroupOn ? <span className="text-[10px] font-bold">—</span> : null}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">{allGroupOn ? 'Desmarcar grupo' : 'Marcar tudo'}</TooltipContent>
                          </Tooltip>
                        )}

                        <ChevronDown className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          isExpanded && "rotate-180"
                        )} />
                      </button>

                      {/* Group Content */}
                      {isExpanded && (
                        <div className="border-t border-border/30">
                          {groupResources.map(resource => {
                            const resMap = matrix.get(resource)!;
                            const resIds = Array.from(resMap.values()).map(p => p.id);
                            const allResOn = resIds.every(id => selected.has(id));
                            const someResOn = resIds.some(id => selected.has(id));
                            const ResourceIcon = RESOURCE_ICON[resource] || ShieldCheck;

                            return (
                              <div key={resource} className={cn(
                                "px-4 py-3 border-b border-border/20 last:border-b-0 transition-colors",
                                allResOn ? "bg-primary/[0.02]" : "hover:bg-muted/10"
                              )}>
                                {/* Resource header */}
                                <div className="flex items-center gap-3 mb-2.5">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => canEdit && toggleResource(resource)}
                                        disabled={!canEdit}
                                        className={cn(
                                          "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                                          allResOn ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground",
                                          canEdit && "cursor-pointer hover:bg-primary/20"
                                        )}
                                      >
                                        <ResourceIcon className="h-3.5 w-3.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                      <p className="font-semibold">{RESOURCE_LABELS[resource] || resource}</p>
                                      {RESOURCE_DESCRIPTIONS[resource] && <p className="text-muted-foreground">{RESOURCE_DESCRIPTIONS[resource]}</p>}
                                    </TooltipContent>
                                  </Tooltip>
                                  <div className="flex-1">
                                    <p className={cn(
                                      "text-sm font-medium",
                                      allResOn ? "text-primary" : "text-foreground"
                                    )}>{RESOURCE_LABELS[resource] || resource}</p>
                                  </div>
                                  {allResOn && (
                                    <Badge variant="secondary" className="text-[9px] py-0">Acesso Total</Badge>
                                  )}
                                </div>

                                {/* Action toggles */}
                                <div className="flex flex-wrap gap-2 pl-10">
                                  {actions.map(action => {
                                    const perm = resMap.get(action);
                                    if (!perm) return null;
                                    const isOn = selected.has(perm.id);
                                    const isInCompare = comparePermIds.has(perm.id);
                                    const ActionIcon = ACTION_ICON[action] || Eye;

                                    return (
                                      <Tooltip key={action}>
                                        <TooltipTrigger asChild>
                                          <button
                                            onClick={() => canEdit && toggle(perm.id)}
                                            disabled={!canEdit}
                                            className={cn(
                                              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border",
                                              canEdit && "cursor-pointer",
                                              isOn
                                                ? "bg-primary/10 border-primary/30 text-primary shadow-sm"
                                                : "bg-card border-border/40 text-muted-foreground hover:border-border hover:text-foreground",
                                              isInCompare && !isOn && "ring-1 ring-warning/40"
                                            )}
                                          >
                                            <ActionIcon className="h-3 w-3" />
                                            {ACTION_LABELS[action] || action}
                                            {isOn && <Check className="h-3 w-3 ml-0.5" />}
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent className="text-xs max-w-[200px]">
                                          <p className="font-semibold">{perm.name}</p>
                                          {perm.description && <p className="text-muted-foreground">{perm.description}</p>}
                                          <p className="font-mono text-[10px] text-primary/70 mt-0.5">{perm.code}</p>
                                          {isInCompare && !isOn && (
                                            <p className="text-warning mt-1 text-[10px]">⚠ Presente no cargo comparado</p>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Save Bar */}
            {canEdit && (
              <div className={cn(
                "px-4 py-3 border-t flex items-center justify-between transition-colors",
                dirty ? "bg-primary/5 border-primary/20" : "bg-muted/20 border-border/40"
              )}>
                <div className="flex items-center gap-3">
                  <Badge variant={dirty ? "default" : "outline"} className="text-xs font-mono tabular-nums">
                    {selected.size}/{permissions.length}
                  </Badge>
                  {dirty && <span className="text-xs text-primary font-medium animate-pulse">● Alterações não salvas</span>}
                </div>
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={!dirty || saveMutation.isPending}
                  size="sm"
                  className="gap-2"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar Permissões'}
                </Button>
              </div>
            )}
          </Card>

          {/* Access Preview Panel */}
          <div className="space-y-4">
            {/* Permission Warnings */}
            <PermissionWarnings
              selectedPermissionIds={selected}
              permissions={permissions}
              roleName={selectedRole?.name}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-primary" />
                  Preview de Acesso
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">O que este cargo pode acessar em tempo real.</p>
              </CardHeader>
              <CardContent className="pt-0">
                {accessPreview.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">Nenhuma permissão selecionada</p>
                ) : (
                  <ScrollArea className="max-h-[50vh]">
                    <div className="space-y-3">
                      {accessPreview.map(item => {
                        const ResourceIcon = RESOURCE_ICON[item.resource] || ShieldCheck;
                        return (
                          <div key={item.resource} className="flex items-start gap-2.5">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 mt-0.5">
                              <ResourceIcon className="h-3 w-3 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground">{RESOURCE_LABELS[item.resource] || item.resource}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.actions.map(a => (
                                  <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/50 text-accent-foreground font-medium">
                                    {ACTION_LABELS[a] || a}
                                  </span>
                                ))}
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

            {/* AI Role Suggestions */}
            {selectedRole && (
              <RoleSuggestionPanel
                roleName={selectedRole.name}
                currentPermissionCodes={new Set(
                  Array.from(selected)
                    .map(id => permissions.find(p => p.id === id)?.code)
                    .filter(Boolean) as string[]
                )}
                onApplySuggestions={(codes) => {
                  const idsToAdd = permissions
                    .filter(p => codes.includes(p.code) && !selected.has(p.id))
                    .map(p => p.id);
                  if (idsToAdd.length > 0) {
                    setSelected(prev => {
                      const next = new Set(prev);
                      idsToAdd.forEach(id => next.add(id));
                      return next;
                    });
                    setDirty(true);
                  }
                }}
              />
            )}

            {/* Inheritance Visualization */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Herança de Acesso
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-foreground font-medium">{selectedRole.name}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{selected.size} permissões</span>
                  </div>
                  <div className="ml-4 pl-3 border-l-2 border-primary/20 space-y-1.5">
                    {Object.entries(MODULE_GROUPS).map(([key, group]) => {
                      const s = groupStats[key];
                      if (s.selected === 0) return null;
                      return (
                        <div key={key} className="flex items-center gap-2 text-[11px]">
                          <div className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            s.selected === s.total ? "bg-primary" : "bg-primary/40"
                          )} />
                          <span className="text-foreground">{group.label}</span>
                          <span className="text-muted-foreground ml-auto">{s.selected}/{s.total}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {compareRoleId && (
                  <>
                    <Separator className="my-3" />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">Comparação</p>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-warning" />
                        <span>Presentes apenas no cargo comparado: {
                          Array.from(comparePermIds).filter(id => !selected.has(id)).length
                        }</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <span>Exclusivas deste cargo: {
                          Array.from(selected).filter(id => !comparePermIds.has(id)).length
                        }</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-success" />
                        <span>Em comum: {
                          Array.from(selected).filter(id => comparePermIds.has(id)).length
                        }</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════
// MINI STAT CARD
// ══════════════════════════════════

function MiniStat({ icon: Icon, label, value, accent, small }: { icon: typeof Users; label: string; value: string; accent?: boolean; small?: boolean }) {
  return (
    <Card className="border-border/50">
      <CardContent className="py-3 px-4 flex items-center gap-3">
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          accent ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className={cn("font-bold text-foreground", small ? "text-sm" : "text-lg font-mono tabular-nums")}>{value}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
