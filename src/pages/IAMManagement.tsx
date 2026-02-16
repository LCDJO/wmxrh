/**
 * IAM Management — Roles, Permissions, User Assignments
 */
import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { iamService, type CustomRole, type PermissionDefinition, type RolePermission, type UserCustomRole, type TenantUser } from '@/domains/iam/iam.service';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Shield, Users, Key, Pencil, Trash2, ShieldCheck, Lock } from 'lucide-react';

const MODULE_LABELS: Record<string, string> = {
  empresa: 'Empresa',
  funcionarios: 'Funcionários',
  remuneracao: 'Remuneração',
  beneficios: 'Benefícios',
  saude: 'Saúde',
  trabalhista: 'Trabalhista',
  esocial: 'eSocial',
  auditoria: 'Auditoria',
  iam: 'Gestão de Acesso',
  inteligencia: 'Inteligência',
  termos: 'Termos',
};

export default function IAMManagement() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { isTenantAdmin } = useSecurityKernel();
  const { toast } = useToast();
  const qc = useQueryClient();
  const tenantId = currentTenant?.id;

  // Queries
  const { data: roles = [] } = useQuery({
    queryKey: ['iam_roles', tenantId],
    queryFn: () => iamService.listRoles(tenantId!),
    enabled: !!tenantId,
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['iam_permissions'],
    queryFn: () => iamService.listPermissions(),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['iam_assignments', tenantId],
    queryFn: () => iamService.listUserAssignments(tenantId!),
    enabled: !!tenantId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['iam_members', tenantId],
    queryFn: () => iamService.listTenantMembers(tenantId!),
    enabled: !!tenantId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['iam_roles'] });
    qc.invalidateQueries({ queryKey: ['iam_assignments'] });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Gestão de Acesso (IAM)</h1>
        <p className="text-muted-foreground mt-1">Gerencie cargos, permissões e atribuições de usuários.</p>
      </div>

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles" className="gap-1.5"><Shield className="h-4 w-4" />Cargos</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-4 w-4" />Usuários</TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
          <RolesTab
            roles={roles}
            permissions={permissions}
            tenantId={tenantId!}
            userId={user?.id}
            isTenantAdmin={isTenantAdmin}
            onInvalidate={invalidateAll}
          />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab
            members={members}
            assignments={assignments}
            roles={roles}
            tenantId={tenantId!}
            userId={user?.id}
            isTenantAdmin={isTenantAdmin}
            onInvalidate={invalidateAll}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════
// ROLES TAB
// ═══════════════════════════════════

