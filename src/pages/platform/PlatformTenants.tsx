/**
 * /platform/tenants — Full tenant management page
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';
import { platformEvents } from '@/domains/platform/platform-events';
import { PLATFORM_MODULES, type ModuleKey } from '@/domains/platform/platform-modules';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Building2, Plus, Search, Ban, CheckCircle, Eye, Puzzle,
  Loader2, MoreHorizontal, Users, Calendar,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

interface Tenant {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
}

interface TenantModule {
  id: string;
  tenant_id: string;
  module_key: string;
  is_active: boolean;
}

type DialogMode = 'create' | 'view' | 'modules' | null;

export default function PlatformTenants() {
  const { can } = usePlatformPermissions();
  const { user } = useAuth();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [form, setForm] = useState({ name: '', document: '', email: '', phone: '', adminEmail: '', adminName: '' });

  // Modules
  const [tenantModules, setTenantModules] = useState<TenantModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);

  const fetchTenants = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tenants')
      .select('id, name, document, email, phone, status, created_at')
      .order('created_at', { ascending: false });
    setTenants((data as Tenant[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTenants(); }, []);

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.document?.includes(search) ||
    t.email?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Create Tenant (atomic: tenant + role + first admin) ──
  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.rpc('platform_create_tenant', {
      p_name: form.name.trim(),
      p_document: form.document.trim() || null,
      p_email: form.email.trim() || null,
      p_phone: form.phone.trim() || null,
      p_admin_email: form.adminEmail.trim() || null,
      p_admin_name: form.adminName.trim() || null,
    });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      const tenantId = typeof data === 'object' && data !== null ? (data as any).tenant_id : '';
      platformEvents.tenantCreated(user?.id ?? '', tenantId, form.name.trim());
      toast({ title: 'Tenant criado', description: `${form.name} criado com role TenantAdmin e convite enviado.` });
      setForm({ name: '', document: '', email: '', phone: '', adminEmail: '', adminName: '' });
      setDialogMode(null);
      fetchTenants();
    }
    setSaving(false);
  };

  // ── Suspend / Activate ──
  const handleToggleStatus = async (tenant: Tenant) => {
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active';
    const { error } = await supabase
      .from('tenants')
      .update({ status: newStatus })
      .eq('id', tenant.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      if (newStatus === 'suspended') {
        platformEvents.tenantSuspended(user?.id ?? '', tenant.id, tenant.name);
      } else {
        platformEvents.tenantReactivated(user?.id ?? '', tenant.id, tenant.name);
      }
      toast({ title: newStatus === 'suspended' ? 'Tenant suspenso' : 'Tenant reativado' });
      fetchTenants();
    }
  };

  // ── Modules ──
  const openModules = async (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDialogMode('modules');
    setModulesLoading(true);
    const { data } = await supabase
      .from('tenant_modules')
      .select('id, tenant_id, module_key, is_active')
      .eq('tenant_id', tenant.id);
    setTenantModules((data as TenantModule[]) ?? []);
    setModulesLoading(false);
  };

  const toggleModule = async (moduleKey: string, currentlyActive: boolean) => {
    if (!selectedTenant) return;
    const existing = tenantModules.find(m => m.module_key === moduleKey);

    if (existing) {
      await supabase
        .from('tenant_modules')
        .update({ is_active: !currentlyActive, deactivated_at: currentlyActive ? new Date().toISOString() : null })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('tenant_modules')
        .insert({ tenant_id: selectedTenant.id, module_key: moduleKey, is_active: true });
    }

    // Refresh
    const { data } = await supabase
      .from('tenant_modules')
      .select('id, tenant_id, module_key, is_active')
      .eq('tenant_id', selectedTenant.id);
    setTenantModules((data as TenantModule[]) ?? []);
  };

  const isModuleActive = (key: string) => tenantModules.find(m => m.module_key === key)?.is_active ?? false;

  const statusBadge = (status: string) => {
    if (status === 'active') return <Badge variant="default" className="bg-primary/10 text-primary border-0">Ativo</Badge>;
    if (status === 'suspended') return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-0">Suspenso</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Tenants</h1>
            <p className="text-sm text-muted-foreground">
              {tenants.length} empresa{tenants.length !== 1 ? 's' : ''} cadastrada{tenants.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {can('tenant.create') && (
          <Button onClick={() => setDialogMode('create')} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Tenant
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{tenants.filter(t => t.status === 'active').length}</p>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
              <Ban className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{tenants.filter(t => t.status === 'suspended').length}</p>
              <p className="text-xs text-muted-foreground">Suspensos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info/10">
              <Users className="h-4 w-4 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{tenants.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CNPJ ou email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhum tenant encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(tenant => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {tenant.document || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {tenant.email || '—'}
                    </TableCell>
                    <TableCell>{statusBadge(tenant.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(tenant.created_at), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedTenant(tenant); setDialogMode('view'); }}>
                            <Eye className="h-4 w-4 mr-2" /> Ver detalhes
                          </DropdownMenuItem>
                          {can('module.enable') && (
                            <DropdownMenuItem onClick={() => openModules(tenant)}>
                              <Puzzle className="h-4 w-4 mr-2" /> Módulos
                            </DropdownMenuItem>
                          )}
                          {can('tenant.suspend') && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(tenant)}
                                className={tenant.status === 'active' ? 'text-destructive focus:text-destructive' : 'text-primary focus:text-primary'}
                              >
                                {tenant.status === 'active' ? (
                                  <><Ban className="h-4 w-4 mr-2" /> Suspender</>
                                ) : (
                                  <><CheckCircle className="h-4 w-4 mr-2" /> Reativar</>
                                )}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ═══ Create Tenant Dialog ═══ */}
      <Dialog open={dialogMode === 'create'} onOpenChange={open => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Novo Tenant</DialogTitle>
            <DialogDescription>Cadastre uma nova empresa cliente na plataforma.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nome da empresa *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Empresa ABC Ltda" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">CNPJ</Label>
              <Input value={form.document} onChange={e => setForm(f => ({ ...f, document: e.target.value }))} placeholder="00.000.000/0000-00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email da empresa</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@empresa.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Telefone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 0000-0000" />
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Primeiro Administrador</p>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email do admin *</Label>
                <Input type="email" value={form.adminEmail} onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))} placeholder="admin@empresa.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nome do admin</Label>
                <Input value={form.adminName} onChange={e => setForm(f => ({ ...f, adminName: e.target.value }))} placeholder="João Silva" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving || !form.name.trim() || !form.adminEmail.trim()} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar Tenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ View Tenant Dialog ═══ */}
      <Dialog open={dialogMode === 'view'} onOpenChange={open => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{selectedTenant?.name}</DialogTitle>
            <DialogDescription>Detalhes do tenant</DialogDescription>
          </DialogHeader>
          {selectedTenant && (
            <div className="space-y-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                {statusBadge(selectedTenant.status)}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CNPJ</span>
                <span className="font-mono">{selectedTenant.document || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{selectedTenant.email || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Telefone</span>
                <span>{selectedTenant.phone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado em</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(selectedTenant.created_at), 'dd/MM/yyyy HH:mm')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-xs text-muted-foreground">{selectedTenant.id.slice(0, 8)}…</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Modules Dialog ═══ */}
      <Dialog open={dialogMode === 'modules'} onOpenChange={open => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Puzzle className="h-5 w-5 text-primary" />
              Módulos — {selectedTenant?.name}
            </DialogTitle>
            <DialogDescription>Ative ou desative módulos para este tenant.</DialogDescription>
          </DialogHeader>
          {modulesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2 py-2 max-h-[400px] overflow-y-auto">
              {PLATFORM_MODULES.map(mod => {
                const active = isModuleActive(mod.key);
                return (
                  <div
                    key={mod.key}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">{mod.label}</p>
                      <p className="text-xs text-muted-foreground">{mod.description}</p>
                    </div>
                    <Switch
                      checked={active}
                      onCheckedChange={() => toggleModule(mod.key, active)}
                      disabled={!can('module.enable')}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
