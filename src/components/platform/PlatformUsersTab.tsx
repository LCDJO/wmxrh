/**
 * Platform Users Tab — List, create, edit, remove platform-level users.
 * Now uses platform_roles table with role_id FK instead of enum.
 */
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PlatformUser, PlatformRole } from '@/pages/platform/PlatformSecurity';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, MoreHorizontal, UserCog, Ban, CheckCircle, Trash2, Loader2, Shield } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Ativo', variant: 'default' },
  inactive: { label: 'Inativo', variant: 'secondary' },
  suspended: { label: 'Suspenso', variant: 'destructive' },
};

interface Props {
  users: PlatformUser[];
  roles: PlatformRole[];
  loading: boolean;
  isSuperAdmin: boolean;
  currentUserId?: string;
  onRefresh: () => void;
}

export function PlatformUsersTab({ users, roles, loading, isSuperAdmin, currentUserId, onRefresh }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<PlatformUser | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [form, setForm] = useState({ email: '', display_name: '', role_id: '', password: '' });
  // Edit form
  const [editRoleId, setEditRoleId] = useState('');

  const getRoleName = (user: PlatformUser) => {
    if (user.platform_roles) return user.platform_roles.name;
    const role = roles.find(r => r.id === user.role_id);
    return role?.name ?? user.role;
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) ||
      u.display_name?.toLowerCase().includes(q) ||
      getRoleName(u).toLowerCase().includes(q);
  });

  const defaultRoleId = roles.find(r => r.slug === 'platform_read_only')?.id ?? '';

  const handleCreate = async () => {
    if (!form.email || !form.password) return;
    setSaving(true);

    const roleId = form.role_id || defaultRoleId;
    const role = roles.find(r => r.id === roleId);

    const { data, error } = await supabase.functions.invoke('manage-platform-user', {
      body: {
        action: 'create',
        email: form.email.trim(),
        password: form.password,
        display_name: form.display_name.trim() || null,
        role: role?.slug ?? 'platform_read_only',
        role_id: roleId,
      },
    });

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Usuário criado', description: `${form.email} adicionado como ${role?.name ?? 'usuário'}.` });
      setCreateOpen(false);
      setForm({ email: '', display_name: '', role_id: '', password: '' });
      onRefresh();
    }
    setSaving(false);
  };

  const handleUpdateRole = async () => {
    if (!editUser || !editRoleId) return;
    setSaving(true);

    const role = roles.find(r => r.id === editRoleId);
    const { error } = await supabase
      .from('platform_users')
      .update({ role_id: editRoleId, role: role?.slug } as any)
      .eq('id', editUser.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Cargo atualizado' });
      setEditUser(null);
      onRefresh();
    }
    setSaving(false);
  };

  const handleToggleStatus = async (user: PlatformUser) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    const { error } = await supabase
      .from('platform_users')
      .update({ status: newStatus })
      .eq('id', user.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: newStatus === 'suspended' ? 'Usuário suspenso' : 'Usuário reativado' });
      onRefresh();
    }
  };

  const handleDelete = async (user: PlatformUser) => {
    if (user.user_id === currentUserId) {
      toast({ title: 'Erro', description: 'Você não pode remover a si mesmo.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('platform_users').delete().eq('id', user.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Usuário removido' });
      onRefresh();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por email, nome ou cargo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2" size="sm">
            <Plus className="h-4 w-4" /> Novo Usuário
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
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
                  {isSuperAdmin && <TableHead className="w-[50px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(u => {
                  const st = STATUS_BADGE[u.status] ?? { label: u.status, variant: 'secondary' as const };
                  const isSelf = u.user_id === currentUserId;
                  return (
                    <TableRow key={u.id}>
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
                      {isSuperAdmin && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditUser(u); setEditRoleId(u.role_id); }}>
                                <UserCog className="h-4 w-4 mr-2" /> Alterar Cargo
                              </DropdownMenuItem>
                              {!isSelf && (
                                <>
                                  <DropdownMenuItem onClick={() => handleToggleStatus(u)}>
                                    {u.status === 'active' ? (
                                      <><Ban className="h-4 w-4 mr-2" /> Suspender</>
                                    ) : (
                                      <><CheckCircle className="h-4 w-4 mr-2" /> Reativar</>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(u)}>
                                    <Trash2 className="h-4 w-4 mr-2" /> Remover
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="usuario@plataforma.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Senha *</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nome de exibição</Label>
              <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Nome completo" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cargo</Label>
              <Select value={form.role_id || defaultRoleId} onValueChange={v => setForm(f => ({ ...f, role_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!form.email || !form.password || saving} onClick={handleCreate}>
              {saving ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Role Dialog ── */}
      <Dialog open={!!editUser} onOpenChange={open => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar Cargo</DialogTitle>
            <DialogDescription>{editUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={editRoleId} onValueChange={setEditRoleId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full" disabled={saving || editRoleId === editUser?.role_id} onClick={handleUpdateRole}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
