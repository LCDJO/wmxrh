/**
 * /platform/security/roles — Full CRUD for platform roles.
 *
 * Features:
 *  1. Create new roles with permission assignment
 *  2. View all roles with permission details
 *  3. Edit role info and permissions
 *  4. Delete roles (with in-use validation)
 *  5. Clone roles (duplicate with permissions)
 *  6. Role hierarchy visualization (inherits_role_ids)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { logger } from '@/lib/logger';
import type { PlatformRole, PlatformPermissionDef, PlatformRolePermission } from './PlatformSecurity';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Shield, Lock, Loader2, Plus, Pencil, Trash2, Copy, Search,
  Users, ChevronRight, GitBranch, Eye, CheckCircle, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ──

interface RoleWithCount extends PlatformRole {
  user_count: number;
}

interface RoleFormData {
  name: string;
  slug: string;
  description: string;
  inherits_role_ids: string[];
}

const EMPTY_FORM: RoleFormData = { name: '', slug: '', description: '', inherits_role_ids: [] };

const MODULE_LABELS: Record<string, string> = {
  tenants: 'Clientes', modulos: 'Módulos', auditoria: 'Auditoria',
  financeiro: 'Financeiro', fiscal: 'Fiscal', suporte: 'Suporte',
  usuarios: 'Usuários', seguranca: 'Segurança',
  marketplace: 'Marketplace', compliance: 'Compliance',
  growth: 'Growth', marketing: 'Marketing', landing: 'Landing Pages',
};

// ── Main Component ──

export default function PlatformSecurityRoles() {
  const { identity } = usePlatformIdentity();
  const isSuperAdmin = identity?.role === 'platform_super_admin';

  const [roles, setRoles] = useState<RoleWithCount[]>([]);
  const [permissions, setPermissions] = useState<PlatformPermissionDef[]>([]);
  const [rolePerms, setRolePerms] = useState<PlatformRolePermission[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'clone' | null>(null);
  const [form, setForm] = useState<RoleFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoleWithCount | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showHierarchy, setShowHierarchy] = useState(false);

  // ── Data fetching ──

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [rolesRes, permsRes, rpRes, usersRes] = await Promise.all([
      supabase.from('platform_roles').select('*').order('name'),
      supabase.from('platform_permission_definitions').select('*').order('module, code'),
      supabase.from('platform_role_permissions').select('*'),
      supabase.from('platform_users').select('role_id'),
    ]);

    const rolesData = (rolesRes.data ?? []) as PlatformRole[];
    const usersData = usersRes.data ?? [];

    // Count users per role
    const countMap = new Map<string, number>();
    usersData.forEach((u: { role_id: string }) => {
      countMap.set(u.role_id, (countMap.get(u.role_id) ?? 0) + 1);
    });

    setRoles(rolesData.map(r => ({ ...r, user_count: countMap.get(r.id) ?? 0 })));
    setPermissions((permsRes.data as PlatformPermissionDef[]) ?? []);
    setRolePerms((rpRes.data as PlatformRolePermission[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived data ──

  const activeRole = useMemo(() => roles.find(r => r.id === selectedRoleId) ?? roles[0], [roles, selectedRoleId]);

  const rolePermMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    rolePerms.forEach(rp => {
      if (!map.has(rp.role_id)) map.set(rp.role_id, new Set());
      map.get(rp.role_id)!.add(rp.permission_id);
    });
    return map;
  }, [rolePerms]);

  const currentRolePermIds = useMemo(
    () => rolePermMap.get(activeRole?.id ?? '') ?? new Set<string>(),
    [rolePermMap, activeRole],
  );

  const groupedPerms = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = permissions.filter(
      p => p.code.toLowerCase().includes(q) || p.module.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q),
    );
    const map = new Map<string, PlatformPermissionDef[]>();
    filtered.forEach(p => {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    });
    return map;
  }, [permissions, search]);

  // ── Hierarchy tree ──

  const hierarchyTree = useMemo(() => {
    const tree: { role: RoleWithCount; children: RoleWithCount[] }[] = [];
    const childIds = new Set<string>();

    roles.forEach(r => {
      (r.inherits_role_ids ?? []).forEach(id => childIds.add(id));
    });

    // Roots = roles that are NOT inherited by anyone (top of hierarchy)
    // Actually: roles that inherit others are children. Let's show parent→child
    roles.forEach(r => {
      const parentIds = r.inherits_role_ids ?? [];
      if (parentIds.length === 0 && !childIds.has(r.id)) {
        tree.push({ role: r, children: [] });
      }
    });

    // Roles that inherit from others
    roles.forEach(r => {
      const parentIds = r.inherits_role_ids ?? [];
      if (parentIds.length > 0) {
        parentIds.forEach(pid => {
          const parent = tree.find(t => t.role.id === pid);
          if (parent) {
            parent.children.push(r);
          }
        });
      }
    });

    // Add standalone roles not yet in tree
    const inTree = new Set(tree.flatMap(t => [t.role.id, ...t.children.map(c => c.id)]));
    roles.filter(r => !inTree.has(r.id)).forEach(r => tree.push({ role: r, children: [] }));

    return tree;
  }, [roles]);

  // ── Handlers ──

  const slugify = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDialogMode('create');
  };

  const openEdit = (role: RoleWithCount) => {
    setForm({
      name: role.name,
      slug: role.slug,
      description: role.description ?? '',
      inherits_role_ids: role.inherits_role_ids ?? [],
    });
    setDialogMode('edit');
  };

  const openClone = (role: RoleWithCount) => {
    setForm({
      name: `${role.name} (Cópia)`,
      slug: `${role.slug}_copy`,
      description: role.description ?? '',
      inherits_role_ids: role.inherits_role_ids ?? [],
    });
    setSelectedRoleId(role.id); // so we know which perms to clone
    setDialogMode('clone');
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error('Nome e slug são obrigatórios');
      return;
    }

    setSaving(true);

    if (dialogMode === 'create' || dialogMode === 'clone') {
      const { data: newRole, error } = await supabase
        .from('platform_roles')
        .insert({
          name: form.name.trim(),
          slug: form.slug.trim(),
          description: form.description.trim() || null,
          is_system_role: false,
          inherits_role_ids: form.inherits_role_ids.length > 0 ? form.inherits_role_ids : [],
        })
        .select()
        .single();

      if (error) {
        logger.error('Erro ao criar cargo', { error });
        toast.error(error.message.includes('duplicate') ? 'Slug já existe' : 'Erro ao criar cargo');
        setSaving(false);
        return;
      }

      // Clone permissions if cloning
      if (dialogMode === 'clone' && activeRole) {
        const permsToClone = rolePerms.filter(rp => rp.role_id === activeRole.id);
        if (permsToClone.length > 0) {
          const inserts = permsToClone.map(rp => ({
            role_id: newRole.id,
            permission_id: rp.permission_id,
            role: form.slug.trim(),
          }));
          const { error: cloneErr } = await supabase
            .from('platform_role_permissions')
            .insert(inserts as any);
          if (cloneErr) logger.error('Erro ao clonar permissões', { error: cloneErr });
        }
      }

      toast.success(dialogMode === 'clone' ? 'Cargo clonado com sucesso' : 'Cargo criado com sucesso');
      setSelectedRoleId(newRole.id);
    } else if (dialogMode === 'edit' && activeRole) {
      if (activeRole.is_system_role && activeRole.slug !== form.slug.trim()) {
        toast.error('Não é possível alterar o slug de um cargo do sistema');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('platform_roles')
        .update({
          name: form.name.trim(),
          slug: activeRole.is_system_role ? activeRole.slug : form.slug.trim(),
          description: form.description.trim() || null,
          inherits_role_ids: form.inherits_role_ids.length > 0 ? form.inherits_role_ids : [],
        })
        .eq('id', activeRole.id);

      if (error) {
        logger.error('Erro ao atualizar cargo', { error });
        toast.error('Erro ao atualizar cargo');
        setSaving(false);
        return;
      }
      toast.success('Cargo atualizado');
    }

    setSaving(false);
    setDialogMode(null);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.user_count > 0) {
      toast.error(`Não é possível excluir: ${deleteTarget.user_count} usuário(s) atribuído(s) a este cargo`);
      setDeleteTarget(null);
      return;
    }

    if (deleteTarget.is_system_role) {
      toast.error('Cargos do sistema não podem ser excluídos');
      setDeleteTarget(null);
      return;
    }

    // Delete permissions first, then role
    await supabase.from('platform_role_permissions').delete().eq('role_id', deleteTarget.id);
    const { error } = await supabase.from('platform_roles').delete().eq('id', deleteTarget.id);

    if (error) {
      logger.error('Erro ao excluir cargo', { error });
      toast.error('Erro ao excluir cargo');
    } else {
      toast.success('Cargo excluído');
      if (selectedRoleId === deleteTarget.id) setSelectedRoleId(null);
    }

    setDeleteTarget(null);
    fetchAll();
  };

  const handleTogglePerm = async (permId: string, currently: boolean) => {
    if (!activeRole || activeRole.slug === 'platform_super_admin' || !isSuperAdmin) return;
    setToggling(permId);

    if (currently) {
      const { error } = await supabase
        .from('platform_role_permissions')
        .delete()
        .eq('role_id', activeRole.id)
        .eq('permission_id', permId);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase
        .from('platform_role_permissions')
        .insert({ role_id: activeRole.id, permission_id: permId, role: activeRole.slug } as any);
      if (error) toast.error(error.message);
    }

    setToggling(null);
    fetchAll();
  };

  // ── Render ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isLocked = activeRole?.slug === 'platform_super_admin';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-platform-accent">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Cargos & Permissões</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie cargos, permissões, clonagem e hierarquia da plataforma.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHierarchy(!showHierarchy)}
            className="gap-1.5"
          >
            <GitBranch className="h-4 w-4" />
            {showHierarchy ? 'Ocultar Hierarquia' : 'Hierarquia'}
          </Button>
          {isSuperAdmin && (
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo Cargo
            </Button>
          )}
        </div>
      </div>

      {/* Hierarchy View */}
      {showHierarchy && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" /> Hierarquia de Cargos
            </CardTitle>
            <CardDescription>Visualize a relação de herança entre os cargos. Cargos filhos herdam permissões dos pais.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {hierarchyTree.map(({ role, children }) => (
                <div key={role.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    {role.slug === 'platform_super_admin'
                      ? <Lock className="h-4 w-4 text-destructive" />
                      : <Shield className="h-4 w-4 text-primary" />
                    }
                    <span className="font-semibold text-sm">{role.name}</span>
                    {role.is_system_role && <Badge variant="secondary" className="text-[9px]">Sistema</Badge>}
                    <Badge variant="outline" className="text-[9px] ml-auto gap-1">
                      <Users className="h-3 w-3" /> {role.user_count}
                    </Badge>
                  </div>
                  {children.length > 0 && (
                    <div className="ml-6 mt-2 space-y-1.5 border-l-2 border-primary/20 pl-4">
                      {children.map(child => (
                        <div key={child.id} className="flex items-center gap-2 text-sm">
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <span>{child.name}</span>
                          <span className="text-xs text-muted-foreground">herda de {role.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map(role => {
          const permCount = rolePermMap.get(role.id)?.size ?? 0;
          const isActive = activeRole?.id === role.id;
          return (
            <Card
              key={role.id}
              className={cn(
                'cursor-pointer transition-all group',
                isActive ? 'ring-2 ring-primary shadow-md' : 'hover:shadow-sm',
              )}
              onClick={() => setSelectedRoleId(role.id)}
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {role.slug === 'platform_super_admin'
                      ? <Lock className="h-3.5 w-3.5 text-destructive" />
                      : <Shield className="h-3.5 w-3.5 text-primary" />
                    }
                    <span className="text-sm font-semibold truncate">{role.name}</span>
                  </div>
                  {role.is_system_role && <Badge variant="secondary" className="text-[9px] shrink-0">Sistema</Badge>}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{role.description || '—'}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{permCount} permissões</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{role.user_count}</span>
                  </div>
                  {isSuperAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6"
                        onClick={e => { e.stopPropagation(); openEdit(role); }}
                        title="Editar"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6"
                        onClick={e => { e.stopPropagation(); openClone(role); }}
                        title="Clonar"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {!role.is_system_role && (
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={e => { e.stopPropagation(); setDeleteTarget(role); }}
                          title="Excluir"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Permission Matrix for active role */}
      {activeRole && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Permissões: {activeRole.name}
                  {isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                </CardTitle>
                <CardDescription>
                  {isLocked
                    ? 'Super Admin possui todas as permissões (não editável).'
                    : isSuperAdmin
                      ? 'Clique para ativar/desativar permissões deste cargo.'
                      : 'Somente Super Admins podem editar permissões.'
                  }
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {!isSuperAdmin && (
                  <Badge variant="outline" className="gap-1"><Eye className="h-3 w-3" /> Visualização</Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {currentRolePermIds.size}/{permissions.length}
                </Badge>
              </div>
            </div>
            <div className="relative max-w-xs mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filtrar permissões..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Array.from(groupedPerms.entries()).map(([module, perms]) => (
                <div key={module}>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    {MODULE_LABELS[module] || module}
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{perms.length}</Badge>
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {perms.map(perm => {
                      const hasIt = isLocked || currentRolePermIds.has(perm.id);
                      const isTogglingThis = toggling === perm.id;
                      return (
                        <label
                          key={perm.id}
                          className={cn(
                            'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                            isLocked || !isSuperAdmin ? 'cursor-default' : 'cursor-pointer hover:bg-muted/50',
                            hasIt ? 'border-primary/30 bg-primary/5' : 'border-border',
                          )}
                        >
                          <Checkbox
                            checked={hasIt}
                            disabled={isLocked || !isSuperAdmin || isTogglingThis}
                            onCheckedChange={() => handleTogglePerm(perm.id, hasIt)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium font-mono leading-tight">{perm.code}</p>
                            {perm.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
                            )}
                          </div>
                          {isTogglingThis && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              {groupedPerms.size === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma permissão encontrada.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Create/Edit/Clone Dialog ── */}
      <Dialog open={dialogMode !== null} onOpenChange={open => !open && setDialogMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? 'Novo Cargo' : dialogMode === 'clone' ? 'Clonar Cargo' : 'Editar Cargo'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'clone'
                ? 'Um novo cargo será criado com as mesmas permissões do cargo original.'
                : 'Defina as informações do cargo. Permissões podem ser configuradas após a criação.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={e => {
                  setForm(prev => ({
                    ...prev,
                    name: e.target.value,
                    slug: dialogMode !== 'edit' ? slugify(e.target.value) : prev.slug,
                  }));
                }}
                placeholder="Ex: Gerente de Operações"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug *</Label>
              <Input
                value={form.slug}
                onChange={e => setForm(prev => ({ ...prev, slug: slugify(e.target.value) }))}
                placeholder="gerente_operacoes"
                disabled={dialogMode === 'edit' && activeRole?.is_system_role}
              />
              <p className="text-[10px] text-muted-foreground">Identificador único usado internamente.</p>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Responsável por..."
              />
            </div>
            <div className="space-y-2">
              <Label>Herda permissões de</Label>
              <Select
                value={form.inherits_role_ids[0] ?? 'none'}
                onValueChange={val => setForm(prev => ({
                  ...prev,
                  inherits_role_ids: val === 'none' ? [] : [val],
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum (cargo independente)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {roles
                    .filter(r => r.id !== activeRole?.id)
                    .map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">O cargo herdará todas as permissões do cargo pai.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {dialogMode === 'clone' ? 'Clonar' : dialogMode === 'edit' ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cargo "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.user_count > 0
                ? `Este cargo possui ${deleteTarget.user_count} usuário(s) atribuído(s) e não pode ser excluído. Reatribua os usuários primeiro.`
                : 'Esta ação é irreversível. O cargo e todas as suas permissões serão removidos permanentemente.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!!deleteTarget && deleteTarget.user_count > 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