function RolesTab({ roles, permissions, tenantId, userId, isTenantAdmin, onInvalidate }: {
  roles: CustomRole[];
  permissions: PermissionDefinition[];
  tenantId: string;
  userId?: string;
  isTenantAdmin: boolean;
  onInvalidate: () => void;
}) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const createRole = useMutation({
    mutationFn: (dto: { tenant_id: string; name: string; slug: string; description?: string; created_by?: string }) =>
      iamService.createRole(dto),
    onSuccess: () => {
      toast({ title: 'Cargo criado!' });
      setCreateOpen(false);
      setName('');
      setDescription('');
      onInvalidate();
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteRole = useMutation({
    mutationFn: (id: string) => iamService.deleteRole(id),
    onSuccess: () => { toast({ title: 'Cargo removido!' }); onInvalidate(); },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const handleCreate = () => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    createRole.mutate({ tenant_id: tenantId, name, slug, description: description || undefined, created_by: userId });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Cargos do Sistema</h2>
        {isTenantAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Novo Cargo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Cargo</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Analista RH" />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição do cargo" />
                </div>
                <Button className="w-full" disabled={!name || createRole.isPending} onClick={handleCreate}>
                  {createRole.isPending ? 'Criando...' : 'Criar Cargo'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map(role => (
          <Card key={role.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {role.is_system ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Shield className="h-4 w-4 text-primary" />}
                  <CardTitle className="text-base">{role.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  {role.is_system && <Badge variant="secondary" className="text-[10px]">Sistema</Badge>}
                  {!role.is_active && <Badge variant="destructive" className="text-[10px]">Inativo</Badge>}
                </div>
              </div>
              {role.description && <CardDescription className="text-xs">{role.description}</CardDescription>}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setEditingRole(role)}>
                  <Key className="h-3 w-3" />Permissões
                </Button>
                {isTenantAdmin && !role.is_system && (
                  <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive" onClick={() => deleteRole.mutate(role.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editingRole && (
        <PermissionEditor
          role={editingRole}
          permissions={permissions}
          userId={userId}
          isTenantAdmin={isTenantAdmin}
          onClose={() => setEditingRole(null)}
          onSaved={onInvalidate}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════
// PERMISSION EDITOR DIALOG
// ═══════════════════════════════════

function PermissionEditor({ role, permissions, userId, isTenantAdmin, onClose, onSaved }: {
  role: CustomRole;
  permissions: PermissionDefinition[];
  userId?: string;
  isTenantAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { data: rolePerms = [], isLoading } = useQuery({
    queryKey: ['iam_role_perms', role.id],
    queryFn: () => iamService.listRolePermissions(role.id),
  });
  const qc = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Init selected from current role permissions
  if (!initialized && !isLoading && rolePerms.length >= 0) {
    setSelected(new Set(rolePerms.map(rp => rp.permission_id)));
    setInitialized(true);
  }

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionDefinition[]>();
    permissions.forEach(p => {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    });
    return map;
  }, [permissions]);

  const saveMutation = useMutation({
    mutationFn: () => iamService.setRolePermissions(role.id, Array.from(selected), 'tenant', userId),
    onSuccess: () => {
      toast({ title: 'Permissões salvas!' });
      qc.invalidateQueries({ queryKey: ['iam_role_perms', role.id] });
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleModule = (module: string) => {
    const modulePerms = grouped.get(module) || [];
    const allSelected = modulePerms.every(p => selected.has(p.id));
    setSelected(prev => {
      const next = new Set(prev);
      modulePerms.forEach(p => allSelected ? next.delete(p.id) : next.add(p.id));
      return next;
    });
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Permissões — {role.name}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([module, perms]) => {
              const allSelected = perms.every(p => selected.has(p.id));
              const someSelected = perms.some(p => selected.has(p.id));
              return (
                <div key={module} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={() => toggleModule(module)}
                      disabled={!isTenantAdmin}
                    />
                    <span className="text-sm font-semibold text-foreground">{MODULE_LABELS[module] || module}</span>
                    <Badge variant="outline" className="text-[10px]">{perms.filter(p => selected.has(p.id)).length}/{perms.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pl-6">
                    {perms.map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer hover:bg-accent/30 rounded px-2">
                        <Checkbox
                          checked={selected.has(p.id)}
                          onCheckedChange={() => toggle(p.id)}
                          disabled={!isTenantAdmin}
                        />
                        <span className="text-foreground">{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            {isTenantAdmin && (
              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando...' : `Salvar (${selected.size} permissões)`}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════
// USERS TAB
// ═══════════════════════════════════

function UsersTab({ members, assignments, roles, tenantId, userId, isTenantAdmin, onInvalidate }: {
  members: TenantUser[];
  assignments: UserCustomRole[];
  roles: CustomRole[];
  tenantId: string;
  userId?: string;
  isTenantAdmin: boolean;
  onInvalidate: () => void;
}) {
  const { toast } = useToast();
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  const assignMutation = useMutation({
    mutationFn: (dto: { user_id: string; role_id: string; tenant_id: string; assigned_by?: string }) =>
      iamService.assignRole(dto),
    onSuccess: () => {
      toast({ title: 'Cargo atribuído!' });
      setAssignOpen(false);
      setSelectedUser('');
      setSelectedRole('');
      onInvalidate();
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => iamService.removeAssignment(id),
    onSuccess: () => { toast({ title: 'Atribuição removida!' }); onInvalidate(); },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  // Group assignments by user
  const userAssignments = useMemo(() => {
    const map = new Map<string, UserCustomRole[]>();
    assignments.forEach(a => {
      const list = map.get(a.user_id) || [];
      list.push(a);
      map.set(a.user_id, list);
    });
    return map;
  }, [assignments]);

  const ROLE_LABELS: Record<string, string> = { owner: 'Proprietário', admin: 'Admin', manager: 'Gestor', viewer: 'Visualizador' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Usuários do Tenant</h2>
        {isTenantAdmin && (
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Atribuir Cargo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Atribuir Cargo a Usuário</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger><SelectValue placeholder="Selecione um usuário" /></SelectTrigger>
                    <SelectContent>
                      {members.map(m => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.user_id.slice(0, 8)}... ({ROLE_LABELS[m.role] || m.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger><SelectValue placeholder="Selecione um cargo" /></SelectTrigger>
                    <SelectContent>
                      {roles.filter(r => r.is_active).map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={!selectedUser || !selectedRole || assignMutation.isPending}
                  onClick={() => assignMutation.mutate({ user_id: selectedUser, role_id: selectedRole, tenant_id: tenantId, assigned_by: userId })}
                >
                  {assignMutation.isPending ? 'Atribuindo...' : 'Atribuir'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Membership</TableHead>
              <TableHead>Cargos Atribuídos</TableHead>
              {isTenantAdmin && <TableHead className="w-[80px]">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map(m => {
              const userRoles = userAssignments.get(m.user_id) || [];
              return (
                <TableRow key={m.user_id}>
                  <TableCell className="font-mono text-xs">{m.user_id.slice(0, 12)}...</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROLE_LABELS[m.role] || m.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {userRoles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Nenhum cargo customizado</span>
                      ) : (
                        userRoles.map(ur => (
                          <div key={ur.id} className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-xs">
                              {ur.custom_roles?.name || ur.role_id.slice(0, 8)}
                            </Badge>
                            {isTenantAdmin && (
                              <button
                                onClick={() => removeMutation.mutate(ur.id)}
                                className="text-destructive hover:text-destructive/80 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </TableCell>
                  {isTenantAdmin && <TableCell />}
                </TableRow>
              );
            })}
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Nenhum membro encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
