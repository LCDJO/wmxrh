/**
 * Permission Matrix — Visual grid of resource × action toggles
 */
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { identityGateway } from '@/domains/iam/identity.gateway';
import { type CustomRole, type PermissionDefinition } from '@/domains/iam/iam.service';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface Props {
  role: CustomRole;
  permissions: PermissionDefinition[];
  userId?: string;
  isTenantAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function PermissionMatrix({ role, permissions, userId, isTenantAdmin, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: rolePerms = [], isLoading } = useQuery({
    queryKey: ['iam_role_perms', role.id],
    queryFn: () => identityGateway.getPermissionsMatrix({ role_id: role.id }),
  });

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
    mutationFn: () => identityGateway.updateRolePermissions({ role_id: role.id, permission_ids: Array.from(selected), scope_type: 'tenant', granted_by: userId, tenant_id: role.tenant_id }),
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
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Permissões — {role.name}
            <Badge variant="outline" className="ml-2 text-xs">{selected.size}/{totalPerms}</Badge>
          </DialogTitle>
        </DialogHeader>

        {isLoading || !initialized ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
        ) : (
          <div className="flex-1 overflow-auto -mx-2 px-2">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr>
                  <th className="text-left py-2 px-3 font-semibold text-foreground border-b border-border min-w-[160px]">
                    Recurso
                  </th>
                  {actions.map(action => {
                    const colIds: string[] = [];
                    matrix.forEach(resMap => { const p = resMap.get(action); if (p) colIds.push(p.id); });
                    const allOn = colIds.length > 0 && colIds.every(id => selected.has(id));
                    return (
                      <th key={action} className="text-center py-2 px-2 border-b border-border min-w-[72px]">
                        <button
                          onClick={() => isTenantAdmin && toggleAction(action)}
                          disabled={!isTenantAdmin}
                          className={cn(
                            "text-xs font-semibold uppercase tracking-wider transition-colors",
                            isTenantAdmin && "hover:text-primary cursor-pointer",
                            allOn ? "text-primary" : "text-muted-foreground"
                          )}
                        >
                          {ACTION_LABELS[action] || action}
                        </button>
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

                  return (
                    <tr
                      key={resource}
                      className={cn(
                        "transition-colors",
                        ri % 2 === 0 ? "bg-background" : "bg-muted/30",
                        "hover:bg-accent/20"
                      )}
                    >
                      <td className="py-2 px-3 border-b border-border/50">
                        <button
                          onClick={() => isTenantAdmin && toggleResource(resource)}
                          disabled={!isTenantAdmin}
                          className={cn(
                            "font-medium text-left transition-colors",
                            isTenantAdmin && "hover:text-primary cursor-pointer",
                            allOn ? "text-primary" : someOn ? "text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {RESOURCE_LABELS[resource] || resource}
                        </button>
                      </td>
                      {actions.map(action => {
                        const perm = resMap.get(action);
                        if (!perm) {
                          return (
                            <td key={action} className="text-center py-2 px-2 border-b border-border/50">
                              <span className="text-muted-foreground/30">—</span>
                            </td>
                          );
                        }
                        const isOn = selected.has(perm.id);
                        return (
                          <td key={action} className="text-center py-2 px-2 border-b border-border/50">
                            <button
                              onClick={() => isTenantAdmin && toggle(perm.id)}
                              disabled={!isTenantAdmin}
                              className={cn(
                                "inline-flex items-center justify-center h-8 w-8 rounded-md transition-all duration-150",
                                isTenantAdmin && "cursor-pointer",
                                isOn
                                  ? "bg-primary text-primary-foreground shadow-sm scale-100"
                                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
                              )}
                              title={perm.name}
                            >
                              {isOn ? <Check className="h-4 w-4" /> : <X className="h-3.5 w-3.5 opacity-40" />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {isTenantAdmin && initialized && (
          <div className="pt-4 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selected.size} permissões selecionadas
            </span>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar Permissões'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
