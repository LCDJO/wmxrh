/**
 * Document Validation Dashboard — Internal analytics for tenant admins.
 *
 * Shows: total validations, top-accessed documents, suspicious attempts.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  Eye,
  BarChart3,
  Clock,
} from 'lucide-react';

interface AccessLogRow {
  id: string;
  token_id: string;
  tenant_id: string;
  accessed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  requester_name: string | null;
  requester_email: string | null;
  requester_purpose: string | null;
  access_result: string;
  signed_document_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface TokenRow {
  id: string;
  token: string;
  document_hash: string;
  status: string;
  document_vault_id: string;
}

export default function DocumentValidationDashboard() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  // Fetch all access logs
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['doc-validation-logs', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('document_access_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('accessed_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as AccessLogRow[];
    },
    enabled: !!tenantId,
  });

  // Fetch tokens for cross-referencing
  const { data: tokens = [] } = useQuery({
    queryKey: ['doc-validation-tokens', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('document_validation_tokens')
        .select('id, token, document_hash, status, document_vault_id')
        .eq('tenant_id', tenantId)
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as TokenRow[];
    },
    enabled: !!tenantId,
  });

  // Fetch rate limit blocks
  const { data: blockedIps = [] } = useQuery({
    queryKey: ['doc-validation-blocked'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('validation_rate_limits')
        .select('ip_address, blocked_until, failed_count')
        .not('blocked_until', 'is', null)
        .order('blocked_until', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // ── Derived stats ──
  const totalValidations = logs.length;
  const successfulValidations = logs.filter((l) => l.access_result === 'success').length;
  const failedValidations = totalValidations - successfulValidations;
  const suspiciousAttempts = logs.filter((l) =>
    ['invalid_token', 'hash_mismatch', 'revoked'].includes(l.access_result)
  );

  // Top accessed documents (by token_id frequency)
  const tokenAccessMap = new Map<string, number>();
  logs.forEach((l) => {
    if (l.access_result === 'success') {
      tokenAccessMap.set(l.token_id, (tokenAccessMap.get(l.token_id) || 0) + 1);
    }
  });
  const topDocuments = Array.from(tokenAccessMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tokenId, count]) => {
      const tk = tokens.find((t) => t.id === tokenId);
      return {
        tokenId,
        hash: tk?.document_hash?.slice(0, 16) ?? '—',
        status: tk?.status ?? 'unknown',
        count,
      };
    });

  // Recent suspicious (last 20)
  const recentSuspicious = suspiciousAttempts.slice(0, 20);

  if (!tenantId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Selecione um tenant para visualizar o dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Validação de Documentos</h1>
          <p className="text-sm text-muted-foreground">
            Monitoramento de validações públicas e tentativas suspeitas
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Eye className="h-4 w-4" />}
          label="Total de validações"
          value={totalValidations}
          loading={logsLoading}
        />
        <KpiCard
          icon={<FileCheck className="h-4 w-4" />}
          label="Validações bem-sucedidas"
          value={successfulValidations}
          accent="text-primary"
          loading={logsLoading}
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Tentativas inválidas"
          value={failedValidations}
          accent="text-destructive"
          loading={logsLoading}
        />
        <KpiCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="IPs bloqueados"
          value={blockedIps.length}
          accent="text-orange-500"
          loading={logsLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Documents */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Documentos mais acessados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma validação registrada ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {topDocuments.map((doc, i) => (
                  <div
                    key={doc.tokenId}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-5">
                        #{i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-mono truncate text-foreground">
                          {doc.hash}…
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] mt-0.5 ${
                            doc.status === 'active'
                              ? 'border-primary/50 text-primary'
                              : 'border-muted-foreground/50 text-muted-foreground'
                          }`}
                        >
                          {doc.status}
                        </Badge>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {doc.count} <span className="text-xs text-muted-foreground">acessos</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suspicious Attempts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Tentativas suspeitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentSuspicious.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma tentativa suspeita registrada.
              </p>
            ) : (
              <ScrollArea className="h-[320px]">
                <div className="space-y-2 pr-2">
                  {recentSuspicious.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className="text-[10px] border-destructive/50 text-destructive"
                        >
                          {resultLabel(log.access_result)}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(log.accessed_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {log.ip_address && (
                          <p>
                            IP: <span className="font-mono">{log.ip_address}</span>
                          </p>
                        )}
                        {log.requester_name && <p>Solicitante: {log.requester_name}</p>}
                        {log.requester_email && <p>Email: {log.requester_email}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function resultLabel(result: string): string {
  const map: Record<string, string> = {
    invalid_token: 'Token inválido',
    hash_mismatch: 'Hash adulterado',
    revoked: 'Revogado',
    expired: 'Expirado',
  };
  return map[result] ?? result;
}

function KpiCard({
  icon,
  label,
  value,
  accent,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center gap-2 mb-2 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div>
        {loading ? (
          <div className="h-8 w-16 bg-muted animate-pulse rounded" />
        ) : (
          <p className={`text-2xl font-bold ${accent ?? 'text-foreground'}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
