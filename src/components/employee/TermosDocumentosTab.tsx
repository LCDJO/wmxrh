/**
 * TermosDocumentosTab — Employee Profile Tab
 *
 * Sections:
 *   - Pendentes de assinatura
 *   - Em andamento (sent)
 *   - Assinados
 */

import { useState } from 'react';
import { FileText, Clock, CheckCircle2, XCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useQueryScope } from '@/domains/hooks';
import { useToast } from '@/hooks/use-toast';

interface Props {
  employeeId: string;
}

interface AgreementRow {
  id: string;
  status: string;
  sent_at: string | null;
  signed_at: string | null;
  signed_document_url: string | null;
  external_signing_url: string | null;
  signature_provider: string | null;
  expires_at: string | null;
  created_at: string;
  template: {
    name: string;
    category: string;
    is_mandatory: boolean;
  } | null;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: 'Pendente', icon: AlertTriangle, className: 'bg-chart-3/10 text-chart-3' },
  sent: { label: 'Enviado', icon: Clock, className: 'bg-primary/10 text-primary' },
  signed: { label: 'Assinado', icon: CheckCircle2, className: 'bg-chart-2/10 text-chart-2' },
  rejected: { label: 'Rejeitado', icon: XCircle, className: 'bg-destructive/10 text-destructive' },
  expired: { label: 'Expirado', icon: XCircle, className: 'bg-muted text-muted-foreground' },
};

const categoryLabels: Record<string, string> = {
  geral: 'Geral',
  funcao: 'Função',
  empresa: 'Empresa',
  risco: 'Risco',
};

export function TermosDocumentosTab({ employeeId }: Props) {
  const qs = useQueryScope();
  const { toast } = useToast();

  const { data: agreements = [], isLoading } = useQuery({
    queryKey: ['employee_agreements', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_agreements')
        .select(`
          id, status, sent_at, signed_at, signed_document_url,
          external_signing_url, signature_provider, expires_at, created_at,
          template:agreement_templates!employee_agreements_template_id_fkey(name, category, is_mandatory)
        `)
        .eq('employee_id', employeeId)
        .eq('tenant_id', qs!.tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        template: Array.isArray(row.template) ? row.template[0] : row.template,
      })) as AgreementRow[];
    },
    enabled: !!qs,
  });

  const pending = agreements.filter(a => a.status === 'pending');
  const sent = agreements.filter(a => a.status === 'sent');
  const signed = agreements.filter(a => a.status === 'signed');
  const others = agreements.filter(a => !['pending', 'sent', 'signed'].includes(a.status));

  const handleOpenDoc = async (url: string) => {
    const { data, error } = await supabase.storage
      .from('signed-documents')
      .createSignedUrl(url, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    } else {
      toast({ title: 'Erro', description: 'Não foi possível abrir o documento.', variant: 'destructive' });
    }
  };

  const renderAgreementCard = (agr: AgreementRow) => {
    const config = statusConfig[agr.status] || statusConfig.pending;
    const StatusIcon = config.icon;

    return (
      <div key={agr.id} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors">
        <div className="flex items-start gap-3 min-w-0">
          <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-card-foreground truncate">
              {agr.template?.name || 'Termo'}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${config.className}`}>
                <StatusIcon className="h-3 w-3" />
                {config.label}
              </span>
              {agr.template?.category && (
                <span className="text-xs text-muted-foreground">
                  {categoryLabels[agr.template.category] || agr.template.category}
                </span>
              )}
              {agr.template?.is_mandatory && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Obrigatório</Badge>
              )}
              {agr.signature_provider && (
                <span className="text-xs text-muted-foreground capitalize">{agr.signature_provider}</span>
              )}
            </div>
            <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
              {agr.sent_at && <span>Enviado: {new Date(agr.sent_at).toLocaleDateString('pt-BR')}</span>}
              {agr.signed_at && <span>Assinado: {new Date(agr.signed_at).toLocaleDateString('pt-BR')}</span>}
              {agr.expires_at && (
                <span className={new Date(agr.expires_at) < new Date() ? 'text-destructive font-semibold' : ''}>
                  Expira: {new Date(agr.expires_at).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1 shrink-0 ml-3">
          {agr.external_signing_url && agr.status !== 'signed' && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => window.open(agr.external_signing_url!, '_blank')}>
              <ExternalLink className="h-3.5 w-3.5" />
              Assinar
            </Button>
          )}
          {agr.signed_document_url && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => handleOpenDoc(agr.signed_document_url!)}>
              <FileText className="h-3.5 w-3.5" />
              Ver PDF
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderSection = (title: string, items: AgreementRow[], icon: typeof Clock, emptyText: string) => (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {(() => { const Icon = icon; return <Icon className="h-4 w-4 text-muted-foreground" />; })()}
        <h4 className="text-sm font-semibold text-card-foreground">{title} ({items.length})</h4>
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map(renderAgreementCard)}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">{emptyText}</p>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl shadow-card p-6">
        <p className="text-sm text-muted-foreground text-center py-8">Carregando termos...</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-card p-6 space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold font-display text-card-foreground">
          Termos e Documentos ({agreements.length})
        </h3>
      </div>

      {renderSection('Pendentes de Assinatura', pending, AlertTriangle, 'Nenhum termo pendente.')}
      {renderSection('Em Andamento', sent, Clock, 'Nenhum termo em andamento.')}
      {renderSection('Assinados', signed, CheckCircle2, 'Nenhum termo assinado.')}
      {others.length > 0 && renderSection('Rejeitados / Expirados', others, XCircle, '')}
    </div>
  );
}
