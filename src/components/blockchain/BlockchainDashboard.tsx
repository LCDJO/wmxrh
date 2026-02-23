/**
 * Blockchain Registry Dashboard — Internal Company View
 *
 * Shows: registered documents, registration failures, cost per registration.
 */
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/contexts/TenantContext';
import { blockchainRegistryService } from '@/domains/blockchain-registry';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, CheckCircle, Clock, DollarSign, FileCheck, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Simulated cost per anchor (in BRL) — replace with real provider pricing
const COST_PER_REGISTRATION_BRL = 0.12;

export function BlockchainDashboard() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  // Stats from blockchain_hash_registry
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['blockchain_stats', tenantId],
    queryFn: () => blockchainRegistryService.getStats(tenantId!),
    enabled: !!tenantId,
  });

  // Queue failures (dead_letter + failed)
  const { data: queueStats, isLoading: queueLoading } = useQuery({
    queryKey: ['blockchain_queue_stats', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('blockchain_anchor_queue')
        .select('status, attempt_count, last_error, hash_sha256, signed_document_id, created_at, updated_at')
        .eq('tenant_id', tenantId!)
        .in('status', ['failed', 'dead_letter'])
        .order('updated_at', { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Recent registrations
  const { data: recentProofs = [], isLoading: proofsLoading } = useQuery({
    queryKey: ['blockchain_recent', tenantId],
    queryFn: () => blockchainRegistryService.listByTenant(tenantId!, 10),
    enabled: !!tenantId,
  });

  const isLoading = statsLoading || queueLoading || proofsLoading;
  const totalCost = (stats?.confirmed ?? 0) * COST_PER_REGISTRATION_BRL;
  const failedCount = (queueStats ?? []).length;

  if (!tenantId) {
    return <p className="text-sm text-muted-foreground">Selecione um tenant.</p>;
  }

  return (
    <div className="space-y-6">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Documentos Registrados"
          value={stats?.total ?? 0}
          icon={<FileCheck className="h-5 w-5" />}
          loading={isLoading}
          description="Total de hashes ancorados"
          variant="default"
        />
        <SummaryCard
          title="Confirmados"
          value={stats?.confirmed ?? 0}
          icon={<CheckCircle className="h-5 w-5" />}
          loading={isLoading}
          description="Confirmados na blockchain"
          variant="success"
        />
        <SummaryCard
          title="Falhas de Registro"
          value={failedCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          loading={isLoading}
          description={`${stats?.pending ?? 0} pendentes na fila`}
          variant={failedCount > 0 ? 'destructive' : 'default'}
        />
        <SummaryCard
          title="Custo Total"
          value={`R$ ${totalCost.toFixed(2)}`}
          icon={<DollarSign className="h-5 w-5" />}
          loading={isLoading}
          description={`R$ ${COST_PER_REGISTRATION_BRL.toFixed(2)} por registro`}
          variant="default"
        />
      </div>

      {/* ── Recent Registrations ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            Registros Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {proofsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : recentProofs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro encontrado.</p>
          ) : (
            <div className="space-y-2">
              {recentProofs.map((proof) => (
                <div key={proof.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <StatusIcon status={proof.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-muted-foreground truncate">
                      {proof.hash_sha256.slice(0, 16)}...{proof.hash_sha256.slice(-8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {proof.blockchain_network} • Bloco {proof.block_number ?? '—'}
                    </p>
                  </div>
                  <Badge
                    variant={proof.status === 'confirmed' ? 'default' : proof.status === 'pending' ? 'outline' : 'destructive'}
                    className="text-xs shrink-0"
                  >
                    {proof.status === 'confirmed' ? 'Confirmado' : proof.status === 'pending' ? 'Pendente' : 'Falhou'}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(proof.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Failed Registrations ── */}
      {failedCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <XCircle className="h-4 w-4" />
              Falhas de Registro ({failedCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(queueStats ?? []).map((item: any) => (
                <div key={item.hash_sha256 + item.created_at} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                      {item.hash_sha256?.slice(0, 16)}...
                    </p>
                    <Badge variant={item.status === 'dead_letter' ? 'destructive' : 'outline'} className="text-xs">
                      {item.status === 'dead_letter' ? 'Dead Letter' : `Tentativa ${item.attempt_count}/5`}
                    </Badge>
                  </div>
                  <p className="text-xs text-destructive/80 truncate">{item.last_error || 'Erro desconhecido'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.updated_at && format(new Date(item.updated_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Helper Components ──

function SummaryCard({
  title, value, icon, loading, description, variant,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  loading: boolean;
  description: string;
  variant: 'default' | 'success' | 'destructive';
}) {
  const colorMap = {
    default: 'text-primary',
    success: 'text-emerald-600 dark:text-emerald-400',
    destructive: 'text-destructive',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <span className={colorMap[variant]}>{icon}</span>
        </div>
        <p className={`text-2xl font-bold ${colorMap[variant]}`}>
          {loading ? '—' : value}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'confirmed') return <CheckCircle className="h-4 w-4 text-primary shrink-0" />;
  if (status === 'pending') return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
  return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
}
