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
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { downloadLGPDLogs, isICPBrasilAvailable, isBlockchainAvailable } from '@/domains/document-validation';
import {
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  Eye,
  BarChart3,
  Clock,
  Download,
  Link2,
  Fingerprint,
  Blocks,
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

      {/* LGPD Export + Future Capabilities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LGPD Export */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              Exportação LGPD
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Exporte todos os registros de acesso para auditoria conforme a Lei 13.709/2018.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!tenantId) return;
                  try {
                    await downloadLGPDLogs(tenantId, 'csv');
                    toast.success('Logs LGPD exportados em CSV');
                  } catch {
                    toast.error('Erro ao exportar logs');
                  }
                }}
              >
                <Download className="h-3 w-3 mr-1" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!tenantId) return;
                  try {
                    await downloadLGPDLogs(tenantId, 'json');
                    toast.success('Logs LGPD exportados em JSON');
                  } catch {
                    toast.error('Erro ao exportar logs');
                  }
                }}
              >
                <Download className="h-3 w-3 mr-1" />
                JSON
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Future Capabilities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Integrações futuras
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <FeatureRow
              icon={<Fingerprint className="h-4 w-4" />}
              label="Assinatura ICP-Brasil"
              available={isICPBrasilAvailable()}
              description="Certificado digital A1/A3 com carimbo de tempo"
            />
            <FeatureRow
              icon={<Blocks className="h-4 w-4" />}
              label="Blockchain Proof Hash"
              available={isBlockchainAvailable()}
              description="Âncora imutável em blockchain pública"
            />
            <FeatureRow
              icon={<Link2 className="h-4 w-4" />}
              label="API Pública"
              available={true}
              description="Endpoint GET/POST para validação automatizada"
            />
            <FeatureRow
              icon={<Download className="h-4 w-4" />}
              label="Exportação LGPD"
              available={true}
              description="CSV/JSON com todos os registros de acesso"
            />
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

function FeatureRow({
  icon,
  label,
  available,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  available: boolean;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/50">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <Badge
        variant="outline"
        className={`text-[10px] shrink-0 ${
          available
            ? 'border-primary/50 text-primary'
            : 'border-muted-foreground/30 text-muted-foreground'
        }`}
      >
        {available ? 'Ativo' : 'Em breve'}
      </Badge>
    </div>
  );
}
