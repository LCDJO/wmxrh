/**
 * EPI Dashboard — Company & Tenant-level EPI compliance overview
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, AlertTriangle, Package, FileWarning, PenTool, Trophy } from 'lucide-react';
import { useEpiCompanyStats, useEpiCompanyRanking } from '@/hooks/useEpiDashboard';

function complianceBadge(pct: number) {
  if (pct >= 90) return <Badge className="bg-green-600/15 text-green-700 border-green-600/30">Excelente</Badge>;
  if (pct >= 70) return <Badge className="bg-yellow-600/15 text-yellow-700 border-yellow-600/30">Bom</Badge>;
  if (pct >= 50) return <Badge className="bg-orange-600/15 text-orange-700 border-orange-600/30">Regular</Badge>;
  return <Badge variant="destructive">Crítico</Badge>;
}

export default function EpiDashboard() {
  const { data: stats, isLoading: loadingStats } = useEpiCompanyStats();
  const { data: ranking, isLoading: loadingRanking } = useEpiCompanyRanking();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard EPI</h1>
        <p className="text-muted-foreground text-sm">
          Visão geral de conformidade de Equipamentos de Proteção Individual
        </p>
      </div>

      {/* ── Company-level KPI Cards ── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="EPIs Entregues"
          value={stats?.total_delivered}
          loading={loadingStats}
          icon={<Package className="h-4 w-4 text-primary" />}
          description="Ativos com status entregue"
        />
        <KpiCard
          title="EPIs Vencidos"
          value={stats?.expired}
          loading={loadingStats}
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          description="Validade expirada"
          alert={!!stats && stats.expired > 0}
        />
        <KpiCard
          title="CAs Próximos do Vencimento"
          value={stats?.near_expiry_cas}
          loading={loadingStats}
          icon={<FileWarning className="h-4 w-4 text-yellow-600" />}
          description="Vencem em até 30 dias"
          warn={!!stats && stats.near_expiry_cas > 0}
        />
        <KpiCard
          title="Sem Assinatura"
          value={stats?.unsigned_deliveries}
          loading={loadingStats}
          icon={<PenTool className="h-4 w-4 text-orange-600" />}
          description="Entregas sem comprovante assinado"
          warn={!!stats && stats.unsigned_deliveries > 0}
        />
      </div>

      {/* ── Tenant-level: Ranking by Company ── */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Ranking de Compliance EPI por Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRanking ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !ranking?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma empresa com entregas de EPI registradas.
            </p>
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
                      {row.expired > 0 ? (
                        <span className="text-destructive font-semibold">{row.expired}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.unsigned > 0 ? (
                        <span className="text-orange-600 font-semibold">{row.unsigned}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
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
    </div>
  );
}

// ── KPI Card ──

function KpiCard({
  title,
  value,
  loading,
  icon,
  description,
  alert,
  warn,
}: {
  title: string;
  value?: number;
  loading: boolean;
  icon: React.ReactNode;
  description: string;
  alert?: boolean;
  warn?: boolean;
}) {
  return (
    <Card className={alert ? 'border-destructive/40' : warn ? 'border-yellow-500/40' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-3xl font-bold tabular-nums text-foreground">{value ?? 0}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
