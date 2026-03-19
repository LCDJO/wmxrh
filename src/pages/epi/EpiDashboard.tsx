/**
 * EPI Dashboard — Company & Tenant-level EPI Inventory overview
 *
 * Company: stock, lots by expiry, cost by department, assets in use
 * Tenant: compliance ranking, cost ranking, stock rupture risk
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ShieldCheck, AlertTriangle, Package, FileWarning, PenTool, Trophy,
  Warehouse, CalendarClock, DollarSign, User, TrendingDown
} from 'lucide-react';
import { useEpiCompanyStats, useEpiCompanyRanking } from '@/hooks/epi/useEpiDashboard';
import {
  useInventoryStock, useLotsByExpiry, useCostByDepartment,
  useAssetsInUse, useCompanyCostRanking, useStockRuptureRisk,
} from '@/hooks/epi/useEpiInventoryDashboard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const LOT_COLORS: Record<string, string> = {
  vencido: 'hsl(0, 70%, 50%)',
  vence_30d: 'hsl(30, 80%, 55%)',
  vence_90d: 'hsl(45, 80%, 50%)',
  ok: 'hsl(142, 60%, 45%)',
  sem_validade: 'hsl(220, 10%, 60%)',
};

const LOT_LABELS: Record<string, string> = {
  vencido: 'Vencido',
  vence_30d: 'Vence em 30d',
  vence_90d: 'Vence em 90d',
  ok: 'Válido',
  sem_validade: 'Sem validade',
};

const RISK_BADGE: Record<string, string> = {
  critico: 'bg-destructive/15 text-destructive border-destructive/30',
  alto: 'bg-orange-600/15 text-orange-700 border-orange-600/30',
  medio: 'bg-yellow-600/15 text-yellow-700 border-yellow-600/30',
  baixo: 'bg-green-600/15 text-green-700 border-green-600/30',
};

function complianceBadge(pct: number) {
  if (pct >= 90) return <Badge className="bg-green-600/15 text-green-700 border-green-600/30">Excelente</Badge>;
  if (pct >= 70) return <Badge className="bg-yellow-600/15 text-yellow-700 border-yellow-600/30">Bom</Badge>;
  if (pct >= 50) return <Badge className="bg-orange-600/15 text-orange-700 border-orange-600/30">Regular</Badge>;
  return <Badge variant="destructive">Crítico</Badge>;
}

export default function EpiDashboard() {
  const { data: stats, isLoading: loadingStats } = useEpiCompanyStats();
  const { data: ranking, isLoading: loadingRanking } = useEpiCompanyRanking();
  const { data: stock, isLoading: loadingStock } = useInventoryStock();
  const { data: lotExpiry, isLoading: loadingLots } = useLotsByExpiry();
  const { data: costDept, isLoading: loadingCost } = useCostByDepartment();
  const { data: assetsInUse, isLoading: loadingAssets } = useAssetsInUse();
  const { data: costRanking, isLoading: loadingCostRank } = useCompanyCostRanking();
  const { data: ruptureRisk, isLoading: loadingRupture } = useStockRuptureRisk();

  // Aggregate stock KPIs
  const totalStock = stock?.reduce((s, i) => s + i.quantidade_disponivel, 0) ?? 0;
  const lowStockCount = stock?.filter(i => i.quantidade_disponivel <= i.quantidade_minima && i.quantidade_disponivel > 0).length ?? 0;
  const noStockCount = stock?.filter(i => i.quantidade_disponivel === 0).length ?? 0;

  // Aggregate cost data for chart
  const costChartData = costDept
    ? Object.values(
        costDept.reduce<Record<string, { department: string; custo: number }>>((acc, row) => {
          if (!acc[row.department_name]) acc[row.department_name] = { department: row.department_name, custo: 0 };
          acc[row.department_name].custo += Number(row.custo_total);
          return acc;
        }, {})
      ).sort((a, b) => b.custo - a.custo)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard EPI & Inventário</h1>
        <p className="text-muted-foreground text-sm">
          Visão completa de estoque, lotes, custos e conformidade de EPIs
        </p>
      </div>

      <Tabs defaultValue="empresa" className="w-full">
        <TabsList>
          <TabsTrigger value="empresa">Visão Empresa</TabsTrigger>
          <TabsTrigger value="tenant">Visão Tenant</TabsTrigger>
        </TabsList>

        {/* ═══ EMPRESA TAB ═══ */}
        <TabsContent value="empresa" className="space-y-6 mt-4">
          {/* KPI Cards */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard title="Itens em Estoque" value={totalStock} loading={loadingStock}
              icon={<Package className="h-4 w-4 text-primary" />} description="Unidades disponíveis" />
            <KpiCard title="Estoque Baixo" value={lowStockCount} loading={loadingStock}
              icon={<TrendingDown className="h-4 w-4 text-orange-600" />} description="Abaixo do mínimo"
              warn={lowStockCount > 0} />
            <KpiCard title="Sem Estoque" value={noStockCount} loading={loadingStock}
              icon={<AlertTriangle className="h-4 w-4 text-destructive" />} description="Zerados"
              alert={noStockCount > 0} />
            <KpiCard title="EPIs Entregues" value={stats?.total_delivered} loading={loadingStats}
              icon={<ShieldCheck className="h-4 w-4 text-primary" />} description="Ativos" />
            <KpiCard title="EPIs Vencidos" value={stats?.expired} loading={loadingStats}
              icon={<FileWarning className="h-4 w-4 text-destructive" />} description="Validade expirada"
              alert={!!stats && stats.expired > 0} />
          </div>

          {/* Stock Position Table */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Warehouse className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Estoque Atual</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingStock ? <LoadingSkeleton /> : !stock?.length ? (
                <EmptyState text="Nenhuma posição de estoque registrada." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>EPI</TableHead>
                      <TableHead>Almoxarifado</TableHead>
                      <TableHead className="text-right">Disponível</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                      <TableHead className="text-right">Custo Médio</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stock.map((item, i) => {
                      const risk = item.quantidade_disponivel === 0 ? 'critico'
                        : item.quantidade_disponivel <= item.quantidade_minima ? 'alto'
                        : item.quantidade_disponivel <= item.quantidade_minima * 1.5 ? 'medio' : 'baixo';
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{item.epi_nome}</TableCell>
                          <TableCell className="text-muted-foreground">{item.warehouse_name}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">{item.quantidade_disponivel}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{item.quantidade_minima}</TableCell>
                          <TableCell className="text-right tabular-nums">R$ {Number(item.custo_unitario_medio).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className={RISK_BADGE[risk]}>{risk === 'critico' ? 'Sem estoque' : risk === 'alto' ? 'Baixo' : risk === 'medio' ? 'Atenção' : 'OK'}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Lots by Expiry + Cost by Department */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Lotes por Validade</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                {loadingLots ? <LoadingSkeleton /> : !lotExpiry?.length ? (
                  <EmptyState text="Nenhum lote registrado." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={lotExpiry} dataKey="total" nameKey="status" cx="50%" cy="50%" outerRadius={90}
                        label={({ status, total }) => `${LOT_LABELS[status] ?? status}: ${total}`}>
                        {lotExpiry.map((entry, i) => (
                          <Cell key={i} fill={LOT_COLORS[entry.status] ?? 'hsl(220, 10%, 60%)'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number, name: string) => [v, LOT_LABELS[name] ?? name]} />
                      <Legend formatter={(value: string) => LOT_LABELS[value] ?? value} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Custo Mensal por Setor</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                {loadingCost ? <LoadingSkeleton /> : !costChartData.length ? (
                  <EmptyState text="Nenhum custo registrado." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costChartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tickFormatter={(v: number) => `R$${v.toLocaleString('pt-BR')}`} />
                      <YAxis type="category" dataKey="department" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Custo']} />
                      <Bar dataKey="custo" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Assets In Use */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">EPIs em Uso por Colaborador</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAssets ? <LoadingSkeleton /> : !assetsInUse?.length ? (
                <EmptyState text="Nenhum ativo rastreado em uso." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>EPI</TableHead>
                      <TableHead>Nº Série</TableHead>
                      <TableHead>Entrega</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assetsInUse.map((a) => (
                      <TableRow key={a.asset_id}>
                        <TableCell className="font-medium">{a.employee_name}</TableCell>
                        <TableCell>{a.epi_nome}</TableCell>
                        <TableCell className="font-mono text-sm">{a.serial_number}</TableCell>
                        <TableCell className="text-muted-foreground">{a.data_entrega ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TENANT TAB ═══ */}
        <TabsContent value="tenant" className="space-y-6 mt-4">
          {/* Compliance Ranking */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Ranking Compliance EPI por Empresa</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRanking ? <LoadingSkeleton /> : !ranking?.length ? (
                <EmptyState text="Nenhuma empresa com entregas de EPI." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-center">Entregues</TableHead>
                      <TableHead className="text-center">Vencidos</TableHead>
                      <TableHead className="text-center">Sem Assinatura</TableHead>
                      <TableHead className="text-center">Compliance</TableHead>
                      <TableHead className="w-[120px]">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.map((row, idx) => (
                      <TableRow key={row.company_id}>
                        <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{row.company_name}</TableCell>
                        <TableCell className="text-center">{row.total_delivered}</TableCell>
                        <TableCell className="text-center">
                          {row.expired > 0 ? <span className="text-destructive font-semibold">{row.expired}</span> : <span className="text-muted-foreground">0</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.unsigned > 0 ? <span className="text-orange-600 font-semibold">{row.unsigned}</span> : <span className="text-muted-foreground">0</span>}
                        </TableCell>
                        <TableCell className="text-center">{complianceBadge(row.compliance_pct)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={row.compliance_pct} className="h-2 flex-1" />
                            <span className="text-xs font-semibold tabular-nums w-8 text-right">{row.compliance_pct}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Cost Ranking by Company */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Ranking de Custo EPI por Empresa</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCostRank ? <LoadingSkeleton /> : !costRanking?.length ? (
                <EmptyState text="Nenhum custo registrado." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead className="text-right">Itens</TableHead>
                      <TableHead className="text-right">Colaboradores</TableHead>
                      <TableHead className="text-right">Custo/Colaborador</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costRanking.map((row, idx) => (
                      <TableRow key={row.company_id}>
                        <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{row.company_name}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">R$ {Number(row.custo_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.total_itens}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.total_colaboradores}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          R$ {row.total_colaboradores > 0 ? (Number(row.custo_total) / Number(row.total_colaboradores)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Stock Rupture Risk */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-lg">Risco de Ruptura de Estoque</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRupture ? <LoadingSkeleton /> : !ruptureRisk?.length ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum item com risco de ruptura.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>EPI</TableHead>
                      <TableHead>Almoxarifado</TableHead>
                      <TableHead className="text-right">Disponível</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                      <TableHead className="text-right">Cobertura (dias)</TableHead>
                      <TableHead>Risco</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ruptureRisk.map((r) => (
                      <TableRow key={r.inventory_id}>
                        <TableCell className="font-medium">{r.epi_nome}</TableCell>
                        <TableCell className="text-muted-foreground">{r.warehouse_name}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{r.quantidade_disponivel}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{r.quantidade_minima}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.dias_cobertura >= 999 ? '∞' : r.dias_cobertura}</TableCell>
                        <TableCell>
                          <Badge className={RISK_BADGE[r.risco] ?? RISK_BADGE.baixo}>
                            {r.risco === 'critico' ? 'Crítico' : r.risco === 'alto' ? 'Alto' : r.risco === 'medio' ? 'Médio' : 'Baixo'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Shared Components ──

function KpiCard({ title, value, loading, icon, description, alert, warn }: {
  title: string; value?: number; loading: boolean; icon: React.ReactNode;
  description: string; alert?: boolean; warn?: boolean;
}) {
  return (
    <Card className={alert ? 'border-destructive/40' : warn ? 'border-yellow-500/40' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-3xl font-bold tabular-nums text-foreground">{value ?? 0}</p>}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-4 text-center">{text}</p>;
}
