/**
 * PlatformCoupons — Gerenciamento de Cupons (Platform Admin)
 *
 * Funcionalidades:
 * - Criar cupom com restrições (plano, tenant, módulo, método de pagamento)
 * - Listar cupons com status, uso e filtros
 * - Desativar/ativar cupons
 *
 * Governança: Somente PlatformSuperAdmin e PlatformFinance podem criar/editar.
 */

import { useState, useEffect, useCallback } from 'react';
import { CouponAbuseAlerts } from '@/components/platform/CouponAbuseAlerts';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Ticket, Plus, Power, PowerOff, RefreshCw, Search, Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePlatformPermissions } from '@/domains/platform';

// ── Helpers ──────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Ativo', variant: 'default' },
  disabled: { label: 'Desativado', variant: 'secondary' },
  expired: { label: 'Expirado', variant: 'destructive' },
  exhausted: { label: 'Esgotado', variant: 'outline' },
  archived: { label: 'Arquivado', variant: 'secondary' },
  paused: { label: 'Pausado', variant: 'outline' },
};

const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  percentage: 'Percentual',
  fixed_amount: 'Valor Fixo',
  free_months: 'Meses Grátis',
};

function formatBRL(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

// ── Types ────────────────────────────────────────────────

interface CouponRow {
  id: string;
  code: string;
  name: string;
  discount_type: string;
  discount_value: number;
  applies_to: string;
  max_redemptions: number | null;
  current_redemptions: number;
  max_redemptions_per_tenant: number | null;
  applicable_plan_ids: string[] | null;
  allowed_modules: string[] | null;
  allowed_payment_methods: string[] | null;
  tenant_scope: string | null;
  valid_from: string;
  valid_until: string | null;
  status: string;
  created_at: string;
}

// ── Component ────────────────────────────────────────────

export default function PlatformCoupons() {
  const { can } = usePlatformPermissions();
  const canMutate = can('coupon.create');

  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    code: '',
    name: '',
    discount_type: 'percentage',
    discount_value: '',
    applies_to: 'invoice',
    max_redemptions: '',
    max_redemptions_per_tenant: '1',
    applicable_plan_ids: '',
    allowed_modules: '',
    allowed_payment_methods: '',
    tenant_scope: '',
    valid_from: new Date().toISOString().slice(0, 10),
    valid_until: '',
  });

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setCoupons((data ?? []) as unknown as CouponRow[]);
    } catch (err: unknown) {
      toast.error(`Erro ao carregar cupons: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const filteredCoupons = coupons.filter(c =>
    !search || c.code.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.discount_value) {
      toast.error('Preencha código, nome e valor do desconto.');
      return;
    }

    setSaving(true);
    try {
      const parsePlanIds = form.applicable_plan_ids.trim()
        ? form.applicable_plan_ids.split(',').map(s => s.trim()).filter(Boolean)
        : null;
      const parseModules = form.allowed_modules.trim()
        ? form.allowed_modules.split(',').map(s => s.trim()).filter(Boolean)
        : null;
      const parsePaymentMethods = form.allowed_payment_methods.trim()
        ? form.allowed_payment_methods.split(',').map(s => s.trim()).filter(Boolean)
        : null;

      const { error } = await supabase.from('coupons').insert([{
        code: form.code.toUpperCase().trim(),
        name: form.name.trim(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        applies_to: form.applies_to,
        max_redemptions: form.max_redemptions ? Number(form.max_redemptions) : null,
        max_redemptions_per_tenant: form.max_redemptions_per_tenant ? Number(form.max_redemptions_per_tenant) : 1,
        applicable_plan_ids: parsePlanIds,
        allowed_modules: parseModules,
        allowed_payment_methods: parsePaymentMethods,
        tenant_scope: form.tenant_scope.trim() || null,
        valid_from: form.valid_from || new Date().toISOString(),
        valid_until: form.valid_until || null,
        status: 'active',
      }]);

      if (error) throw error;
      toast.success(`Cupom ${form.code.toUpperCase()} criado com sucesso.`);
      setShowCreate(false);
      resetForm();
      fetchCoupons();
    } catch (err: unknown) {
      toast.error(`Erro ao criar cupom: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (coupon: CouponRow) => {
    const newStatus = coupon.status === 'active' ? 'disabled' : 'active';
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ status: newStatus })
        .eq('id', coupon.id);
      if (error) throw error;
      toast.success(`Cupom ${coupon.code} ${newStatus === 'active' ? 'ativado' : 'desativado'}.`);
      fetchCoupons();
    } catch (err: unknown) {
      toast.error(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const resetForm = () => setForm({
    code: '', name: '', discount_type: 'percentage', discount_value: '',
    applies_to: 'invoice', max_redemptions: '', max_redemptions_per_tenant: '1',
    applicable_plan_ids: '', allowed_modules: '', allowed_payment_methods: '',
    tenant_scope: '', valid_from: new Date().toISOString().slice(0, 10), valid_until: '',
  });

  // ── Stats ──
  const totalActive = coupons.filter(c => c.status === 'active').length;
  const totalUsage = coupons.reduce((sum, c) => sum + c.current_redemptions, 0);

  return (
    <div className="space-y-6">
      {/* Governance AI Alerts */}
      <CouponAbuseAlerts />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-display)]">
            Cupons & Descontos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie cupons de desconto da plataforma</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchCoupons}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setShowCreate(true)} className="bg-violet-600 hover:bg-violet-700 text-white">
              <Plus className="h-4 w-4 mr-1" /> Novo Cupom
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Cupons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{coupons.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cupons Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-600">{totalActive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Usos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalUsage}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="disabled">Desativados</SelectItem>
                <SelectItem value="expired">Expirados</SelectItem>
                <SelectItem value="exhausted">Esgotados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredCoupons.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Ticket className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum cupom encontrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Aplica-se a</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  {canMutate && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCoupons.map(c => {
                  const st = STATUS_MAP[c.status] ?? { label: c.status, variant: 'outline' as const };
                  const discountLabel = c.discount_type === 'percentage'
                    ? `${c.discount_value}%`
                    : c.discount_type === 'free_months'
                      ? `${c.discount_value} meses`
                      : formatBRL(c.discount_value);

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-semibold text-foreground">{c.code}</TableCell>
                      <TableCell className="text-foreground">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {DISCOUNT_TYPE_LABELS[c.discount_type] ?? c.discount_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">{discountLabel}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs capitalize">{c.applies_to}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-foreground font-medium">{c.current_redemptions}</span>
                        <span className="text-muted-foreground">
                          {c.max_redemptions != null ? ` / ${c.max_redemptions}` : ' / ∞'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(c.valid_from)}
                        {c.valid_until ? ` → ${formatDate(c.valid_until)}` : ''}
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      {canMutate && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleStatus(c)}
                            title={c.status === 'active' ? 'Desativar' : 'Ativar'}
                          >
                            {c.status === 'active' ? (
                              <PowerOff className="h-4 w-4 text-destructive" />
                            ) : (
                              <Power className="h-4 w-4 text-emerald-600" />
                            )}
                          </Button>
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

      {/* Restrictions legend */}
      {filteredCoupons.some(c => c.applicable_plan_ids?.length || c.tenant_scope || c.allowed_modules?.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Restrições dos Cupons Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {filteredCoupons
                .filter(c => c.status === 'active' && (c.applicable_plan_ids?.length || c.tenant_scope || c.allowed_modules?.length))
                .map(c => (
                  <div key={c.id} className="flex items-start gap-3 py-1 border-b border-border last:border-0">
                    <span className="font-mono font-semibold text-foreground min-w-[100px]">{c.code}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {c.applicable_plan_ids?.map(pid => (
                        <Badge key={pid} variant="outline" className="text-xs">Plano: {pid.slice(0, 8)}</Badge>
                      ))}
                      {c.tenant_scope && (
                        <Badge variant="outline" className="text-xs">Tenant: {c.tenant_scope.slice(0, 8)}</Badge>
                      )}
                      {c.allowed_modules?.map(m => (
                        <Badge key={m} variant="outline" className="text-xs">Módulo: {m}</Badge>
                      ))}
                      {c.allowed_payment_methods?.map(m => (
                        <Badge key={m} variant="outline" className="text-xs">Pagamento: {m}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-[family-name:var(--font-display)]">Novo Cupom</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Código *</Label>
                <Input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="EX: WELCOME20"
                  className="font-mono uppercase"
                  maxLength={30}
                />
              </div>
              <div>
                <Label>Nome *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Boas-vindas 20%"
                  maxLength={100}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tipo de Desconto</Label>
                <Select value={form.discount_type} onValueChange={v => setForm(f => ({ ...f, discount_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual</SelectItem>
                    <SelectItem value="fixed_amount">Valor Fixo</SelectItem>
                    <SelectItem value="free_months">Meses Grátis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor *</Label>
                <Input
                  type="number"
                  value={form.discount_value}
                  onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                  placeholder={form.discount_type === 'percentage' ? '20' : '50.00'}
                  min={0}
                />
              </div>
              <div>
                <Label>Aplica-se a</Label>
                <Select value={form.applies_to} onValueChange={v => setForm(f => ({ ...f, applies_to: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="plan">Plano</SelectItem>
                    <SelectItem value="module">Módulo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Máx. Usos Global</Label>
                <Input
                  type="number"
                  value={form.max_redemptions}
                  onChange={e => setForm(f => ({ ...f, max_redemptions: e.target.value }))}
                  placeholder="∞"
                  min={0}
                />
              </div>
              <div>
                <Label>Máx. Usos / Tenant</Label>
                <Input
                  type="number"
                  value={form.max_redemptions_per_tenant}
                  onChange={e => setForm(f => ({ ...f, max_redemptions_per_tenant: e.target.value }))}
                  placeholder="1"
                  min={0}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Válido de</Label>
                <Input
                  type="date"
                  value={form.valid_from}
                  onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))}
                />
              </div>
              <div>
                <Label>Válido até</Label>
                <Input
                  type="date"
                  value={form.valid_until}
                  onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                />
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Restrições (opcional)</p>

              <div>
                <Label>IDs de Planos (separados por vírgula)</Label>
                <Input
                  value={form.applicable_plan_ids}
                  onChange={e => setForm(f => ({ ...f, applicable_plan_ids: e.target.value }))}
                  placeholder="uuid-plan-1, uuid-plan-2"
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <Label>Módulos Permitidos (separados por vírgula)</Label>
                <Input
                  value={form.allowed_modules}
                  onChange={e => setForm(f => ({ ...f, allowed_modules: e.target.value }))}
                  placeholder="hr, payroll, compliance"
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <Label>Métodos de Pagamento (separados por vírgula)</Label>
                <Input
                  value={form.allowed_payment_methods}
                  onChange={e => setForm(f => ({ ...f, allowed_payment_methods: e.target.value }))}
                  placeholder="credit_card, pix, boleto"
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <Label>Escopo de Tenant (UUID)</Label>
                <Input
                  value={form.tenant_scope}
                  onChange={e => setForm(f => ({ ...f, tenant_scope: e.target.value }))}
                  placeholder="Deixe vazio para todos os tenants"
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {saving ? 'Criando...' : 'Criar Cupom'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
