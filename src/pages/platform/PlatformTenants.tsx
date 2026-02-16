/**
 * /platform/tenants — Full tenant management page
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { platformEvents } from '@/domains/platform/platform-events';
import { PLATFORM_MODULES, type ModuleKey } from '@/domains/platform/platform-modules';
import { dualIdentityEngine } from '@/domains/security/kernel/dual-identity-engine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Building2, Plus, Search, Ban, CheckCircle, Eye, Puzzle, Package,
  Loader2, MoreHorizontal, Users, Calendar, UserCog, Shield, Clock,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { PlanBadge } from '@/components/shared/PlanBadge';

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

interface SaasPlanOption {
  id: string;
  name: string;
  price: number;
  billing_cycle: string;
}

type DialogMode = 'create' | 'view' | 'modules' | 'impersonate' | null;

export default function PlatformTenants() {
  const { can } = usePlatformPermissions();
  const { identity: platformIdentity } = usePlatformIdentity();
  const { user } = useAuth();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [form, setForm] = useState({ name: '', document: '', email: '', phone: '', adminEmail: '', adminName: '', planId: '' });

  // Available plans
  const [availablePlans, setAvailablePlans] = useState<SaasPlanOption[]>([]);
  useEffect(() => {
    supabase
      .from('saas_plans')
      .select('id, name, price, billing_cycle')
      .eq('is_active', true)
      .order('price', { ascending: true })
      .then(({ data }) => setAvailablePlans((data ?? []) as SaasPlanOption[]));
  }, []);

  // Modules
  const [tenantModules, setTenantModules] = useState<TenantModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);

  // ── Tenant → Plan mapping ──
  const [tenantPlanMap, setTenantPlanMap] = useState<Record<string, { planName: string; tier: string }>>({});

  useEffect(() => {
    supabase
      .from('tenant_plans')
      .select('tenant_id, status, saas_plans(name, price)')
      .eq('status', 'active')
      .then(({ data }) => {
        const map: Record<string, { planName: string; tier: string }> = {};
        ((data ?? []) as any[]).forEach(row => {
          const price = row.saas_plans?.price ?? 0;
          const name = row.saas_plans?.name ?? 'Free';
          map[row.tenant_id] = {
            planName: name,
            tier: price === 0 ? 'free' : price <= 199 ? 'starter' : price <= 499 ? 'pro' : 'enterprise',
          };
        });
        setTenantPlanMap(map);
      });
  }, []);

  // Impersonation
  const [impersonateReason, setImpersonateReason] = useState('');
  const [impersonateDuration, setImpersonateDuration] = useState(30);
  const [impersonating, setImpersonating] = useState(false);

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

  // ── Create Tenant (atomic: tenant + role + first admin + plan assignment) ──
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

      // ── PXE: Assign plan → triggers module sync + experience profile ──
      if (tenantId && form.planId) {
        const { error: planError } = await supabase
          .from('tenant_plans')
          .insert({
            tenant_id: tenantId,
            plan_id: form.planId,
            status: 'active',
            billing_cycle: availablePlans.find(p => p.id === form.planId)?.billing_cycle ?? 'monthly',
          });
        if (planError) {
          console.error('[PXE] Plan assignment error:', planError);
          toast({ title: 'Aviso', description: 'Tenant criado mas houve erro ao vincular o plano.', variant: 'destructive' });
        } else {
          const selectedPlan = availablePlans.find(p => p.id === form.planId);
          platformEvents.planAssignedToTenant(user?.id ?? '', tenantId, {
            planId: form.planId,
            planName: selectedPlan?.name ?? '',
            tier: selectedPlan?.name?.toLowerCase() ?? 'free',
            billingCycle: selectedPlan?.billing_cycle ?? 'monthly',
          });
        }
      }

      platformEvents.tenantCreated(user?.id ?? '', tenantId, form.name.trim());
      toast({ title: 'Tenant criado', description: `${form.name} criado com plano, módulos e role TenantAdmin.` });
      setForm({ name: '', document: '', email: '', phone: '', adminEmail: '', adminName: '', planId: '' });
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

  // ── Impersonation ──
  const openImpersonate = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setImpersonateReason('');
    setImpersonateDuration(30);
    setDialogMode('impersonate');
  };

  const handleStartImpersonation = async () => {
    if (!selectedTenant || !user || !platformIdentity) return;
    setImpersonating(true);

    // 1. Set real identity on the engine
    dualIdentityEngine.setRealIdentity({
      userId: user.id,
      email: user.email ?? null,
      userType: 'platform',
      platformRole: platformIdentity.role,
      authenticatedAt: Date.now(),
    });

    // 2. Start impersonation (validates permissions internally)
    const result = dualIdentityEngine.startImpersonation({
      targetTenantId: selectedTenant.id,
      targetTenantName: selectedTenant.name,
      reason: impersonateReason.trim(),
      maxDurationMinutes: impersonateDuration,
    });

    if (!result.success) {
      toast({ title: 'Impersonação negada', description: result.reason, variant: 'destructive' });
      setImpersonating(false);
      return;
    }

    // 3. Persist to DB
    const expiresAt = new Date(Date.now() + impersonateDuration * 60_000).toISOString();
    const { error: dbError } = await supabase
      .from('impersonation_sessions')
      .insert({
        platform_user_id: user.id,
        tenant_id: selectedTenant.id,
        reason: impersonateReason.trim(),
        expires_at: expiresAt,
        status: 'active',
        simulated_role: 'tenant_admin',
        metadata: {
          session_id: result.session?.id,
          platform_role: platformIdentity.role,
        },
      } as any);

    if (dbError) {
      console.warn('[Impersonation] DB persist failed:', dbError.message);
    }

    toast({
      title: 'Impersonação iniciada',
      description: `Operando como TenantAdmin em ${selectedTenant.name}. Expira em ${impersonateDuration} min.`,
    });

    setDialogMode(null);
    setImpersonating(false);

    // 4. Navigate to tenant dashboard
    window.location.href = '/';
  };

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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Users className="h-4 w-4 text-muted-foreground" />
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
                  <TableHead>Plano</TableHead>
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
                    <TableCell>
                      {tenantPlanMap[tenant.id] ? (
                        <PlanBadge
                          tier={tenantPlanMap[tenant.id].tier}
                          planName={tenantPlanMap[tenant.id].planName}
                          size="sm"
                        />
                      ) : (
                        <PlanBadge tier="free" size="sm" />
                      )}
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
                          {can('tenant.impersonate') && tenant.status === 'active' && (
                            <DropdownMenuItem onClick={() => openImpersonate(tenant)}>
                              <UserCog className="h-4 w-4 mr-2" /> Entrar como Tenant
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

            {/* Plan selection */}
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Plano SaaS
              </p>
              <div className="grid gap-2">
                {availablePlans.map(plan => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, planId: plan.id }))}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
                      form.planId === plan.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <span className="font-medium">{plan.name}</span>
                    <span className="text-xs">
                      R$ {plan.price.toFixed(2).replace('.', ',')} /{plan.billing_cycle === 'monthly' ? 'mês' : 'ano'}
                    </span>
                  </button>
                ))}
                {availablePlans.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Nenhum plano ativo cadastrado.</p>
                )}
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

      {/* ═══ Impersonate Tenant Dialog ═══ */}
      <Dialog open={dialogMode === 'impersonate'} onOpenChange={open => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              Entrar como Tenant
            </DialogTitle>
            <DialogDescription>
              Você irá operar como <span className="font-semibold text-foreground">TenantAdmin</span> no ambiente de{' '}
              <span className="font-semibold text-foreground">{selectedTenant?.name}</span>.
              Todas as ações serão auditadas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Warning banner */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Shield className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Impersonação controlada</p>
                <ul className="space-y-0.5">
                  <li>• Sua identidade real será preservada</li>
                  <li>• Todas as operações serão tagueadas no audit trail</li>
                  <li>• A sessão expira automaticamente</li>
                </ul>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Motivo da impersonação *
              </Label>
              <Textarea
                value={impersonateReason}
                onChange={e => setImpersonateReason(e.target.value)}
                placeholder="Ex: Investigação de ticket #1234 — usuário reportou erro na folha"
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Duração (minutos)
              </Label>
              <div className="flex items-center gap-3">
                {[15, 30, 60, 120].map(min => (
                  <Button
                    key={min}
                    size="sm"
                    variant={impersonateDuration === min ? 'default' : 'outline'}
                    onClick={() => setImpersonateDuration(min)}
                    className="flex-1"
                  >
                    {min}m
                  </Button>
                ))}
              </div>
            </div>

            {/* Session info */}
            <div className="rounded-lg border border-border/60 p-3 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Identidade real</span>
                <span className="font-mono text-foreground">{user?.email}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Role de plataforma</span>
                <Badge variant="outline" className="text-[10px] h-5">{platformIdentity?.role}</Badge>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tenant alvo</span>
                <span className="font-medium text-foreground">{selectedTenant?.name}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Role simulada</span>
                <Badge variant="outline" className="text-[10px] h-5 bg-amber-500/10 text-amber-600 border-amber-500/30">tenant_admin</Badge>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>Cancelar</Button>
            <Button
              onClick={handleStartImpersonation}
              disabled={impersonating || !impersonateReason.trim()}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {impersonating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserCog className="h-4 w-4" />
              )}
              Iniciar Impersonação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
