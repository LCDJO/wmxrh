/**
 * Documentos Assinados Section — Ficha do Trabalhador
 *
 * Shows signed employee agreements from the Employee Agreement Engine.
 */
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { FileCheck, Clock, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  employeeId: string;
  tenantId: string;
}

export function SignedDocumentsSection({ employeeId, tenantId }: Props) {
  const { data: agreements = [], isLoading } = useQuery({
    queryKey: ['employee_signed_docs', employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_agreements')
        .select('*, agreement_templates(name, category)')
        .eq('employee_id', employeeId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-4">Carregando documentos assinados...</p>;
  }

  if (agreements.length === 0) {
    return (
      <div className="text-center py-8">
        <FileCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum documento assinado encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {agreements.map((agreement: any) => (
        <div
          key={agreement.id}
          className="flex items-center gap-3 rounded-lg border border-border p-3"
        >
          <FileCheck className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-card-foreground truncate">
              {agreement.agreement_templates?.name || 'Documento'}
            </p>
            <p className="text-xs text-muted-foreground">
              {agreement.agreement_templates?.category || 'Geral'}
            </p>
          </div>
          <Badge
            variant={agreement.status === 'signed' ? 'default' : agreement.status === 'pending' ? 'outline' : 'secondary'}
            className="text-xs shrink-0"
          >
            {agreement.status === 'signed' ? 'Assinado' : agreement.status === 'pending' ? 'Pendente' : agreement.status}
          </Badge>
          <span className="text-xs text-muted-foreground shrink-0">
            {agreement.signed_at
              ? format(new Date(agreement.signed_at), 'dd/MM/yyyy', { locale: ptBR })
              : agreement.created_at
                ? format(new Date(agreement.created_at), 'dd/MM/yyyy', { locale: ptBR })
                : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
