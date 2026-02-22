/**
 * /platform/tenants — Full tenant management page with CRUD + detailed analytics
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Building2, Plus, Search, Ban, CheckCircle, Eye, Puzzle, Package,
  Loader2, MoreHorizontal, Users, Calendar, UserCog, Shield, Clock,
  Pencil, ArrowRightLeft, Trash2, Mail, Phone, FileText, MapPin,
  Receipt, Headphones, BarChart3, CreditCard, TrendingUp, AlertTriangle,
  DollarSign, Activity, RotateCcw,
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

// ── Types ──

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

interface TenantDetails {
  usage: {
    employees: number;
    companies: number;
    members: number;
    active_modules: number;
    total_modules: number;
    modules: { module_key: string; is_active: boolean; activated_at: string }[];
  };
  plan: {
    plan_id: string;
    plan_name: string;
    plan_price: number;
    status: string;
    billing_cycle: string;
    started_at: string;
    next_billing_date: string | null;
    trial_ends_at: string | null;
    payment_method: string | null;
  } | null;
  invoices: {
    summary: {
      total: number;
      paid: number;
      pending: number;
      overdue: number;
      total_billed: number;
      total_paid: number;
    };
    recent: {
      id: string;
      total_amount: number;
      status: string;
      due_date: string;
      paid_at: string | null;
      billing_period_start: string;
      billing_period_end: string;
      notes: string | null;
      created_at: string;
    }[];
  };
  financial_entries: {
    id: string;
    entry_type: string;
    amount: number;
    description: string;
    created_at: string;
  }[];
  support: {
    total_sessions: number;
    resolved: number;
    by_month: Record<string, { total: number; resolved: number; pending: number }>;
    by_priority: Record<string, number>;
  };
  memberships: { id: string; role: string; user_id: string }[];
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

  // Plan change form
  const [newPlanId, setNewPlanId] = useState('');
  const [newBillingCycle, setNewBillingCycle] = useState('monthly');
  const [selectedTenantPlan, setSelectedTenantPlan] = useState<TenantPlanRow | null>(null);

  // Member counts
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  // Tenant detail data (from edge function)
  const [tenantDetails, setTenantDetails] = useState<TenantDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Impersonation
  const [impersonateReason, setImpersonateReason] = useState('');
  const [impersonateDuration, setImpersonateDuration] = useState(30);
  const [impersonating, setImpersonating] = useState(false);

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
    const { data } = await supabase.from('tenant_memberships').select('tenant_id');
    if (data) {
      const counts: Record<string, number> = {};
      (data as any[]).forEach(row => { counts[row.tenant_id] = (counts[row.tenant_id] || 0) + 1; });
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

  // ── Fetch tenant details via edge function ──
  const fetchTenantDetails = async (tenantId: string) => {
    setDetailsLoading(true);
    setTenantDetails(null);
    try {
      const { data, error } = await supabase.functions.invoke('tenant-details', {
        body: undefined,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      // The edge function uses query params, so we need the full URL approach
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/tenant-details?tenant_id=${tenantId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (res.ok) {
        const json = await res.json();
        setTenantDetails(json);
      }
    } catch (e) {
      console.error('[tenant-details] fetch error:', e);
    }
    setDetailsLoading(false);
  };

  // ── Create Tenant ──
  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.rpc('platform_create_tenant', {
      p_name: form.name.trim(),
      p_document: form.document.trim() || undefined,
      p_email: form.email.trim() || undefined,
      p_phone: form.phone.trim() || undefined,
      p_admin_email: form.adminEmail.trim() || undefined,
      p_admin_name: form.adminName.trim() || undefined,
    });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      const tenantId = typeof data === 'object' && data !== null ? (data as any).tenant_id : '';
      if (tenantId && form.address.trim()) {
        await supabase.from('tenants').update({ address: form.address.trim() }).eq('id', tenantId);
      }
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
          toast({ title: 'Aviso', description: 'Cliente criado mas houve erro ao vincular o plano.', variant: 'destructive' });
        } else {
          const selectedPlan = availablePlans.find(p => p.id === form.planId);
          platformEvents.planAssignedToTenant(user?.id ?? '', tenantId, {
            planId: form.planId, planName: selectedPlan?.name ?? '',
            tier: selectedPlan?.name?.toLowerCase() ?? 'free', billingCycle: selectedPlan?.billing_cycle ?? 'monthly',
          });
        }
      }
      platformEvents.tenantCreated(user?.id ?? '', tenantId, form.name.trim());
      toast({ title: 'Cliente criado', description: `${form.name} criado com sucesso.` });
      setForm({ name: '', document: '', email: '', phone: '', address: '', adminEmail: '', adminName: '', planId: '' });
      setDialogMode(null);
      fetchTenants(); fetchTenantPlans(); fetchMemberCounts();
    }
    setSaving(false);
  };

  // ── Edit Tenant ──
  const openEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setEditForm({ name: tenant.name, document: tenant.document ?? '', email: tenant.email ?? '', phone: tenant.phone ?? '', address: tenant.address ?? '', status: tenant.status });
    setDialogMode('edit');
  };

  const handleSaveEdit = async () => {
    if (!selectedTenant || !editForm.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('tenants').update({
      name: editForm.name.trim(), document: editForm.document.trim() || null,
      email: editForm.email.trim() || null, phone: editForm.phone.trim() || null,
      address: editForm.address.trim() || null, status: editForm.status,
    }).eq('id', selectedTenant.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Tenant atualizado' });
      setDialogMode(null); fetchTenants();
    }
    setSaving(false);
  };

  // ── Change Plan ──
  const openChangePlan = async (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDialogMode('change-plan');
    const { data } = await supabase.from('tenant_plans').select('*')
      .eq('tenant_id', tenant.id).in('status', ['active', 'trial']).maybeSingle();
    setSelectedTenantPlan((data as TenantPlanRow) ?? null);
    setNewPlanId(data?.plan_id ?? '');
    setNewBillingCycle(data?.billing_cycle ?? 'monthly');
  };

  const handleChangePlan = async () => {
    if (!selectedTenant || !newPlanId) return;
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('No session');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/change-tenant-plan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            tenant_id: selectedTenant.id,
            plan_id: newPlanId,
            billing_cycle: newBillingCycle,
            reason: 'Plan change via admin panel',
          }),
        }
      );

      const result = await res.json();

      if (!res.ok || !result.success) {
        toast({ title: 'Erro', description: result.error?.message ?? 'Falha ao trocar plano', variant: 'destructive' });
      } else {
        const d = result.data;
        platformEvents.planAssignedToTenant(user?.id ?? '', selectedTenant.id, {
          planId: newPlanId, planName: d.new_plan.name, tier: d.new_plan.name?.toLowerCase() ?? 'free', billingCycle: newBillingCycle,
        });
        toast({
          title: 'Plano alterado com sucesso',
          description: `${d.previous_plan?.name ?? 'Nenhum'} → ${d.new_plan.name}${d.proration.amount > 0 ? ` | Proration: R$${d.proration.amount.toFixed(2)}` : ''}`,
        });
        setDialogMode(null); fetchTenantPlans();
      }
    } catch (err: unknown) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
    setSaving(false);
  };

  // ── Delete Tenant (soft — pending_deletion) ──
  const [retentionDays, setRetentionDays] = useState(30);
  useEffect(() => {
    supabase.from('platform_settings').select('value').eq('key', 'tenant_deletion_retention_days').single()
      .then(({ data }) => { if (data?.value) setRetentionDays(Number(data.value)); });
  }, []);

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;
    setSaving(true);
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + retentionDays);
    const { error } = await supabase.from('tenants').update({
      status: 'pending_deletion',
      scheduled_deletion_at: scheduledDate.toISOString(),
    } as any).eq('id', tenantToDelete.id);
    if (!error) {
      toast({ title: 'Tenant marcado para deleção', description: `Será removido em ${retentionDays} dias (${scheduledDate.toLocaleDateString('pt-BR')}).` });
      fetchTenants(); fetchTenantPlans();
    } else {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
    setDeleteConfirmOpen(false); setTenantToDelete(null); setSaving(false);
  };

  // ── Suspend / Activate ──
  const handleToggleStatus = async (tenant: Tenant) => {
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active';
    const { error } = await supabase.from('tenants').update({ status: newStatus }).eq('id', tenant.id);
    if (!error) {
      if (newStatus === 'suspended') platformEvents.tenantSuspended(user?.id ?? '', tenant.id, tenant.name);
      else platformEvents.tenantReactivated(user?.id ?? '', tenant.id, tenant.name);
      toast({ title: newStatus === 'suspended' ? 'Tenant suspenso' : 'Tenant reativado' });
      fetchTenants();
    }
  };

  // ── Modules ──
  const openModules = async (tenant: Tenant) => {
    setSelectedTenant(tenant); setDialogMode('modules'); setModulesLoading(true);
    const { data } = await supabase.from('tenant_modules').select('id, tenant_id, module_key, is_active').eq('tenant_id', tenant.id);
    setTenantModules((data as TenantModule[]) ?? []); setModulesLoading(false);
  };

  const toggleModule = async (moduleKey: string, currentlyActive: boolean) => {
    if (!selectedTenant) return;
    const existing = tenantModules.find(m => m.module_key === moduleKey);
    if (existing) {
      await supabase.from('tenant_modules').update({ is_active: !currentlyActive, deactivated_at: currentlyActive ? new Date().toISOString() : null }).eq('id', existing.id);
    } else {
      await supabase.from('tenant_modules').insert({ tenant_id: selectedTenant.id, module_key: moduleKey, is_active: true });
    }
    const { data } = await supabase.from('tenant_modules').select('id, tenant_id, module_key, is_active').eq('tenant_id', selectedTenant.id);
    setTenantModules((data as TenantModule[]) ?? []);
  };

  const isModuleActive = (key: string) => tenantModules.find(m => m.module_key === key)?.is_active ?? false;

  // ── View Details ──
  const openView = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDialogMode('view');
    fetchTenantDetails(tenant.id);
  };

  // ── Impersonation ──
  const openImpersonate = (tenant: Tenant) => {
    setSelectedTenant(tenant); setImpersonateReason(''); setImpersonateDuration(30); setDialogMode('impersonate');
  };

  const handleStartImpersonation = async () => {
    if (!selectedTenant || !user || !platformIdentity) return;
    setImpersonating(true);
    dualIdentityEngine.setRealIdentity({
      userId: user.id, email: user.email ?? null, userType: 'platform',
      platformRole: platformIdentity.role, authenticatedAt: Date.now(),
    });
    const result = dualIdentityEngine.startImpersonation({
      targetTenantId: selectedTenant.id, targetTenantName: selectedTenant.name,
      reason: impersonateReason.trim(), maxDurationMinutes: impersonateDuration,
    });
    if (!result.success) {
      toast({ title: 'Impersonação negada', description: result.reason, variant: 'destructive' });
      setImpersonating(false); return;
    }
    const expiresAt = new Date(Date.now() + impersonateDuration * 60_000).toISOString();
    await supabase.from('impersonation_sessions').insert({
      platform_user_id: user.id, tenant_id: selectedTenant.id, reason: impersonateReason.trim(),
      expires_at: expiresAt, status: 'active', simulated_role: 'tenant_admin',
      metadata: { session_id: result.session?.id, platform_role: platformIdentity.role },
    } as any);
    toast({ title: 'Impersonação iniciada', description: `Operando como TenantAdmin em ${selectedTenant.name}. Expira em ${impersonateDuration} min.` });
    setDialogMode(null); setImpersonating(false);
    window.location.href = '/';
  };

  // ── Helpers ──
  const statusBadge = (status: string) => {
    if (status === 'active') return <Badge variant="default" className="bg-primary/10 text-primary border-0">Ativo</Badge>;
    if (status === 'suspended') return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-0">Suspenso</Badge>;
    if (status === 'pending_deletion') return <Badge className="bg-orange-500/10 text-orange-600 border-0">Aguardando Deleção</Badge>;
    if (status === 'deleted') return <Badge variant="secondary" className="bg-muted text-muted-foreground border-0">Removido</Badge>;
    if (status === 'trial') return <Badge className="bg-amber-500/10 text-amber-600 border-0">Trial</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const invoiceStatusBadge = (status: string) => {
    if (status === 'paid') return <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px]">Pago</Badge>;
    if (status === 'pending') return <Badge className="bg-amber-500/10 text-amber-600 border-0 text-[10px]">Pendente</Badge>;
    if (status === 'overdue') return <Badge className="bg-destructive/10 text-destructive border-0 text-[10px]">Vencida</Badge>;
    return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  };

  const formatBRL = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Clientes</h1>
            <p className="text-sm text-muted-foreground">{tenants.length} empresa{tenants.length !== 1 ? 's' : ''} cadastrada{tenants.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {can('tenant.create') && (
          <Button onClick={() => setDialogMode('create')} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Cliente
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { icon: Building2, label: 'Ativos', count: tenants.filter(t => t.status === 'active').length, color: 'bg-primary/10 text-primary' },
          { icon: Clock, label: 'Em trial', count: Object.values(tenantPlanMap).filter(p => p.status === 'trial').length, color: 'bg-amber-500/10 text-amber-500' },
          { icon: Ban, label: 'Suspensos', count: tenants.filter(t => t.status === 'suspended').length, color: 'bg-destructive/10 text-destructive' },
          { icon: Users, label: 'Total', count: tenants.length, color: 'bg-muted text-muted-foreground' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-5 flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.color.split(' ')[0]}`}>
                <s.icon className={`h-4 w-4 ${s.color.split(' ')[1]}`} />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, CNPJ ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
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
                  <TableRow key={tenant.id} className={['deleted', 'pending_deletion'].includes(tenant.status) ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{tenant.document || '—'}</TableCell>
                    <TableCell>
                      {tenantPlanMap[tenant.id]
                        ? <PlanBadge tier={tenantPlanMap[tenant.id].tier} planName={tenantPlanMap[tenant.id].planName} size="sm" />
                        : <PlanBadge tier="free" size="sm" />}
                    </TableCell>
                    <TableCell><span className="text-sm text-muted-foreground">{memberCounts[tenant.id] ?? 0}</span></TableCell>
                    <TableCell>{statusBadge(tenant.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{format(new Date(tenant.created_at), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openView(tenant)}>
                            <Eye className="h-4 w-4 mr-2" /> Ver detalhes
                          </DropdownMenuItem>
                          {can('tenant.create') && !['deleted', 'pending_deletion'].includes(tenant.status) && (
                            <DropdownMenuItem onClick={() => openEdit(tenant)}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar dados
                            </DropdownMenuItem>
                          )}
                          {can('tenant.create') && !['deleted', 'pending_deletion'].includes(tenant.status) && (
                            <DropdownMenuItem onClick={() => openChangePlan(tenant)}>
                              <ArrowRightLeft className="h-4 w-4 mr-2" /> Trocar plano
                            </DropdownMenuItem>
                          )}
                          {can('module.enable') && !['deleted', 'pending_deletion'].includes(tenant.status) && (
                            <DropdownMenuItem onClick={() => openModules(tenant)}>
                              <Puzzle className="h-4 w-4 mr-2" /> Módulos
                            </DropdownMenuItem>
                          )}
                          {can('support.impersonate') && tenant.status === 'active' && (
                            <DropdownMenuItem onClick={() => openImpersonate(tenant)}>
                              <UserCog className="h-4 w-4 mr-2" /> Entrar como Tenant
                            </DropdownMenuItem>
                          )}
                          {can('tenant.suspend') && !['deleted', 'pending_deletion'].includes(tenant.status) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleToggleStatus(tenant)}
                                className={tenant.status === 'active' ? 'text-destructive focus:text-destructive' : 'text-primary focus:text-primary'}>
                                {tenant.status === 'active' ? <><Ban className="h-4 w-4 mr-2" /> Suspender</> : <><CheckCircle className="h-4 w-4 mr-2" /> Reativar</>}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive"
                                onClick={() => { setTenantToDelete(tenant); setDeleteConfirmOpen(true); }}>
                                <Trash2 className="h-4 w-4 mr-2" /> Marcar para deleção
                              </DropdownMenuItem>
                            </>
                          )}
                          {can('tenant.suspend') && tenant.status === 'pending_deletion' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-primary focus:text-primary"
                                onClick={() => handleToggleStatus(tenant)}>
                                <RotateCcw className="h-4 w-4 mr-2" /> Cancelar deleção (Reativar)
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

      {/* ═══ View Tenant Detail Dialog ═══ */}
      <Dialog open={dialogMode === 'view'} onOpenChange={open => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="font-display flex items-center gap-2">
              {selectedTenant?.name}
              {selectedTenant && statusBadge(selectedTenant.status)}
            </DialogTitle>
            <DialogDescription>Painel completo do cliente</DialogDescription>
          </DialogHeader>
          {selectedTenant && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="mx-6 grid w-[calc(100%-3rem)] grid-cols-4">
                <TabsTrigger value="overview" className="text-xs">Visão geral</TabsTrigger>
                <TabsTrigger value="financial" className="text-xs">Financeiro</TabsTrigger>
                <TabsTrigger value="support" className="text-xs">Atendimento</TabsTrigger>
                <TabsTrigger value="usage" className="text-xs">Uso</TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[60vh]">
                {/* ── Overview ── */}
                <TabsContent value="overview" className="px-6 pb-6 space-y-4">
                  {/* Info cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="font-mono">{selectedTenant.document || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 shrink-0" />
                      <span>{selectedTenant.email || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>{selectedTenant.phone || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="truncate">{selectedTenant.address || '—'}</span>
                    </div>
                  </div>

                  {/* Plan card */}
                  {detailsLoading ? (
                    <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : tenantDetails?.plan ? (
                    <Card>
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{tenantDetails.plan.plan_name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{tenantDetails.plan.billing_cycle} · {tenantDetails.plan.status}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold font-display text-foreground">{formatBRL(tenantDetails.plan.plan_price)}</p>
                            <p className="text-xs text-muted-foreground">/mês</p>
                          </div>
                        </div>
                        {tenantDetails.plan.next_billing_date && (
                          <p className="text-xs text-muted-foreground">Próxima cobrança: {format(new Date(tenantDetails.plan.next_billing_date), 'dd/MM/yyyy')}</p>
                        )}
                        {tenantDetails.plan.trial_ends_at && (
                          <p className="text-xs text-amber-600">Trial expira: {format(new Date(tenantDetails.plan.trial_ends_at), 'dd/MM/yyyy')}</p>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <PlanBadge tier="free" size="sm" />
                        <p className="text-xs text-muted-foreground mt-1">Sem plano ativo vinculado</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Usage summary */}
                  {tenantDetails && (
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: 'Empresas', value: tenantDetails.usage.companies, icon: Building2 },
                        { label: 'Funcionários', value: tenantDetails.usage.employees, icon: Users },
                        { label: 'Membros', value: tenantDetails.usage.members, icon: UserCog },
                        { label: 'Módulos', value: `${tenantDetails.usage.active_modules}/${tenantDetails.usage.total_modules}`, icon: Puzzle },
                      ].map(item => (
                        <div key={item.label} className="rounded-lg border border-border p-3 text-center">
                          <item.icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                          <p className="text-lg font-bold font-display">{item.value}</p>
                          <p className="text-[10px] text-muted-foreground">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick actions */}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { setDialogMode(null); setTimeout(() => openEdit(selectedTenant), 150); }}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { setDialogMode(null); setTimeout(() => openChangePlan(selectedTenant), 150); }}>
                      <ArrowRightLeft className="h-3.5 w-3.5" /> Plano
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { setDialogMode(null); setTimeout(() => openModules(selectedTenant), 150); }}>
                      <Puzzle className="h-3.5 w-3.5" /> Módulos
                    </Button>
                  </div>
                </TabsContent>

                {/* ── Financial ── */}
                <TabsContent value="financial" className="px-6 pb-6 space-y-4">
                  {detailsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : tenantDetails ? (
                    <>
                      {/* Financial summary */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg border border-border p-3 text-center">
                          <DollarSign className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                          <p className="text-lg font-bold font-display">{formatBRL(tenantDetails.invoices.summary.total_billed)}</p>
                          <p className="text-[10px] text-muted-foreground">Total faturado</p>
                        </div>
                        <div className="rounded-lg border border-border p-3 text-center">
                          <CreditCard className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                          <p className="text-lg font-bold font-display text-emerald-600">{formatBRL(tenantDetails.invoices.summary.total_paid)}</p>
                          <p className="text-[10px] text-muted-foreground">Total pago</p>
                        </div>
                        <div className="rounded-lg border border-border p-3 text-center">
                          <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto mb-1" />
                          <p className="text-lg font-bold font-display">{tenantDetails.invoices.summary.overdue}</p>
                          <p className="text-[10px] text-muted-foreground">Faturas vencidas</p>
                        </div>
                      </div>

                      {/* Recent invoices */}
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Receipt className="h-3.5 w-3.5" /> Últimas faturas
                        </h4>
                        {tenantDetails.invoices.recent.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma fatura emitida.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {tenantDetails.invoices.recent.map(inv => (
                              <div key={inv.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 text-sm">
                                <div className="space-y-0.5">
                                  <p className="font-mono text-xs text-muted-foreground">#{inv.id.slice(0, 8)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {inv.billing_period_start && format(new Date(inv.billing_period_start), 'dd/MM/yy')}
                                    {inv.billing_period_end && ` — ${format(new Date(inv.billing_period_end), 'dd/MM/yy')}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {invoiceStatusBadge(inv.status)}
                                  <span className="font-medium text-foreground">{formatBRL(inv.total_amount)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Financial ledger */}
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5" /> Movimentações financeiras
                        </h4>
                        {tenantDetails.financial_entries.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação registrada.</p>
                        ) : (
                          <div className="space-y-1">
                            {tenantDetails.financial_entries.map(entry => (
                              <div key={entry.id} className="flex items-center justify-between p-2 rounded-lg text-sm hover:bg-muted/30">
                                <div className="flex items-center gap-2">
                                  <div className={`h-1.5 w-1.5 rounded-full ${entry.entry_type === 'charge' ? 'bg-emerald-500' : entry.entry_type === 'refund' ? 'bg-destructive' : 'bg-amber-500'}`} />
                                  <span className="text-muted-foreground text-xs">{entry.description}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`font-mono text-xs ${entry.entry_type === 'charge' ? 'text-emerald-600' : 'text-destructive'}`}>
                                    {entry.entry_type === 'charge' ? '+' : '-'}{formatBRL(entry.amount)}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">{format(new Date(entry.created_at), 'dd/MM')}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Dados não disponíveis.</p>
                  )}
                </TabsContent>

                {/* ── Support ── */}
                <TabsContent value="support" className="px-6 pb-6 space-y-4">
                  {detailsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : tenantDetails ? (
                    <>
                      {/* Support summary */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg border border-border p-3 text-center">
                          <Headphones className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                          <p className="text-lg font-bold font-display">{tenantDetails.support.total_sessions}</p>
                          <p className="text-[10px] text-muted-foreground">Total atendimentos</p>
                        </div>
                        <div className="rounded-lg border border-border p-3 text-center">
                          <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                          <p className="text-lg font-bold font-display text-emerald-600">{tenantDetails.support.resolved}</p>
                          <p className="text-[10px] text-muted-foreground">Resolvidos</p>
                        </div>
                        <div className="rounded-lg border border-border p-3 text-center">
                          <TrendingUp className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                          <p className="text-lg font-bold font-display">
                            {tenantDetails.support.total_sessions > 0
                              ? Math.round((tenantDetails.support.resolved / tenantDetails.support.total_sessions) * 100)
                              : 0}%
                          </p>
                          <p className="text-[10px] text-muted-foreground">Taxa resolução</p>
                        </div>
                      </div>

                      {/* By priority */}
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Por prioridade</h4>
                        <div className="grid grid-cols-4 gap-2">
                          {Object.entries(tenantDetails.support.by_priority).map(([priority, count]) => (
                            <div key={priority} className="rounded-lg border border-border/60 p-2 text-center">
                              <p className="text-sm font-bold">{count}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">{priority}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* By month */}
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <BarChart3 className="h-3.5 w-3.5" /> Atendimentos por mês
                        </h4>
                        {Object.keys(tenantDetails.support.by_month).length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">Nenhum atendimento registrado.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {Object.entries(tenantDetails.support.by_month)
                              .sort(([a], [b]) => b.localeCompare(a))
                              .slice(0, 6)
                              .map(([month, data]) => (
                                <div key={month} className="flex items-center justify-between p-2 rounded-lg border border-border/60 text-sm">
                                  <span className="font-mono text-muted-foreground">{month}</span>
                                  <div className="flex items-center gap-3 text-xs">
                                    <span className="text-foreground font-medium">{data.total} total</span>
                                    <span className="text-emerald-600">{data.resolved} resolvidos</span>
                                    {data.pending > 0 && <span className="text-amber-600">{data.pending} pendentes</span>}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Dados não disponíveis.</p>
                  )}
                </TabsContent>

                {/* ── Usage ── */}
                <TabsContent value="usage" className="px-6 pb-6 space-y-4">
                  {detailsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : tenantDetails ? (
                    <>
                      {/* Modules */}
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Puzzle className="h-3.5 w-3.5" /> Módulos ativos
                        </h4>
                        <div className="space-y-1.5">
                          {tenantDetails.usage.modules.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Nenhum módulo vinculado.</p>
                          ) : (
                            tenantDetails.usage.modules.map(mod => {
                              const def = PLATFORM_MODULES.find(m => m.key === mod.module_key);
                              return (
                                <div key={mod.module_key} className="flex items-center justify-between p-2.5 rounded-lg border border-border/60">
                                  <div className="space-y-0.5">
                                    <p className="text-sm font-medium">{def?.label ?? mod.module_key}</p>
                                    {def?.description && <p className="text-[10px] text-muted-foreground">{def.description}</p>}
                                  </div>
                                  <Badge className={mod.is_active ? 'bg-emerald-500/10 text-emerald-600 border-0 text-[10px]' : 'bg-muted text-muted-foreground border-0 text-[10px]'}>
                                    {mod.is_active ? 'Ativo' : 'Inativo'}
                                  </Badge>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Members */}
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" /> Membros ({tenantDetails.memberships.length})
                        </h4>
                        <div className="space-y-1">
                          {tenantDetails.memberships.map(m => (
                            <div key={m.id} className="flex items-center justify-between p-2 rounded-lg text-sm hover:bg-muted/30">
                              <span className="font-mono text-xs text-muted-foreground">{m.user_id.slice(0, 12)}…</span>
                              <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="border-t border-border pt-3 space-y-2 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Criado em</span>
                          <span>{format(new Date(selectedTenant.created_at), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>ID</span>
                          <span className="font-mono text-xs">{selectedTenant.id}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Dados não disponíveis.</p>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Create Tenant Dialog ═══ */}
      <Dialog open={dialogMode === 'create'} onOpenChange={open => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Novo Cliente</DialogTitle>
            <DialogDescription>Cadastre uma nova empresa cliente na plataforma.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 py-2">
            {/* Left column — form fields */}
            <div className="lg:col-span-3 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nome da empresa *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Empresa ABC Ltda" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">CNPJ</Label>
                  <Input value={form.document} onChange={e => setForm(f => ({ ...f, document: e.target.value }))} placeholder="00.000.000/0000-00" />
                </div>
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

              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Primeiro Administrador</p>
                <div className="grid grid-cols-2 gap-3">
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
            </div>

            {/* Right column — Plan selection + info */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> Plano SaaS
                </p>
                <div className="grid gap-2">
                  {availablePlans.map(plan => (
                    <button key={plan.id} type="button" onClick={() => setForm(f => ({ ...f, planId: plan.id }))}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
                        form.planId === plan.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'
                      }`}>
                      <span className="font-medium">{plan.name}</span>
                      <span className="text-xs">{plan.price === 0 ? 'Gratuito' : `R$ ${plan.price.toFixed(2).replace('.', ',')} /mês`}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Puzzle className="h-3.5 w-3.5" /> Módulos Disponíveis
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Após criar o cliente, você poderá ativar os módulos desejados na tela de detalhes.
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {PLATFORM_MODULES.slice(0, 8).map(mod => (
                    <Badge key={mod.key} variant="outline" className="text-[9px]">{mod.label}</Badge>
                  ))}
                  {PLATFORM_MODULES.length > 8 && (
                    <Badge variant="outline" className="text-[9px]">+{PLATFORM_MODULES.length - 8}</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving || !form.name.trim() || !form.adminEmail.trim()} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Tenant Dialog ═══ */}
      <Dialog open={dialogMode === 'edit'} onOpenChange={open => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Editar Cliente
            </DialogTitle>
            <DialogDescription>Atualize os dados cadastrais de {selectedTenant?.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 py-2">
            {/* Left column — form fields */}
            <div className="lg:col-span-3 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nome da empresa *</Label>
                  <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Empresa ABC Ltda" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">CNPJ</Label>
                  <Input value={editForm.document} onChange={e => setEditForm(f => ({ ...f, document: e.target.value }))} placeholder="00.000.000/0000-00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                  <Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@empresa.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Telefone</Label>
                  <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 0000-0000" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Endereço</Label>
                <Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} placeholder="Rua, número, cidade - UF" />
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status do Cliente</p>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right column — Info panels */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Informações
                </p>
                {selectedTenant && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Criado em</span>
                      <span>{format(new Date(selectedTenant.created_at), 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Cliente há</span>
                      <span>{(() => {
                        const months = Math.floor((Date.now() - new Date(selectedTenant.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
                        if (months < 1) return 'menos de 1 mês';
                        if (months === 1) return '1 mês';
                        if (months < 12) return `${months} meses`;
                        const years = Math.floor(months / 12);
                        const rem = months % 12;
                        return `${years} ano${years > 1 ? 's' : ''}${rem > 0 ? ` e ${rem} ${rem === 1 ? 'mês' : 'meses'}` : ''}`;
                      })()}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>ID</span>
                      <span className="font-mono text-xs">{selectedTenant.id.slice(0, 8)}…</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Puzzle className="h-3.5 w-3.5" /> Módulos Ativos
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Para gerenciar módulos, acesse a tela de detalhes do cliente.
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {PLATFORM_MODULES.slice(0, 8).map(mod => (
                    <Badge key={mod.key} variant="outline" className="text-[9px]">{mod.label}</Badge>
                  ))}
                  {PLATFORM_MODULES.length > 8 && (
                    <Badge variant="outline" className="text-[9px]">+{PLATFORM_MODULES.length - 8}</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editForm.name.trim()} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Change Plan Dialog ═══ */}
      <Dialog open={dialogMode === 'change-plan'} onOpenChange={open => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" /> Trocar Plano
            </DialogTitle>
            <DialogDescription>
              Altere o plano de {selectedTenant?.name}.
              {selectedTenantPlan && <span className="block mt-1">Plano atual: <strong>{availablePlans.find(p => p.id === selectedTenantPlan.plan_id)?.name}</strong></span>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              {availablePlans.map(plan => (
                <button key={plan.id} type="button" onClick={() => setNewPlanId(plan.id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
                    newPlanId === plan.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{plan.name}</span>
                    {plan.id === selectedTenantPlan?.plan_id && <Badge variant="outline" className="text-[10px] h-5">Atual</Badge>}
                  </div>
                  <span className="text-xs">{plan.price === 0 ? 'Gratuito' : `R$ ${plan.price.toFixed(2).replace('.', ',')} /mês`}</span>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ciclo de cobrança</Label>
              <Select value={newBillingCycle} onValueChange={setNewBillingCycle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newPlanId && (
              <div className="border-t border-border pt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Módulos inclusos</p>
                <div className="flex flex-wrap gap-1.5">
                  {(availablePlans.find(p => p.id === newPlanId)?.allowed_modules ?? []).map(mod => (
                    <Badge key={mod} variant="secondary" className="text-[10px]">{PLATFORM_MODULES.find(m => m.key === mod)?.label ?? mod}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>Cancelar</Button>
            <Button onClick={handleChangePlan} disabled={saving || !newPlanId || newPlanId === selectedTenantPlan?.plan_id} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />} Confirmar troca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Modules Dialog ═══ */}
      <Dialog open={dialogMode === 'modules'} onOpenChange={open => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Puzzle className="h-5 w-5 text-primary" /> Módulos — {selectedTenant?.name}
            </DialogTitle>
            <DialogDescription>Ative ou desative módulos para este tenant.</DialogDescription>
          </DialogHeader>
          {modulesLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-2 py-2 max-h-[400px] overflow-y-auto">
              {PLATFORM_MODULES.map(mod => {
                const active = isModuleActive(mod.key);
                return (
                  <div key={mod.key} className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">{mod.label}</p>
                      <p className="text-xs text-muted-foreground">{mod.description}</p>
                    </div>
                    <Switch checked={active} onCheckedChange={() => toggleModule(mod.key, active)} disabled={!can('module.enable')} />
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Impersonate Dialog ═══ */}
      <Dialog open={dialogMode === 'impersonate'} onOpenChange={open => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" /> Entrar como Tenant
            </DialogTitle>
            <DialogDescription>
              Você irá operar como <span className="font-semibold text-foreground">TenantAdmin</span> no ambiente de{' '}
              <span className="font-semibold text-foreground">{selectedTenant?.name}</span>. Todas as ações serão auditadas.
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
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Motivo *</Label>
              <Textarea value={impersonateReason} onChange={e => setImpersonateReason(e.target.value)}
                placeholder="Ex: Investigação de ticket #1234" rows={3} className="resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Duração (minutos)
              </Label>
              <div className="flex items-center gap-3">
                {[15, 30, 60, 120].map(min => (
                  <Button key={min} size="sm" variant={impersonateDuration === min ? 'default' : 'outline'}
                    onClick={() => setImpersonateDuration(min)} className="flex-1">{min}m</Button>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 p-3 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Identidade real</span><span className="font-mono text-foreground">{user?.email}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Role</span><Badge variant="outline" className="text-[10px] h-5">{platformIdentity?.role}</Badge>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tenant alvo</span><span className="font-medium text-foreground">{selectedTenant?.name}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>Cancelar</Button>
            <Button onClick={handleStartImpersonation} disabled={impersonating || !impersonateReason.trim()}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
              {impersonating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4" />} Iniciar Impersonação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Confirmation ═══ */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar tenant para deleção?</AlertDialogTitle>
            <AlertDialogDescription>
              O tenant <strong>{tenantToDelete?.name}</strong> será marcado como <em>"Aguardando Deleção"</em> e ficará retido por <strong>{retentionDays} dias</strong> antes da remoção definitiva. Durante esse período é possível reverter a ação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTenant} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />} Marcar para Deleção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
