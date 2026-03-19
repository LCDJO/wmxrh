/**
 * Platform Users Tab — Full CRUD: create, view, edit profile, change role,
 * suspend/reactivate, delete, send notification, reset password.
 * Role-based menu preview shows what each role can access.
 */
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PlatformUser, PlatformRole } from '@/pages/platform/security/PlatformSecurity';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Search, MoreHorizontal, UserCog, Ban, CheckCircle, Trash2,
  Loader2, Shield, Pencil, Bell, KeyRound, Eye, Menu as MenuIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { hasPlatformPermission, PLATFORM_PERMISSIONS } from '@/domains/platform/platform-permissions';
import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Ativo', variant: 'default' },
  inactive: { label: 'Inativo', variant: 'secondary' },
  suspended: { label: 'Suspenso', variant: 'destructive' },
};

// Simplified menu items for role preview
const MENU_SECTIONS = [
  { label: 'Dashboard', permission: null },
  { label: 'Clientes', permission: 'tenant.view' as const },
  { label: 'Módulos', permission: 'module.view' as const },
  { label: 'Planos', permission: 'plan.manage' as const },
  { label: 'Usuários', permission: 'platform_user.view' as const },
  { label: 'IAM', permission: 'security.manage' as const },
  { label: 'Cargos & Permissões', permission: 'security.view' as const },
  { label: 'Billing', permission: 'billing.view' as const },
  { label: 'Revenue', permission: 'billing.view' as const },
  { label: 'Fiscal', permission: 'fiscal.view' as const },
  { label: 'Growth AI', permission: 'growth.view' as const },
  { label: 'Marketing', permission: 'security.view' as const },
  { label: 'Landing Pages', permission: 'landing.view_drafts' as const },
  { label: 'Monitoramento', permission: 'security.view' as const },
  { label: 'Automação', permission: 'security.manage' as const },
  { label: 'APIs', permission: 'security.manage' as const },
  { label: 'Suporte', permission: 'ticket.view' as const },
];

interface Props {
  users: PlatformUser[];
  roles: PlatformRole[];
  loading: boolean;
  isSuperAdmin: boolean;
  currentUserId?: string;
  onRefresh: () => void;
}

interface EditForm {
  display_name: string;
  role_id: string;
  status: string;
}

