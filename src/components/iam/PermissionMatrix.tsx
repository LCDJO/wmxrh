/**
 * Permission Matrix — Premium visual grid with domain icons, tooltips, and action toggles
 * Uses cached RolePermissions read model for performance.
 */
import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRolePermissionsCached } from '@/domains/iam/read-models';
import { identityGateway } from '@/domains/iam/identity.gateway';
import { type CustomRole, type PermissionDefinition } from '@/domains/iam/iam.service';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldCheck, Check, X, Users, Building2, Briefcase, DollarSign,
  Heart, Send, ScrollText, Brain, GraduationCap, AlertTriangle,
  Calculator, Eye, Plus, Pencil, Trash2, Settings, UserPlus, BarChart3, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ══════════════════════════════════════
// DOMAIN ICONS
// ══════════════════════════════════════

const RESOURCE_ICON: Record<string, typeof Users> = {
  employees: Users,
  companies: Building2,
  company: Building2,
  departments: Briefcase,
  positions: Briefcase,
  salary: DollarSign,
  benefits: ShieldCheck,
  health: Heart,
  esocial: Send,
  audit: ScrollText,
  iam: Lock,
  intelligence: Brain,
  agreements: ScrollText,
  training: GraduationCap,
  risk: AlertTriangle,
  payroll: Calculator,
  user: Users,
};

const ACTION_ICON: Record<string, typeof Eye> = {
  view: Eye,
  create: Plus,
  update: Pencil,
  delete: Trash2,
  manage: Settings,
  adjust: BarChart3,
  simulate: Calculator,
  invite: UserPlus,
};

// Canonical action order
const ACTION_ORDER = ['view', 'create', 'update', 'delete', 'manage', 'adjust', 'simulate', 'invite'];
const ACTION_LABELS: Record<string, string> = {
  view: 'Ler',
  create: 'Criar',
  update: 'Editar',
  delete: 'Excluir',
  manage: 'Gerenciar',
  adjust: 'Reajustar',
  simulate: 'Simular',
  invite: 'Convidar',
};

