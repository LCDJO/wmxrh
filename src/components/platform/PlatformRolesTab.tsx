/**
 * Platform Roles Tab — Full CRUD for roles + permissions + toggle matrix.
 */
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PlatformRole, PlatformPermissionDef, PlatformRolePermission } from '@/pages/platform/security/PlatformSecurity';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Shield, Lock, Eye, Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MODULE_LABELS: Record<string, string> = {
  tenants: 'Clientes',
  modulos: 'Módulos',
  auditoria: 'Auditoria',
  financeiro: 'Financeiro',
  fiscal: 'Fiscal',
  suporte: 'Suporte',
  usuarios: 'Usuários',
  seguranca: 'Segurança',
  marketplace: 'Marketplace',
  compliance: 'Compliance',
};

const MODULE_OPTIONS = Object.entries(MODULE_LABELS).map(([value, label]) => ({ value, label }));

interface Props {
  roles: PlatformRole[];
  permissions: PlatformPermissionDef[];
  rolePerms: PlatformRolePermission[];
  loading: boolean;
  isSuperAdmin: boolean;
  onRefresh: () => void;
}

interface RoleForm {
  name: string;
  slug: string;
  description: string;
}

interface PermForm {
  code: string;
  module: string;
  resource: string;
  action: string;
  domain: string;
  description: string;
}

const emptyRoleForm = (): RoleForm => ({ name: '', slug: '', description: '' });
const emptyPermForm = (): PermForm => ({ code: '', module: '', resource: '', action: '', domain: 'platform', description: '' });

function slugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export function PlatformRolesTab({ roles, permissions, rolePerms, loading, isSuperAdmin, onRefresh }: Props) {
  const { toast } = useToast();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Role CRUD state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<PlatformRole | null>(null);
  const [roleForm, setRoleForm] = useState<RoleForm>(emptyRoleForm());
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<PlatformRole | null>(null);

  // Permission CRUD state
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [editingPerm, setEditingPerm] = useState<PlatformPermissionDef | null>(null);
  const [permForm, setPermForm] = useState<PermForm>(emptyPermForm());
  const [deletePermTarget, setDeletePermTarget] = useState<PlatformPermissionDef | null>(null);

  // Default to first role
  const activeRoleId = selectedRoleId ?? roles[0]?.id ?? null;
  const activeRole = roles.find(r => r.id === activeRoleId);

  const groupedPerms = useMemo(() => {
    const map = new Map<string, PlatformPermissionDef[]>();
    permissions.forEach(p => {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    });
    return map;
  }, [permissions]);

  const currentRolePermIds = useMemo(() => {
    return new Set(rolePerms.filter(rp => rp.role_id === activeRoleId).map(rp => rp.permission_id));
  }, [rolePerms, activeRoleId]);

  const isLocked = activeRole?.slug === 'platform_super_admin';

  // ── Toggle permission on role ──
  const handleToggle = async (permId: string, currently: boolean) => {
    if (isLocked || !isSuperAdmin || !activeRoleId) return;
    setToggling(permId);
    if (currently) {
      const { error } = await supabase
        .from('platform_role_permissions')
        .delete()
        .eq('role_id', activeRoleId)
        .eq('permission_id', permId);
      if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      const slug = activeRole?.slug ?? 'platform_read_only';
      const { error } = await supabase
        .from('platform_role_permissions')
        .insert({ role_id: activeRoleId, permission_id: permId, role: slug } as any);
      if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
    setToggling(null);
    onRefresh();
  };

  // ── Role CRUD ──
  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm(emptyRoleForm());
    setRoleDialogOpen(true);
  };

  const openEditRole = (role: PlatformRole, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRole(role);
    setRoleForm({ name: role.name, slug: role.slug, description: role.description ?? '' });
    setRoleDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!roleForm.name || !roleForm.slug) return;
    setSaving(true);
    if (editingRole) {
      const { error } = await supabase
        .from('platform_roles')
        .update({ name: roleForm.name, description: roleForm.description || null })
        .eq('id', editingRole.id);
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Cargo atualizado' });
        setRoleDialogOpen(false);
        onRefresh();
      }
    } else {
      const { error } = await supabase
        .from('platform_roles')
        .insert({ name: roleForm.name, slug: roleForm.slug, description: roleForm.description || null, is_system_role: false });
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Cargo criado' });
        setRoleDialogOpen(false);
        onRefresh();
      }
    }
    setSaving(false);
  };

  const handleDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    setSaving(true);
    // Remove role permissions first
    await supabase.from('platform_role_permissions').delete().eq('role_id', deleteRoleTarget.id);
    const { error } = await supabase.from('platform_roles').delete().eq('id', deleteRoleTarget.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Cargo removido' });
      if (selectedRoleId === deleteRoleTarget.id) setSelectedRoleId(null);
      onRefresh();
    }
    setDeleteRoleTarget(null);
    setSaving(false);
  };

  // ── Permission CRUD ──
  const openCreatePerm = () => {
    setEditingPerm(null);
    setPermForm(emptyPermForm());
    setPermDialogOpen(true);
  };

  const openEditPerm = (perm: PlatformPermissionDef, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPerm(perm);
    setPermForm({
      code: perm.code,
      module: perm.module,
      resource: perm.resource,
      action: perm.action,
      domain: perm.domain,
      description: perm.description ?? '',
    });
    setPermDialogOpen(true);
  };

  const handleSavePerm = async () => {
    if (!permForm.code || !permForm.module || !permForm.resource || !permForm.action) return;
    setSaving(true);
    if (editingPerm) {
      const { error } = await supabase
        .from('platform_permission_definitions')
        .update({
          code: permForm.code,
          module: permForm.module,
          resource: permForm.resource,
          action: permForm.action,
          domain: permForm.domain,
          description: permForm.description || null,
        })
        .eq('id', editingPerm.id);
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Permissão atualizada' });
        setPermDialogOpen(false);
        onRefresh();
      }
    } else {
      const { error } = await supabase
        .from('platform_permission_definitions')
        .insert({
          code: permForm.code,
          module: permForm.module,
          resource: permForm.resource,
          action: permForm.action,
          domain: permForm.domain,
          description: permForm.description || null,
        });
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Permissão criada' });
        setPermDialogOpen(false);
        onRefresh();
      }
    }
    setSaving(false);
  };

  const handleDeletePerm = async () => {
    if (!deletePermTarget) return;
    setSaving(true);
    // Remove from role_permissions first
    await supabase.from('platform_role_permissions').delete().eq('permission_id', deletePermTarget.id);
    const { error } = await supabase.from('platform_permission_definitions').delete().eq('id', deletePermTarget.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Permissão removida' });
      onRefresh();
    }
    setDeletePermTarget(null);
    setSaving(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* ── Role cards ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Cargos</h3>
          {isSuperAdmin && (
            <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={openCreateRole}>
              <Plus className="h-3.5 w-3.5" /> Novo Cargo
            </Button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map(role => {
            const permCount = rolePerms.filter(rp => rp.role_id === role.id).length;
            const isActive = activeRoleId === role.id;
            return (
              <Card
                key={role.id}
                className={`cursor-pointer transition-all ${isActive ? 'ring-2 ring-primary shadow-md' : 'hover:shadow-sm'}`}
                onClick={() => setSelectedRoleId(role.id)}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {role.slug === 'platform_super_admin'
                        ? <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        : <Shield className="h-3.5 w-3.5 text-primary" />}
                      <span className="text-sm font-semibold leading-tight">{role.name}</span>
                    </div>
                    {isSuperAdmin && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost" size="icon"
                          className="h-6 w-6"
                          onClick={e => openEditRole(role, e)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        {!role.is_system_role && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={e => { e.stopPropagation(); setDeleteRoleTarget(role); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {role.is_system_role && <Badge variant="secondary" className="text-[9px] mb-1">Sistema</Badge>}
                  <p className="text-xs text-muted-foreground line-clamp-2">{role.description}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {permCount}/{permissions.length} permissões
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Permission Matrix ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Permissões: {activeRole?.name ?? '—'}
              </CardTitle>
              <CardDescription>
                {isLocked
                  ? 'Super Admin possui todas as permissões (não editável).'
                  : isSuperAdmin
                    ? 'Clique para ativar/desativar permissões deste cargo.'
                    : 'Somente Super Admins podem editar permissões.'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {!isSuperAdmin && (
                <Badge variant="outline" className="gap-1"><Eye className="h-3 w-3" /> Visualização</Badge>
              )}
              {isSuperAdmin && (
                <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={openCreatePerm}>
                  <Plus className="h-3.5 w-3.5" /> Nova Permissão
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Array.from(groupedPerms.entries()).map(([module, perms]) => (
              <div key={module}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {MODULE_LABELS[module] || module}
                </h4>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {perms.map(perm => {
                    const hasIt = currentRolePermIds.has(perm.id);
                    const isTogglingThis = toggling === perm.id;
                    return (
                      <label
                        key={perm.id}
                        className={`group flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                          isLocked || !isSuperAdmin ? 'cursor-default' : 'cursor-pointer hover:bg-muted/50'
                        } ${hasIt ? 'border-primary/30 bg-primary/5' : 'border-border'}`}
                      >
                        <Checkbox
                          checked={hasIt}
                          disabled={isLocked || !isSuperAdmin || isTogglingThis}
                          onCheckedChange={() => handleToggle(perm.id, hasIt)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{perm.code}</p>
                          {perm.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
                          )}
                        </div>
                        {isTogglingThis
                          ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                          : isSuperAdmin && (
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <Button
                                variant="ghost" size="icon" className="h-5 w-5"
                                onClick={e => openEditPerm(perm, e)}
                                type="button"
                              >
                                <Pencil className="h-2.5 w-2.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive"
                                onClick={e => { e.preventDefault(); e.stopPropagation(); setDeletePermTarget(perm); }}
                                type="button"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          )
                        }
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Role Dialog (Create / Edit) ── */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Editar Cargo' : 'Novo Cargo'}</DialogTitle>
            <DialogDescription>
              {editingRole ? 'Atualize o nome e descrição do cargo.' : 'Defina um novo cargo para usuários da plataforma.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nome *</Label>
              <Input
                value={roleForm.name}
                onChange={e => setRoleForm(f => ({
                  ...f,
                  name: e.target.value,
                  slug: editingRole ? f.slug : slugify(e.target.value),
                }))}
                placeholder="Ex: Gerente de Suporte"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Slug (identificador) *</Label>
              <Input
                value={roleForm.slug}
                onChange={e => setRoleForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                placeholder="Ex: platform_support_manager"
                disabled={!!editingRole}
                className={editingRole ? 'bg-muted text-muted-foreground' : ''}
              />
              {editingRole && (
                <p className="text-[11px] text-muted-foreground">O slug não pode ser alterado após criação.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Textarea
                value={roleForm.description}
                onChange={e => setRoleForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descreva as responsabilidades deste cargo..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancelar</Button>
            <Button
              disabled={!roleForm.name || !roleForm.slug || saving}
              onClick={handleSaveRole}
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : editingRole ? 'Salvar' : 'Criar Cargo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Role Confirm ── */}
      <AlertDialog open={!!deleteRoleTarget} onOpenChange={open => !open && setDeleteRoleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Cargo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o cargo <strong>{deleteRoleTarget?.name}</strong>?
              Todas as permissões associadas serão desvinculadas. Usuários com este cargo ficarão sem função definida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteRole}
            >
              {saving ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Permission Dialog (Create / Edit) ── */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPerm ? 'Editar Permissão' : 'Nova Permissão'}</DialogTitle>
            <DialogDescription>
              Permissões definem quais ações cada cargo pode executar na plataforma.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Código * <span className="normal-case text-muted-foreground">(ex: ticket.view)</span></Label>
              <Input
                value={permForm.code}
                onChange={e => setPermForm(f => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '') }))}
                placeholder="modulo.acao"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Módulo *</Label>
              <Select value={permForm.module} onValueChange={v => setPermForm(f => ({ ...f, module: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {MODULE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Recurso *</Label>
              <Input
                value={permForm.resource}
                onChange={e => setPermForm(f => ({ ...f, resource: e.target.value }))}
                placeholder="Ex: ticket, user, plan"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ação *</Label>
              <Select value={permForm.action} onValueChange={v => setPermForm(f => ({ ...f, action: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">view</SelectItem>
                  <SelectItem value="create">create</SelectItem>
                  <SelectItem value="edit">edit</SelectItem>
                  <SelectItem value="delete">delete</SelectItem>
                  <SelectItem value="manage">manage</SelectItem>
                  <SelectItem value="approve">approve</SelectItem>
                  <SelectItem value="export">export</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Domínio</Label>
              <Input
                value={permForm.domain}
                onChange={e => setPermForm(f => ({ ...f, domain: e.target.value }))}
                placeholder="platform"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Descrição</Label>
              <Textarea
                value={permForm.description}
                onChange={e => setPermForm(f => ({ ...f, description: e.target.value }))}
                placeholder="O que esta permissão permite fazer..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermDialogOpen(false)}>Cancelar</Button>
            <Button
              disabled={!permForm.code || !permForm.module || !permForm.resource || !permForm.action || saving}
              onClick={handleSavePerm}
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : editingPerm ? 'Salvar' : 'Criar Permissão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Permission Confirm ── */}
      <AlertDialog open={!!deletePermTarget} onOpenChange={open => !open && setDeletePermTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Permissão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a permissão <strong>{deletePermTarget?.code}</strong>?
              Ela será desvinculada de todos os cargos que a possuem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeletePerm}
            >
              {saving ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