export function PlatformUsersTab({ users, roles, loading, isSuperAdmin, currentUserId, onRefresh }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<PlatformUser | null>(null);
  const [viewUser, setViewUser] = useState<PlatformUser | null>(null);
  const [notifyUser, setNotifyUser] = useState<PlatformUser | null>(null);
  const [resetPwUser, setResetPwUser] = useState<PlatformUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlatformUser | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({ email: '', display_name: '', role_id: '', password: '' });
  // Edit form
  const [editForm, setEditForm] = useState<EditForm>({ display_name: '', role_id: '', status: '' });
  // Notify form
  const [notifyForm, setNotifyForm] = useState({ subject: '', message: '' });
  // Reset password
  const [newPassword, setNewPassword] = useState('');

  const getRoleName = (user: PlatformUser) => {
    if (user.platform_roles) return user.platform_roles.name;
    const role = roles.find(r => r.id === user.role_id);
    return role?.name ?? user.role;
  };

  const getRoleSlug = (user: PlatformUser): string => {
    if (user.platform_roles) return user.platform_roles.slug;
    const role = roles.find(r => r.id === user.role_id);
    return role?.slug ?? user.role;
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchesSearch = u.email.toLowerCase().includes(q) ||
      u.display_name?.toLowerCase().includes(q) ||
      getRoleName(u).toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const defaultRoleId = roles.find(r => r.slug === 'platform_read_only')?.id ?? '';

  // ── Handlers ──

  const handleCreate = async () => {
    if (!createForm.email || !createForm.password) return;
    setSaving(true);
    const roleId = createForm.role_id || defaultRoleId;
    const role = roles.find(r => r.id === roleId);

    const { error } = await supabase.functions.invoke('manage-platform-user', {
      body: {
        action: 'create',
        email: createForm.email.trim(),
        password: createForm.password,
        display_name: createForm.display_name.trim() || null,
        role: role?.slug ?? 'platform_read_only',
        role_id: roleId,
      },
    });

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Usuário criado', description: `${createForm.email} adicionado.` });
      setCreateOpen(false);
      setCreateForm({ email: '', display_name: '', role_id: '', password: '' });
      onRefresh();
    }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    setSaving(true);

    const { error } = await supabase.functions.invoke('manage-platform-user', {
      body: {
        action: 'update',
        platform_user_id: editUser.id,
        display_name: editForm.display_name.trim(),
        role_id: editForm.role_id,
        status: editForm.status,
      },
    });

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Usuário atualizado' });
      setEditUser(null);
      onRefresh();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);

    const { error } = await supabase.functions.invoke('manage-platform-user', {
      body: { action: 'delete', platform_user_id: deleteTarget.id },
    });

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Usuário removido' });
      onRefresh();
    }
    setDeleteTarget(null);
    setSaving(false);
  };

  const handleNotify = async () => {
    if (!notifyUser || !notifyForm.message) return;
    setSaving(true);

    const { error } = await supabase.functions.invoke('manage-platform-user', {
      body: {
        action: 'notify',
        platform_user_id: notifyUser.id,
        subject: notifyForm.subject || 'Notificação',
        message: notifyForm.message,
      },
    });

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Notificação enviada', description: `Enviada para ${notifyUser.email}` });
      setNotifyUser(null);
      setNotifyForm({ subject: '', message: '' });
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (!resetPwUser || !newPassword) return;
    setSaving(true);

    const { error } = await supabase.functions.invoke('manage-platform-user', {
      body: {
        action: 'reset_password',
        platform_user_id: resetPwUser.id,
        new_password: newPassword,
      },
    });

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Senha redefinida' });
      setResetPwUser(null);
      setNewPassword('');
    }
    setSaving(false);
  };

  const openEdit = (u: PlatformUser) => {
    setEditForm({
      display_name: u.display_name || '',
      role_id: u.role_id,
      status: u.status,
    });
    setEditUser(u);
  };

  // Menu visibility for a role
  const getVisibleMenus = (roleSlug: string) =>
    MENU_SECTIONS.filter(m => !m.permission || hasPlatformPermission(roleSlug as PlatformRoleType, m.permission));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email, nome ou cargo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="suspended">Suspensos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2" size="sm">
            <Plus className="h-4 w-4" /> Novo Usuário
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div><p className="text-xl font-bold font-display">{users.filter(u => u.status === 'active').length}</p><p className="text-xs text-muted-foreground">Ativos</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
            <Ban className="h-4 w-4 text-destructive" />
          </div>
          <div><p className="text-xl font-bold font-display">{users.filter(u => u.status === 'suspended').length}</p><p className="text-xs text-muted-foreground">Suspensos</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <UserCog className="h-4 w-4 text-accent-foreground" />
          </div>
          <div><p className="text-xl font-bold font-display">{users.length}</p><p className="text-xs text-muted-foreground">Total</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
            <MenuIcon className="h-4 w-4 text-secondary-foreground" />
          </div>
          <div><p className="text-xl font-bold font-display">{roles.length}</p><p className="text-xs text-muted-foreground">Cargos</p></div>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(u => {
                  const st = STATUS_BADGE[u.status] ?? { label: u.status, variant: 'secondary' as const };
                  const isSelf = u.user_id === currentUserId;
                  return (
                    <TableRow key={u.id} className="cursor-pointer" onClick={() => setViewUser(u)}>
                      <TableCell className="font-medium">{u.display_name || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{getRoleName(u)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(u.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewUser(u)}>
                              <Eye className="h-4 w-4 mr-2" /> Ver Detalhes
                            </DropdownMenuItem>
                            {isSuperAdmin && (
                              <>
                                <DropdownMenuItem onClick={() => openEdit(u)}>
                                  <Pencil className="h-4 w-4 mr-2" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setNotifyUser(u)}>
                                  <Bell className="h-4 w-4 mr-2" /> Notificar
                                </DropdownMenuItem>
                                {!isSelf && (
                                  <>
                                    <DropdownMenuItem onClick={() => setResetPwUser(u)}>
                                      <KeyRound className="h-4 w-4 mr-2" /> Redefinir Senha
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => setDeleteTarget(u)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" /> Remover
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── View User Dialog ── */}
      <Dialog open={!!viewUser} onOpenChange={open => !open && setViewUser(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Detalhes do Usuário</DialogTitle>
            <DialogDescription>{viewUser?.email}</DialogDescription>
          </DialogHeader>
          {viewUser && (
            <Tabs defaultValue="profile" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="profile">Perfil</TabsTrigger>
                <TabsTrigger value="menus">Menus Visíveis</TabsTrigger>
              </TabsList>
              <TabsContent value="profile" className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Nome</p>
                    <p className="font-medium">{viewUser.display_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Email</p>
                    <p className="font-medium">{viewUser.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Cargo</p>
                    <Badge variant="outline">{getRoleName(viewUser)}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                    <Badge variant={STATUS_BADGE[viewUser.status]?.variant ?? 'secondary'}>
                      {STATUS_BADGE[viewUser.status]?.label ?? viewUser.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Criado em</p>
                    <p className="font-medium">{format(new Date(viewUser.created_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Slug do Cargo</p>
                    <p className="font-mono text-xs">{getRoleSlug(viewUser)}</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="menus" className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Menus visíveis para o cargo <strong>{getRoleName(viewUser)}</strong>:
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {MENU_SECTIONS.map(m => {
                    const visible = !m.permission || hasPlatformPermission(getRoleSlug(viewUser) as PlatformRoleType, m.permission);
                    return (
                      <div
                        key={m.label}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                          visible
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'bg-muted/50 text-muted-foreground line-through'
                        }`}
                      >
                        {visible ? <CheckCircle className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                        {m.label}
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Novo Usuário da Plataforma</DialogTitle>
            <DialogDescription>Crie um novo acesso para gerenciar o SaaS.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email *</Label>
              <Input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="usuario@plataforma.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Senha *</Label>
              <Input type="password" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nome de exibição</Label>
              <Input value={createForm.display_name} onChange={e => setCreateForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Nome completo" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cargo</Label>
              <Select value={createForm.role_id || defaultRoleId} onValueChange={v => setCreateForm(f => ({ ...f, role_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!createForm.email || !createForm.password || saving} onClick={handleCreate}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Criando...</> : 'Criar Usuário'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editUser} onOpenChange={open => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Editar Usuário</DialogTitle>
            <DialogDescription>{editUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nome de exibição</Label>
              <Input
                value={editForm.display_name}
                onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cargo</Label>
              <Select value={editForm.role_id} onValueChange={v => setEditForm(f => ({ ...f, role_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Menu preview for selected role */}
            {editForm.role_id && (
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Preview de Menus</Label>
                <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto rounded-md border border-border p-2">
                  {(() => {
                    const role = roles.find(r => r.id === editForm.role_id);
                    const slug = role?.slug ?? '';
                    return MENU_SECTIONS.map(m => {
                      const visible = !m.permission || hasPlatformPermission(slug as PlatformRoleType, m.permission);
                      return (
                        <span
                          key={m.label}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            visible ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground line-through'
                          }`}
                        >
                          {m.label}
                        </span>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            <Button className="w-full" disabled={saving} onClick={handleUpdate}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : 'Salvar Alterações'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Notify Dialog ── */}
      <Dialog open={!!notifyUser} onOpenChange={open => !open && setNotifyUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2"><Bell className="h-4 w-4" /> Enviar Notificação</DialogTitle>
            <DialogDescription>Para: {notifyUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Assunto</Label>
              <Input
                value={notifyForm.subject}
                onChange={e => setNotifyForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Assunto da notificação"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mensagem *</Label>
              <Textarea
                value={notifyForm.message}
                onChange={e => setNotifyForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Escreva a mensagem..."
                rows={4}
              />
            </div>
            <Button className="w-full" disabled={!notifyForm.message || saving} onClick={handleNotify}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</> : 'Enviar Notificação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Dialog ── */}
      <Dialog open={!!resetPwUser} onOpenChange={open => !open && setResetPwUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>{resetPwUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nova Senha *</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <Button className="w-full" disabled={!newPassword || newPassword.length < 8 || saving} onClick={handleResetPassword}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Redefinindo...</> : 'Redefinir Senha'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteTarget?.email}</strong>? Esta ação também removerá a conta de autenticação e é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
