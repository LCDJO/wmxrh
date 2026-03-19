/**
 * PlatformBilling — Financeiro (Real Data via BillingCore)
 *
 * Uses BillingCore services: InvoiceEngine, RevenueMetrics, FinancialLedger.
 * TenantPlan resolved automatically via PXE.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Receipt, DollarSign, Clock, AlertTriangle, CheckCircle2,
  TrendingUp, CreditCard, RefreshCw, BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBillingCore } from '@/hooks/use-billing-core';
import type { Invoice, RevenueMetrics } from '@/domains/billing-core';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  pending: { label: 'Pendente', variant: 'outline' },
  paid: { label: 'Pago', variant: 'default' },
  overdue: { label: 'Vencida', variant: 'destructive' },
  cancelled: { label: 'Cancelada', variant: 'secondary' },
  refunded: { label: 'Reembolsada', variant: 'outline' },
};

const ENTRY_TYPE_MAP: Record<string, string> = {
  subscription: 'Assinatura',
  upgrade: 'Upgrade',
  downgrade: 'Downgrade',
  refund: 'Reembolso',
  adjustment: 'Ajuste',
  payment: 'Pagamento',
  credit: 'Crédito',
  coupon_discount: 'Desconto Cupom',
  usage_overage: 'Excedente Uso',
  plan_charge: 'Cobrança Plano',
};

function formatBRL(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

export default function PlatformBilling() {
  const billing = useBillingCore();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [tenantPlans, setTenantPlans] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Use BillingCore services for invoices and revenue metrics
    const [allInvoices, revenueMetrics, entRes, tpRes] = await Promise.all([
      billing.invoices.listAll({ limit: 100 }),
      billing.revenue.getMetrics(),
      supabase.from('platform_financial_entries').select('*, tenants(name)').order('created_at', { ascending: false }).limit(100),
      supabase.from('tenant_plans').select('*, tenants(name), saas_plans(name, price)').order('created_at', { ascending: false }),
    ]);

    if (entRes.error) logger.error('Erro ao buscar entries financeiras', { error: entRes.error });
    if (tpRes.error) logger.error('Erro ao buscar tenant plans', { error: tpRes.error });

    setInvoices(allInvoices);
    setMetrics(revenueMetrics);
    setEntries(entRes.data ?? []);
    setTenantPlans(tpRes.data ?? []);
    setLoading(false);
  }, [billing]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMarkOverdue = useCallback(async () => {
    const count = await billing.invoices.markOverdueInvoices();
    toast.success(`${count} fatura(s) marcada(s) como vencida(s)`);
    fetchData();
  }, [billing, fetchData]);

  const filteredInvoices = statusFilter === 'all'
    ? invoices
    : invoices.filter(i => i.status === statusFilter);

  // Use RevenueMetrics from BillingCore
  const totalPaid = metrics?.revenue_brl ?? 0;
  const totalPending = metrics?.pending_brl ?? 0;
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.total_amount), 0);
  const activeSubscriptions = metrics?.paying_tenants ?? tenantPlans.filter(tp => tp.status === 'active').length;

  if (loading) return <BillingSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">
            BillingCore ativo — InvoiceEngine, Calculator, Ledger e RevenueMetrics integrados.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleMarkOverdue}>
            <AlertTriangle className="h-3.5 w-3.5" /> Marcar Vencidas
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { fetchData(); toast.success('Atualizado'); }}>
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards — powered by RevenueMetricsService */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2.5"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Receita Total</p>
                <p className="text-xl font-bold font-display text-foreground">{formatBRL(totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2.5"><Clock className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="text-xl font-bold font-display text-foreground">{formatBRL(totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-destructive/10 p-2.5"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Vencido</p>
                <p className="text-xl font-bold font-display text-foreground">{formatBRL(totalOverdue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5"><TrendingUp className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">MRR</p>
                <p className="text-xl font-bold font-display text-foreground">{formatBRL(metrics?.mrr_brl ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5"><BarChart3 className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Assinaturas Ativas</p>
                <p className="text-xl font-bold font-display text-foreground">{activeSubscriptions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Plan — from RevenueMetrics */}
      {metrics && metrics.revenue_by_plan.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Receita por Plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {metrics.revenue_by_plan.map(p => (
                <div key={p.plan} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{p.plan}</span>
                    <Badge variant="outline" className="text-[10px]">{p.tier}</Badge>
                  </div>
                  <p className="text-lg font-bold font-display">{formatBRL(p.mrr)}<span className="text-xs text-muted-foreground font-normal">/mês</span></p>
                  <p className="text-xs text-muted-foreground">{p.count} tenant(s)</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices Table — via InvoiceEngine */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Faturas <Badge variant="secondary" className="text-[10px] ml-1">InvoiceEngine</Badge>
            </CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="overdue">Vencida</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma fatura encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tenant</TableHead>
                    <TableHead className="text-xs">Valor</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Vencimento</TableHead>
                    <TableHead className="text-xs">Período</TableHead>
                    <TableHead className="text-xs">Método</TableHead>
                    <TableHead className="text-xs">Criada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map(inv => {
                    const st = STATUS_MAP[inv.status] ?? { label: inv.status, variant: 'secondary' as const };
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="text-xs font-medium">{inv.tenant_id?.slice(0, 8)}</TableCell>
                        <TableCell className="text-xs font-mono">{formatBRL(Number(inv.total_amount))}</TableCell>
                        <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                        <TableCell className="text-xs">{formatDate(inv.due_date)}</TableCell>
                        <TableCell className="text-xs">{formatDate(inv.billing_period_start)} — {formatDate(inv.billing_period_end)}</TableCell>
                        <TableCell className="text-xs">{inv.payment_method ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(inv.created_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Ledger */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Lançamentos Financeiros <Badge variant="secondary" className="text-[10px] ml-1">Ledger</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum lançamento registrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tenant</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Valor</TableHead>
                    <TableHead className="text-xs">Descrição</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs font-medium">{(e as any).tenants?.name ?? e.tenant_id?.slice(0, 8)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{ENTRY_TYPE_MAP[e.entry_type] ?? e.entry_type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{formatBRL(Number(e.amount))}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{e.description ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(e.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Tenant Plans — TenantPlan auto-vinculado via PXE */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Assinaturas de Tenants <Badge variant="secondary" className="text-[10px] ml-1">TenantPlan</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenantPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma assinatura encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tenant</TableHead>
                    <TableHead className="text-xs">Plano</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Ciclo</TableHead>
                    <TableHead className="text-xs">Pagamento</TableHead>
                    <TableHead className="text-xs">Próx. Cobrança</TableHead>
                    <TableHead className="text-xs">Início</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantPlans.map(tp => (
                    <TableRow key={tp.id}>
                      <TableCell className="text-xs font-medium">{(tp as any).tenants?.name ?? tp.tenant_id?.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">{(tp as any).saas_plans?.name ?? '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={tp.status === 'active' ? 'default' : tp.status === 'trial' ? 'outline' : 'destructive'}
                          className="text-[10px]"
                        >
                          {tp.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{tp.billing_cycle ?? '—'}</TableCell>
                      <TableCell className="text-xs">{tp.payment_method ?? '—'}</TableCell>
                      <TableCell className="text-xs">{formatDate(tp.next_billing_date)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(tp.started_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aging / Overdue Breakdown — from RevenueMetrics */}
      {metrics && metrics.aging.some(a => a.count > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Aging de Inadimplência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              {metrics.aging.map(a => (
                <div key={a.bucket} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{a.bucket}</p>
                  <p className="text-lg font-bold font-display">{formatBRL(a.total_brl)}</p>
                  <p className="text-xs text-muted-foreground">{a.count} fatura(s)</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-72 mt-2" /></div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        {[...Array(5)].map((_, i) => <Card key={i}><CardContent className="pt-5"><Skeleton className="h-14 w-full" /></CardContent></Card>)}
      </div>
      <Card><CardContent className="pt-5"><Skeleton className="h-48 w-full" /></CardContent></Card>
    </div>
  );
}
