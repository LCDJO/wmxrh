/**
 * /platform/tenants — Full tenant management page with CRUD
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { platformEvents } from '@/domains/platform/platform-events';
import { PLATFORM_MODULES } from '@/domains/platform/platform-modules';
import { dualIdentityEngine } from '@/domains/security/kernel/dual-identity-engine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Building2, Plus, Search, Ban, CheckCircle, Eye, Puzzle, Package,
  Loader2, MoreHorizontal, Users, Calendar, UserCog, Shield, Clock,
  Pencil, ArrowRightLeft, Trash2, Mail, Phone, FileText, MapPin,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { PlanBadge } from '@/components/shared/PlanBadge';

interface Tenant {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  created_at: string;
  updated_at: string;
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
  allowed_modules: string[];
}

interface TenantPlanRow {
  id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  started_at: string;
  expires_at: string | null;
  trial_ends_at: string | null;
  next_billing_date: string | null;
  payment_method: string | null;
}

type DialogMode = 'create' | 'view' | 'edit' | 'change-plan' | 'modules' | 'impersonate' | null;

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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);

  // Create form
  const [form, setForm] = useState({ name: '', document: '', email: '', phone: '', address: '', adminEmail: '', adminName: '', planId: '' });

  // Edit form
  const [editForm, setEditForm] = useState({ name: '', document: '', email: '', phone: '', address: '', status: '' });

  // Available plans
  const [availablePlans, setAvailablePlans] = useState<SaasPlanOption[]>([]);
  useEffect(() => {
    supabase
      .from('saas_plans')
      .select('id, name, price, billing_cycle, allowed_modules')
      .eq('is_active', true)
      .order('price', { ascending: true })
      .then(({ data }) => setAvailablePlans((data ?? []) as SaasPlanOption[]));
  }, []);

  // Modules
  const [tenantModules, setTenantModules] = useState<TenantModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);

  // Tenant plan data
  const [tenantPlanMap, setTenantPlanMap] = useState<Record<string, { planId: string; planName: string; tier: string; status: string; billingCycle: string }>>({});
  const [selectedTenantPlan, setSelectedTenantPlan] = useState<TenantPlanRow | null>(null);

  // Plan change form
  const [newPlanId, setNewPlanId] = useState('');
  const [newBillingCycle, setNewBillingCycle] = useState('monthly');

  // Membership count per tenant
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  const fetchTenantPlans = useCallback(async () => {
    const { data } = await supabase
      .from('tenant_plans')
      .select('tenant_id, plan_id, status, billing_cycle, saas_plans(name, price)')
      .in('status', ['active', 'trial']);
    const map: Record<string, { planId: string; planName: string; tier: string; status: string; billingCycle: string }> = {};
    ((data ?? []) as any[]).forEach(row => {
      const price = row.saas_plans?.price ?? 0;
      const name = row.saas_plans?.name ?? 'Free';
      map[row.tenant_id] = {
        planId: row.plan_id,
        planName: name,
        tier: price === 0 ? 'free' : price <= 199 ? 'starter' : price <= 499 ? 'pro' : 'enterprise',
        status: row.status,
        billingCycle: row.billing_cycle,
      };
    });
    setTenantPlanMap(map);
  }, []);

  // Impersonation
  const [impersonateReason, setImpersonateReason] = useState('');
  const [impersonateDuration, setImpersonateDuration] = useState(30);
  const [impersonating, setImpersonating] = useState(false);

  const fetchTenants = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tenants')
      .select('id, name, document, email, phone, address, status, created_at, updated_at')
      .order('created_at', { ascending: false });
    setTenants((data as Tenant[]) ?? []);
    setLoading(false);
  };

  const fetchMemberCounts = async () => {
    const { data } = await supabase
      .from('tenant_memberships')
      .select('tenant_id');
    if (data) {
      const counts: Record<string, number> = {};
      (data as any[]).forEach(row => {
        counts[row.tenant_id] = (counts[row.tenant_id] || 0) + 1;
      });
      setMemberCounts(counts);
    }
  };

  useEffect(() => {
    fetchTenants();
    fetchTenantPlans();
    fetchMemberCounts();
  }, [fetchTenantPlans]);

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.document?.includes(search) ||
    t.email?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Create Tenant ──
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

      // Update address if provided
      if (tenantId && form.address.trim()) {
        await supabase.from('tenants').update({ address: form.address.trim() }).eq('id', tenantId);
      }

      // Assign plan
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
      toast({ title: 'Tenant criado', description: `${form.name} criado com sucesso.` });
      setForm({ name: '', document: '', email: '', phone: '', address: '', adminEmail: '', adminName: '', planId: '' });
      setDialogMode(null);
      fetchTenants();
      fetchTenantPlans();
      fetchMemberCounts();
    }
    setSaving(false);
  };

  // ── Edit Tenant ──
  const openEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setEditForm({
      name: tenant.name,
      document: tenant.document ?? '',
      email: tenant.email ?? '',
      phone: tenant.phone ?? '',
      address: tenant.address ?? '',
      status: tenant.status,
    });
    setDialogMode('edit');
  };

  const handleSaveEdit = async () => {
    if (!selectedTenant || !editForm.name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('tenants')
      .update({
        name: editForm.name.trim(),
        document: editForm.document.trim() || null,
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        address: editForm.address.trim() || null,
        status: editForm.status,
      })
      .eq('id', selectedTenant.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Tenant atualizado', description: `${editForm.name} salvo com sucesso.` });
      setDialogMode(null);
      fetchTenants();
    }
    setSaving(false);
  };

  // ── Change Plan ──
  const openChangePlan = async (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDialogMode('change-plan');

    // Load current plan details
    const { data } = await supabase
      .from('tenant_plans')
      .select('*')
      .eq('tenant_id', tenant.id)
      .in('status', ['active', 'trial'])
      .maybeSingle();

    setSelectedTenantPlan((data as TenantPlanRow) ?? null);
    setNewPlanId(data?.plan_id ?? '');
    setNewBillingCycle(data?.billing_cycle ?? 'monthly');
  };

  const handleChangePlan = async () => {
    if (!selectedTenant || !newPlanId) return;
    setSaving(true);

    // Deactivate current plan
    if (selectedTenantPlan) {
      await supabase
        .from('tenant_plans')
        .update({ status: 'cancelled' })
        .eq('id', selectedTenantPlan.id);
    }

    // Create new plan assignment
    const { error } = await supabase
      .from('tenant_plans')
      .insert({
        tenant_id: selectedTenant.id,
        plan_id: newPlanId,
        status: 'active',
        billing_cycle: newBillingCycle,
      });

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      const plan = availablePlans.find(p => p.id === newPlanId);
      platformEvents.planAssignedToTenant(user?.id ?? '', selectedTenant.id, {
        planId: newPlanId,
        planName: plan?.name ?? '',
        tier: plan?.name?.toLowerCase() ?? 'free',
        billingCycle: newBillingCycle,
      });
      toast({ title: 'Plano alterado', description: `${selectedTenant.name} agora está no plano ${plan?.name}.` });
      setDialogMode(null);
      fetchTenantPlans();
    }
    setSaving(false);
  };

  // ── Delete Tenant ──
  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;
    setSaving(true);

    // Soft delete - mark as inactive
    const { error } = await supabase
      .from('tenants')
      .update({ status: 'deleted' })
      .eq('id', tenantToDelete.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      // Also cancel any active plans
      await supabase
        .from('tenant_plans')
        .update({ status: 'cancelled' })
        .eq('tenant_id', tenantToDelete.id)
        .in('status', ['active', 'trial']);

      toast({ title: 'Tenant removido', description: `${tenantToDelete.name} foi desativado.` });
      fetchTenants();
      fetchTenantPlans();
    }
    setDeleteConfirmOpen(false);
    setTenantToDelete(null);
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

    dualIdentityEngine.setRealIdentity({
      userId: user.id,
      email: user.email ?? null,
      userType: 'platform',
      platformRole: platformIdentity.role,
      authenticatedAt: Date.now(),
    });

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

    const expiresAt = new Date(Date.now() + impersonateDuration * 60_000).toISOString();
    await supabase
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

    toast({
      title: 'Impersonação iniciada',
      description: `Operando como TenantAdmin em ${selectedTenant.name}. Expira em ${impersonateDuration} min.`,
    });

    setDialogMode(null);
    setImpersonating(false);
    window.location.href = '/';
  };

  // ── View Details ──
  const openView = async (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDialogMode('view');

    const { data } = await supabase
      .from('tenant_plans')
      .select('*')
      .eq('tenant_id', tenant.id)
      .in('status', ['active', 'trial'])
      .maybeSingle();
    setSelectedTenantPlan((data as TenantPlanRow) ?? null);
  };

  const statusBadge = (status: string) => {
    if (status === 'active') return <Badge variant="default" className="bg-primary/10 text-primary border-0">Ativo</Badge>;
    if (status === 'suspended') return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-0">Suspenso</Badge>;
    if (status === 'deleted') return <Badge variant="secondary" className="bg-muted text-muted-foreground border-0">Removido</Badge>;
    if (status === 'trial') return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-0">Trial</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const planStatusBadge = (status: string) => {
    if (status === 'active') return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-0">Ativo</Badge>;
    if (status === 'trial') return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-0">Trial</Badge>;
    if (status === 'cancelled') return <Badge variant="secondary" className="bg-muted text-muted-foreground border-0">Cancelado</Badge>;
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
      <div className="grid gap-4 sm:grid-cols-4">
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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">
                {Object.values(tenantPlanMap).filter(p => p.status === 'trial').length}
              </p>
              <p className="text-xs text-muted-foreground">Em trial</p>
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
                  <TableHead>Membros</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(tenant => (
                  <TableRow key={tenant.id} className={tenant.status === 'deleted' ? 'opacity-50' : ''}>
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
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{memberCounts[tenant.id] ?? 0}</span>
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
                          <DropdownMenuItem onClick={() => openView(tenant)}>
                            <Eye className="h-4 w-4 mr-2" /> Ver detalhes
                          </DropdownMenuItem>
                          {can('tenant.create') && tenant.status !== 'deleted' && (
                            <DropdownMenuItem onClick={() => openEdit(tenant)}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar dados
                            </DropdownMenuItem>
                          )}
                          {can('tenant.create') && tenant.status !== 'deleted' && (
                            <DropdownMenuItem onClick={() => openChangePlan(tenant)}>
                              <ArrowRightLeft className="h-4 w-4 mr-2" /> Trocar plano
                            </DropdownMenuItem>
                          )}
                          {can('module.enable') && tenant.status !== 'deleted' && (
                            <DropdownMenuItem onClick={() => openModules(tenant)}>
                              <Puzzle className="h-4 w-4 mr-2" /> Módulos
                            </DropdownMenuItem>
                          )}
                          {can('support.impersonate') && tenant.status === 'active' && (
                            <DropdownMenuItem onClick={() => openImpersonate(tenant)}>
                              <UserCog className="h-4 w-4 mr-2" /> Entrar como Tenant
                            </DropdownMenuItem>
                          )}
                          {can('tenant.suspend') && tenant.status !== 'deleted' && (
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
                          {can('tenant.suspend') && tenant.status !== 'deleted' && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                setTenantToDelete(tenant);
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Remover tenant
                            </DropdownMenuItem>
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
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@empresa.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Telefone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 0000-0000" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Endereço</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Rua, número, cidade - UF" />
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
                      {plan.price === 0 ? 'Gratuito' : `R$ ${plan.price.toFixed(2).replace('.', ',')} /${plan.billing_cycle === 'monthly' ? 'mês' : 'ano'}`}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {selectedTenant?.name}
              {selectedTenant && statusBadge(selectedTenant.status)}
            </DialogTitle>
            <DialogDescription>Detalhes completos do tenant</DialogDescription>
          </DialogHeader>
          {selectedTenant && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="plan">Plano & Assinatura</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-3 pt-2 text-sm">
                <div className="grid gap-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="font-mono">{selectedTenant.document || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span>{selectedTenant.email || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>{selectedTenant.phone || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{selectedTenant.address || '—'}</span>
                  </div>
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Membros</span>
                    <span className="font-medium text-foreground">{memberCounts[selectedTenant.id] ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Criado em</span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(selectedTenant.created_at), 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>ID</span>
                    <span className="font-mono text-xs">{selectedTenant.id.slice(0, 12)}…</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="plan" className="space-y-3 pt-2 text-sm">
                {tenantPlanMap[selectedTenant.id] ? (
                  <>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                      <div>
                        <p className="font-medium text-foreground">{tenantPlanMap[selectedTenant.id].planName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{tenantPlanMap[selectedTenant.id].billingCycle}</p>
                      </div>
                      <PlanBadge tier={tenantPlanMap[selectedTenant.id].tier} size="sm" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Status assinatura</span>
                        {planStatusBadge(tenantPlanMap[selectedTenant.id].status)}
                      </div>
                      {selectedTenantPlan?.started_at && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Início</span>
                          <span>{format(new Date(selectedTenantPlan.started_at), 'dd/MM/yyyy')}</span>
                        </div>
                      )}
                      {selectedTenantPlan?.next_billing_date && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Próxima cobrança</span>
                          <span>{format(new Date(selectedTenantPlan.next_billing_date), 'dd/MM/yyyy')}</span>
                        </div>
                      )}
                      {selectedTenantPlan?.trial_ends_at && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Trial até</span>
                          <span>{format(new Date(selectedTenantPlan.trial_ends_at), 'dd/MM/yyyy')}</span>
                        </div>
                      )}
                      {selectedTenantPlan?.payment_method && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Meio de pagamento</span>
                          <span className="capitalize">{selectedTenantPlan.payment_method}</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <PlanBadge tier="free" size="sm" />
                    <p className="text-xs text-muted-foreground mt-2">Sem plano ativo vinculado</p>
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => {
                      setDialogMode(null);
                      setTimeout(() => openChangePlan(selectedTenant), 150);
                    }}
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Alterar plano
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Tenant Dialog ═══ */}
      <Dialog open={dialogMode === 'edit'} onOpenChange={open => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Editar Tenant
            </DialogTitle>
            <DialogDescription>Atualize os dados cadastrais de {selectedTenant?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nome da empresa *</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">CNPJ</Label>
              <Input value={editForm.document} onChange={e => setEditForm(f => ({ ...f, document: e.target.value }))} placeholder="00.000.000/0000-00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Telefone</Label>
                <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Endereço</Label>
              <Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} placeholder="Rua, número, cidade - UF" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editForm.name.trim()} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Change Plan Dialog ═══ */}
      <Dialog open={dialogMode === 'change-plan'} onOpenChange={open => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Trocar Plano
            </DialogTitle>
            <DialogDescription>
              Altere o plano de {selectedTenant?.name}.
              {selectedTenantPlan && (
                <span className="block mt-1">
                  Plano atual: <strong>{availablePlans.find(p => p.id === selectedTenantPlan.plan_id)?.name ?? 'Desconhecido'}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Novo plano</Label>
              <div className="grid gap-2">
                {availablePlans.map(plan => {
                  const isCurrent = plan.id === selectedTenantPlan?.plan_id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setNewPlanId(plan.id)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
                        newPlanId === plan.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{plan.name}</span>
                        {isCurrent && <Badge variant="outline" className="text-[10px] h-5">Atual</Badge>}
                      </div>
                      <span className="text-xs">
                        {plan.price === 0 ? 'Gratuito' : `R$ ${plan.price.toFixed(2).replace('.', ',')} /mês`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ciclo de cobrança</Label>
              <Select value={newBillingCycle} onValueChange={setNewBillingCycle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Modules preview */}
            {newPlanId && (
              <div className="border-t border-border pt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Módulos inclusos</p>
                <div className="flex flex-wrap gap-1.5">
                  {(availablePlans.find(p => p.id === newPlanId)?.allowed_modules ?? []).map(mod => (
                    <Badge key={mod} variant="secondary" className="text-[10px]">
                      {PLATFORM_MODULES.find(m => m.key === mod)?.label ?? mod}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>Cancelar</Button>
            <Button
              onClick={handleChangePlan}
              disabled={saving || !newPlanId || newPlanId === selectedTenantPlan?.plan_id}
              className="gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              Confirmar troca
            </Button>
          </DialogFooter>
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

      {/* ═══ Delete Confirmation ═══ */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tenant?</AlertDialogTitle>
            <AlertDialogDescription>
              O tenant <strong>{tenantToDelete?.name}</strong> será desativado e todos os planos ativos serão cancelados.
              Esta ação pode ser revertida reativando o tenant posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTenant}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
