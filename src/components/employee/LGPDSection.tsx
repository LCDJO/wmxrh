/**
 * LGPD Section — Ficha do Trabalhador
 *
 * Shows: access logs, legal basis, anonymization controls, retention info.
 */
import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Eye, Clock, Shield, AlertTriangle, FileText, UserX, CheckCircle } from 'lucide-react';
import { lgpdService, DEFAULT_LEGAL_BASIS } from '@/domains/security';
import type { DataAccessLog, LegalBasisRecord, AnonymizationRequest } from '@/domains/security';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  employeeId: string;
  tenantId: string;
  terminationDate?: string | null;
}

const ACCESS_TYPE_LABELS: Record<string, string> = {
  view: 'Visualização',
  edit: 'Edição',
  export: 'Exportação',
  print: 'Impressão',
  anonymize: 'Anonimização',
};

const LEGAL_BASIS_TYPE_LABELS: Record<string, string> = {
  consent: 'Consentimento',
  legal_obligation: 'Obrigação Legal',
  contract_execution: 'Execução de Contrato',
  legitimate_interest: 'Interesse Legítimo',
  public_interest: 'Interesse Público',
  vital_interest: 'Proteção da Vida',
};

export function LGPDSection({ employeeId, tenantId, terminationDate }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Log access on mount
  useEffect(() => {
    lgpdService.logAccess({
      tenantId,
      employeeId,
      accessType: 'view',
      dataScope: 'lgpd_tab',
    });
  }, [tenantId, employeeId]);

  // Access logs
  const { data: accessLogs = [] } = useQuery({
    queryKey: ['lgpd_access_logs', employeeId],
    queryFn: () => lgpdService.getAccessLogs(tenantId, employeeId),
  });

  // Legal basis
  const { data: legalBasis = [] } = useQuery({
    queryKey: ['lgpd_legal_basis', tenantId],
    queryFn: async () => {
      const existing = await lgpdService.getLegalBasis(tenantId);
      if (existing.length === 0) {
        await lgpdService.seedDefaultLegalBasis(tenantId);
        return lgpdService.getLegalBasis(tenantId);
      }
      return existing;
    },
  });

  // Anonymization requests
  const { data: anonRequests = [] } = useQuery({
    queryKey: ['lgpd_anon_requests', employeeId],
    queryFn: () => lgpdService.getAnonymizationRequests(tenantId, employeeId),
  });

  // Retention info
  const retentionInfo = useMemo(
    () => lgpdService.getRetentionInfo(terminationDate || null),
    [terminationDate],
  );

  // Request anonymization
  const anonMutation = useMutation({
    mutationFn: () =>
      lgpdService.requestAnonymization({
        tenantId,
        employeeId,
        reason: 'Solicitação do titular — LGPD Art. 18, IV',
      }),
    onSuccess: () => {
      toast({ title: 'Solicitação registrada', description: 'Solicitação de anonimização criada com sucesso.' });
      queryClient.invalidateQueries({ queryKey: ['lgpd_anon_requests', employeeId] });
    },
  });

  const displayBasis = legalBasis.length > 0 ? legalBasis : DEFAULT_LEGAL_BASIS.map((b, i) => ({ ...b, id: `default-${i}`, tenant_id: tenantId, is_active: true }));

  return (
    <div className="space-y-6">
      {/* Retention Banner */}
      {terminationDate && (
        <Card className={retentionInfo.expired ? 'border-destructive/50' : 'border-border'}>
          <CardContent className="flex items-center gap-3 py-3">
            <Clock className={`h-5 w-5 shrink-0 ${retentionInfo.expired ? 'text-destructive' : 'text-muted-foreground'}`} />
            <div className="flex-1">
              {retentionInfo.expired ? (
                <p className="text-sm font-medium text-destructive">
                  Prazo de retenção expirado. Dados elegíveis para anonimização.
                </p>
              ) : (
                <p className="text-sm text-card-foreground">
                  Retenção obrigatória até <strong>{retentionInfo.expiryDate}</strong>
                  {retentionInfo.remainingDays && retentionInfo.remainingDays > 0 && (
                    <span className="text-muted-foreground"> ({retentionInfo.remainingDays} dias restantes)</span>
                  )}
                </p>
              )}
            </div>
            {retentionInfo.expired && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => anonMutation.mutate()}
                disabled={anonMutation.isPending || anonRequests.some(r => r.status === 'pending')}
              >
                <UserX className="h-4 w-4 mr-1" />
                Solicitar Anonimização
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Anonymization Requests */}
      {anonRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserX className="h-4 w-4" />
              Solicitações de Anonimização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {anonRequests.map((req) => (
                <div key={req.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                  <Badge variant={req.status === 'completed' ? 'default' : req.status === 'rejected' ? 'destructive' : 'outline'}>
                    {req.status === 'pending' ? 'Pendente' : req.status === 'approved' ? 'Aprovado' : req.status === 'processing' ? 'Processando' : req.status === 'completed' ? 'Concluído' : 'Rejeitado'}
                  </Badge>
                  <span className="text-sm text-card-foreground flex-1">{req.reason || req.legal_basis}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(req.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legal Basis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Base Legal do Tratamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {displayBasis.map((basis: any) => (
              <div key={basis.id || basis.data_category} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-card-foreground capitalize">
                    {basis.data_category.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {LEGAL_BASIS_TYPE_LABELS[basis.legal_basis_type] || basis.legal_basis_type}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {basis.lgpd_article}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{basis.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Retenção: {basis.retention_period_months} meses ({Math.round(basis.retention_period_months / 12)} anos)
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Access Logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Logs de Acesso à Ficha
            <Badge variant="secondary" className="text-xs">{accessLogs.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accessLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro de acesso encontrado.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {accessLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-muted/50 text-sm">
                  <Badge variant="outline" className="text-xs shrink-0">
                    {ACCESS_TYPE_LABELS[log.access_type] || log.access_type}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    {log.data_scope}
                    {log.accessed_fields.length > 0 && ` — ${log.accessed_fields.join(', ')}`}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
