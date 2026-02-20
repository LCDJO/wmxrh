/**
 * EpisTab — Employee EPI profile tab
 *
 * Sections:
 *   1. EPIs ativos (currently delivered) with lot info
 *   2. Histórico de entregas (all statuses)
 *   3. Lote vinculado (lot traceability)
 *   4. Custo acumulado (accumulated cost)
 *   5. Documentos assinados (signatures)
 *   6. Próximas substituições (pending requirements)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, History, FileSignature, RefreshCw, AlertTriangle, Package, DollarSign } from 'lucide-react';
import { format, isPast, differenceInDays } from 'date-fns';

interface Props {
  employeeId: string;
  tenantId: string;
}

// ── Data hooks ──

function useEmployeeEpis(employeeId: string, tenantId: string) {
  return useQuery({
    queryKey: ['employee-epis', employeeId, tenantId],
    queryFn: async () => {
      const [activeRes, historyRes, sigsRes, reqsRes, costRes, assetsRes] = await Promise.all([
        // Active EPIs
        supabase
          .from('epi_deliveries' as any)
          .select('id, epi_catalog_id, data_entrega, data_validade, ca_numero, lote, status, epi_catalog:epi_catalog_id(nome, ca_numero, ca_validade)')
          .eq('tenant_id', tenantId)
          .eq('employee_id', employeeId)
          .eq('status', 'entregue')
          .order('data_entrega', { ascending: false }),

        // Full history
        supabase
          .from('epi_deliveries' as any)
          .select('id, epi_catalog_id, data_entrega, data_validade, motivo, lote, status, epi_catalog:epi_catalog_id(nome)')
          .eq('tenant_id', tenantId)
          .eq('employee_id', employeeId)
          .order('data_entrega', { ascending: false }),

        // Signatures
        supabase
          .from('epi_signatures' as any)
          .select('id, delivery_id, tipo_assinatura, assinado_em, is_valid, documento_url')
          .eq('tenant_id', tenantId)
          .eq('employee_id', employeeId)
          .order('assinado_em', { ascending: false }),

        // Pending requirements
        supabase
          .from('epi_requirements' as any)
          .select('id, epi_catalog_id, motivo, obrigatorio, created_at, epi_catalog:epi_catalog_id(nome)')
          .eq('tenant_id', tenantId)
          .eq('employee_id', employeeId)
          .eq('status', 'pendente')
          .order('created_at', { ascending: false }),

        // Accumulated cost via RPC
        supabase.rpc('get_epi_cost_by_employee', {
          _tenant_id: tenantId,
          _employee_id: employeeId,
        }),

        // Individual tracked assets
        supabase
          .from('epi_assets' as any)
          .select('id, serial_number, status, data_entrega, data_retorno, epi_catalog:epi_catalog_id(nome), lot:lot_id(lote_numero, lote_validade, fabricante)')
          .eq('tenant_id', tenantId)
          .eq('employee_id', employeeId)
          .order('data_entrega', { ascending: false }),
      ]);

      return {
        active: (activeRes.data ?? []) as any[],
        history: (historyRes.data ?? []) as any[],
        signatures: (sigsRes.data ?? []) as any[],
        requirements: (reqsRes.data ?? []) as any[],
        costs: (costRes.data ?? []) as any[],
        assets: (assetsRes.data ?? []) as any[],
      };
    },
    enabled: !!employeeId && !!tenantId,
  });
}

// ── Status labels ──

const statusLabels: Record<string, string> = {
  entregue: 'Entregue', devolvido: 'Devolvido', vencido: 'Vencido',
  substituido: 'Substituído', extraviado: 'Extraviado',
};

const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (s === 'entregue') return 'default';
  if (s === 'vencido' || s === 'extraviado') return 'destructive';
  return 'secondary';
};

const motivoLabels: Record<string, string> = {
  entrega_inicial: 'Entrega Inicial', substituicao_desgaste: 'Desgaste',
  substituicao_dano: 'Dano', substituicao_vencimento: 'Vencimento', novo_risco: 'Novo Risco',
};

const assetStatusLabels: Record<string, string> = {
  disponivel: 'Disponível', in_use: 'Em uso', returned: 'Devolvido', discarded: 'Descartado',
};

// ── Component ──

export function EpisTab({ employeeId, tenantId }: Props) {
  const { data, isLoading } = useEmployeeEpis(employeeId, tenantId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  const { active = [], history = [], signatures = [], requirements = [], costs = [], assets = [] } = data ?? {};
  const totalCost = costs.reduce((s: number, c: any) => s + Number(c.custo_total_acumulado ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Custo Acumulado Summary */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">EPIs Ativos</CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-foreground">{active.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Entregas</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-foreground">{history.length}</p>
          </CardContent>
        </Card>
        <Card className={totalCost > 0 ? 'border-primary/30' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Custo Acumulado</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-foreground">
              R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 1. EPIs Ativos */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">EPIs Ativos</CardTitle>
          <Badge variant="secondary" className="ml-auto">{active.length}</Badge>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum EPI ativo no momento.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>EPI</TableHead>
                  <TableHead>CA</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((d: any) => {
                  const isExpired = d.data_validade && isPast(new Date(d.data_validade));
                  const daysLeft = d.data_validade ? differenceInDays(new Date(d.data_validade), new Date()) : null;
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.epi_catalog?.nome ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{d.ca_numero || d.epi_catalog?.ca_numero || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{d.lote || '—'}</TableCell>
                      <TableCell>{format(new Date(d.data_entrega), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        {d.data_validade ? (
                          <span className={isExpired ? 'text-destructive font-semibold' : daysLeft !== null && daysLeft <= 30 ? 'text-yellow-600 font-semibold' : ''}>
                            {format(new Date(d.data_validade), 'dd/MM/yyyy')}
                            {isExpired && <AlertTriangle className="inline ml-1 h-3.5 w-3.5" />}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell><Badge variant={statusVariant(d.status)}>{statusLabels[d.status] ?? d.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 2. Ativos Rastreados (lote vinculado) */}
      {assets.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Package className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Ativos Rastreados (Lote Vinculado)</CardTitle>
            <Badge variant="secondary" className="ml-auto">{assets.length}</Badge>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>EPI</TableHead>
                  <TableHead>Nº Série</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead>Validade Lote</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.epi_catalog?.nome ?? '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{a.serial_number}</TableCell>
                    <TableCell className="font-mono text-xs">{a.lot?.lote_numero ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{a.lot?.fabricante ?? '—'}</TableCell>
                    <TableCell>
                      {a.lot?.lote_validade ? (
                        <span className={isPast(new Date(a.lot.lote_validade)) ? 'text-destructive font-semibold' : ''}>
                          {format(new Date(a.lot.lote_validade), 'dd/MM/yyyy')}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>{a.data_entrega ? format(new Date(a.data_entrega), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === 'in_use' ? 'default' : a.status === 'discarded' ? 'destructive' : 'secondary'}>
                        {assetStatusLabels[a.status] ?? a.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 3. Custo Acumulado Detalhado */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <DollarSign className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Custo Acumulado por EPI</CardTitle>
        </CardHeader>
        <CardContent>
          {costs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum custo registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>EPI</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Custo Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costs.map((c: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{c.epi_nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.total_quantidade}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      R$ {Number(c.custo_total_acumulado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2">
                  <TableCell className="font-bold">Total</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    {costs.reduce((s: number, c: any) => s + Number(c.total_quantidade ?? 0), 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold text-primary">
                    R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 4. Histórico de Entregas */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <History className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Histórico de Entregas</CardTitle>
          <Badge variant="outline" className="ml-auto">{history.length}</Badge>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma entrega registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>EPI</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.epi_catalog?.nome ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{motivoLabels[d.motivo] ?? d.motivo}</TableCell>
                    <TableCell className="font-mono text-xs">{d.lote || '—'}</TableCell>
                    <TableCell>{format(new Date(d.data_entrega), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{d.data_validade ? format(new Date(d.data_validade), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell><Badge variant={statusVariant(d.status)}>{statusLabels[d.status] ?? d.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 5. Documentos Assinados */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <FileSignature className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Documentos Assinados</CardTitle>
          <Badge variant="outline" className="ml-auto">{signatures.length}</Badge>
        </CardHeader>
        <CardContent>
          {signatures.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma assinatura registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Válida</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signatures.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="capitalize">{s.tipo_assinatura?.replace('_', ' ') ?? '—'}</TableCell>
                    <TableCell>{format(new Date(s.assinado_em), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell>
                      <Badge variant={s.is_valid ? 'default' : 'destructive'}>
                        {s.is_valid ? 'Válida' : 'Invalidada'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 6. Próximas Substituições */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <RefreshCw className="h-4 w-4 text-orange-600" />
          <CardTitle className="text-sm font-semibold">Próximas Substituições</CardTitle>
          {requirements.length > 0 && (
            <Badge variant="destructive" className="ml-auto">{requirements.length} pendente(s)</Badge>
          )}
        </CardHeader>
        <CardContent>
          {requirements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma substituição pendente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>EPI</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Obrigatório</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.epi_catalog?.nome ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{r.motivo}</TableCell>
                    <TableCell>
                      <Badge variant={r.obrigatorio ? 'destructive' : 'secondary'}>
                        {r.obrigatorio ? 'Sim' : 'Não'}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(r.created_at), 'dd/MM/yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
