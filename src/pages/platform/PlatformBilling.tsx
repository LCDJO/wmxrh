/**
 * PlatformBilling — Financeiro (Real Data)
 * Invoices + tenant_plans + financial entries from DB
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Receipt, DollarSign, Clock, AlertTriangle, CheckCircle2,
  TrendingUp, CreditCard, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

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
};

function formatBRL(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

export default function PlatformBilling() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [tenantPlans, setTenantPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [invRes, entRes, tpRes] = await Promise.all([
      supabase.from('invoices').select('*, tenants(name)').order('created_at', { ascending: false }).limit(100),
      supabase.from('platform_financial_entries').select('*, tenants(name)').order('created_at', { ascending: false }).limit(100),
      supabase.from('tenant_plans').select('*, tenants(name), saas_plans(name, price)').order('created_at', { ascending: false }),
    ]);
    if (invRes.error) console.error(invRes.error);
    if (entRes.error) console.error(entRes.error);
    if (tpRes.error) console.error(tpRes.error);
    setInvoices(invRes.data ?? []);
    setEntries(entRes.data ?? []);
    setTenantPlans(tpRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredInvoices = statusFilter === 'all'
    ? invoices
    : invoices.filter(i => i.status === statusFilter);

  // Summary stats
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total_amount), 0);
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.total_amount), 0);
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.total_amount), 0);
  const activeSubscriptions = tenantPlans.filter(tp => tp.status === 'active').length;

  if (loading) return <BillingSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Faturas, cobranças e lançamentos financeiros — dados reais.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => { fetchData(); toast.success('Atualizado'); }}>
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2.5"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Recebido</p>
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
                <p className="text-xs text-muted-foreground">Assinaturas Ativas</p>
                <p className="text-xl font-bold font-display text-foreground">{activeSubscriptions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Faturas
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
                        <TableCell className="text-xs font-medium">{(inv as any).tenants?.name ?? inv.tenant_id?.slice(0, 8)}</TableCell>
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
            <DollarSign className="h-4 w-4" /> Lançamentos Financeiros
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

      {/* Active Tenant Plans */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Assinaturas de Tenants
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
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="pt-5"><Skeleton className="h-14 w-full" /></CardContent></Card>)}
      </div>
      <Card><CardContent className="pt-5"><Skeleton className="h-48 w-full" /></CardContent></Card>
    </div>
  );
}