const RESOURCE_LABELS: Record<string, string> = {
  employees: 'Funcionários',
  companies: 'Empresas',
  company: 'Empresa',
  departments: 'Departamentos',
  positions: 'Cargos',
  salary: 'Salário',
  benefits: 'Benefícios',
  health: 'Saúde',
  esocial: 'eSocial',
  audit: 'Auditoria',
  iam: 'Acesso (IAM)',
  intelligence: 'Inteligência',
  agreements: 'Termos',
  training: 'Treinamentos',
  risk: 'Riscos',
  payroll: 'Folha',
  user: 'Usuários',
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

interface Props {
  role: CustomRole;
  permissions: PermissionDefinition[];
  userId?: string;
  isTenantAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
  securityContext?: import('@/domains/security/kernel/identity.service').SecurityContext | null;
}

export function PermissionMatrix({ role, permissions, userId, isTenantAdmin, onClose, onSaved, securityContext }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: rolePerms = [], isLoading } = useRolePermissionsCached(role.id);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setSelected(new Set(rolePerms.map(rp => rp.permission_id)));
      setInitialized(true);
    }
  }, [isLoading, rolePerms]);

  // Build matrix: { resource -> { action -> PermissionDefinition } }
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

  const toggle = (permId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(permId) ? next.delete(permId) : next.add(permId);
      return next;
    });
  };

  const toggleResource = (resource: string) => {
    const resPerms = matrix.get(resource);
    if (!resPerms) return;
    const ids = Array.from(resPerms.values()).map(p => p.id);
    const allOn = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => allOn ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const toggleAction = (action: string) => {
    const ids: string[] = [];
    matrix.forEach(resMap => {
      const p = resMap.get(action);
      if (p) ids.push(p.id);
    });
    const allOn = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => allOn ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: () => identityGateway.updateRolePermissions({
      role_id: role.id,
      permission_ids: Array.from(selected),
      scope_type: 'tenant',
      granted_by: userId,
      tenant_id: role.tenant_id,
      is_tenant_admin: isTenantAdmin,
      ctx: securityContext,
    }),
    onSuccess: () => {
      toast({ title: 'Permissões salvas!' });
      qc.invalidateQueries({ queryKey: ['iam_role_perms', role.id] });
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const totalPerms = permissions.length;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="text-foreground">Permissões</span>
                <span className="mx-2 text-muted-foreground/40">—</span>
                <span className="text-primary font-bold">{role.name}</span>
              </div>
              <Badge variant="outline" className="ml-auto text-xs font-mono tabular-nums">
                {selected.size}/{totalPerms}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {!isTenantAdmin && (
            <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Modo somente leitura — apenas TenantAdmin pode editar permissões.
            </p>
          )}
        </div>

        {/* Matrix body */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {isLoading || !initialized ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center space-y-3">
                <div className="h-6 w-6 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Carregando permissões...</p>
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-card">
                  <th className="text-left py-3 px-3 font-semibold text-foreground border-b-2 border-border min-w-[200px]">
                    Recurso
                  </th>
                  {actions.map(action => {
                    const colIds: string[] = [];
                    matrix.forEach(resMap => { const p = resMap.get(action); if (p) colIds.push(p.id); });
                    const allOn = colIds.length > 0 && colIds.every(id => selected.has(id));
                    const ActionIcon = ACTION_ICON[action] || Eye;
                    return (
                      <th key={action} className="text-center py-3 px-2 border-b-2 border-border min-w-[80px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => isTenantAdmin && toggleAction(action)}
                              disabled={!isTenantAdmin}
                              className={cn(
                                "inline-flex flex-col items-center gap-1 transition-colors",
                                isTenantAdmin && "hover:text-primary cursor-pointer",
                                allOn ? "text-primary" : "text-muted-foreground"
                              )}
                            >
                              <ActionIcon className="h-4 w-4" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider">
                                {ACTION_LABELS[action] || action}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {allOn ? 'Desmarcar' : 'Marcar'} "{ACTION_LABELS[action]}" em todos os recursos
                          </TooltipContent>
                        </Tooltip>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {resources.map((resource, ri) => {
                  const resMap = matrix.get(resource)!;
                  const resIds = Array.from(resMap.values()).map(p => p.id);
                  const allOn = resIds.every(id => selected.has(id));
                  const someOn = resIds.some(id => selected.has(id));
                  const ResourceIcon = RESOURCE_ICON[resource] || ShieldCheck;

                  return (
                    <tr
                      key={resource}
                      className={cn(
                        "transition-colors group",
                        ri % 2 === 0 ? "bg-background" : "bg-muted/20",
                        "hover:bg-accent/10"
                      )}
                    >
                      <td className="py-2.5 px-3 border-b border-border/40">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => isTenantAdmin && toggleResource(resource)}
                              disabled={!isTenantAdmin}
                              className={cn(
                                "flex items-center gap-2.5 font-medium text-left transition-colors w-full",
                                isTenantAdmin && "hover:text-primary cursor-pointer",
                                allOn ? "text-primary" : someOn ? "text-foreground" : "text-muted-foreground"
                              )}
                            >
                              <div className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                                allOn
                                  ? "bg-primary/15 text-primary"
                                  : someOn
                                    ? "bg-accent/30 text-foreground"
                                    : "bg-muted/50 text-muted-foreground"
                              )}>
                                <ResourceIcon className="h-3.5 w-3.5" />
                              </div>
                              <span className="truncate">{RESOURCE_LABELS[resource] || resource}</span>
                              {allOn && (
                                <Badge variant="secondary" className="ml-auto text-[9px] py-0 px-1.5 opacity-60 group-hover:opacity-100">
                                  Tudo
                                </Badge>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs max-w-[240px]">
                            <p className="font-semibold">{RESOURCE_LABELS[resource] || resource}</p>
                            {RESOURCE_DESCRIPTIONS[resource] && (
                              <p className="text-muted-foreground mt-0.5">{RESOURCE_DESCRIPTIONS[resource]}</p>
                            )}
                            {isTenantAdmin && (
                              <p className="text-primary mt-1">Clique para {allOn ? 'desmarcar' : 'marcar'} todas as ações</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      {actions.map(action => {
                        const perm = resMap.get(action);
                        if (!perm) {
                          return (
                            <td key={action} className="text-center py-2.5 px-2 border-b border-border/40">
                              <span className="text-muted-foreground/20">—</span>
                            </td>
                          );
                        }
                        const isOn = selected.has(perm.id);
                        return (
                          <td key={action} className="text-center py-2.5 px-2 border-b border-border/40">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => isTenantAdmin && toggle(perm.id)}
                                  disabled={!isTenantAdmin}
                                  className={cn(
                                    "inline-flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-150",
                                    isTenantAdmin && "cursor-pointer",
                                    isOn
                                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                                      : "bg-muted/40 text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground"
                                  )}
                                >
                                  {isOn ? <Check className="h-4 w-4" /> : <X className="h-3.5 w-3.5" />}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <p className="font-medium">{perm.name}</p>
                                {perm.description && <p className="text-muted-foreground">{perm.description}</p>}
                                <p className="text-primary/80 mt-0.5 font-mono text-[10px]">{perm.code}</p>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {isTenantAdmin && initialized && (
          <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs font-mono tabular-nums">
                {selected.size} de {totalPerms}
              </Badge>
              <span className="text-xs text-muted-foreground">permissões selecionadas</span>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              {saveMutation.isPending ? 'Salvando...' : 'Salvar Permissões'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
