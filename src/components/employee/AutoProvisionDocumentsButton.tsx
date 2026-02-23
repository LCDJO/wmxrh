/**
 * AutoProvisionDocumentsButton — Automatically provisions agreement templates
 * based on the employee's position (cargo) and company.
 *
 * Logic:
 * 1. Fetch all active templates for the tenant
 * 2. Filter templates that apply to this employee:
 *    - Company-wide templates (no cargo_id, no applies_to_positions)
 *    - Position-specific templates (cargo_id matches or position is in applies_to_positions)
 *    - Department-specific templates (department is in applies_to_departments)
 * 3. Exclude templates already assigned to this employee
 * 4. Insert missing employee_agreements with status 'pending'
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileStack, CheckCircle2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  employeeId: string;
  tenantId: string;
  positionId?: string | null;
  departmentId?: string | null;
  companyId?: string | null;
}

interface TemplateMatch {
  id: string;
  name: string;
  category: string;
  is_mandatory: boolean;
  match_reason: string;
}

export function AutoProvisionDocumentsButton({ employeeId, tenantId, positionId, departmentId, companyId }: Props) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Fetch all active templates + already assigned template IDs
  const { data, isLoading } = useQuery({
    queryKey: ['auto_provision_templates', tenantId, employeeId, positionId],
    queryFn: async () => {
      const [templatesRes, assignedRes] = await Promise.all([
        supabase
          .from('agreement_templates')
          .select('id, name, category, is_mandatory, cargo_id, applies_to_positions, applies_to_departments, company_id, auto_send_on_admission')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .is('deleted_at', null),
        supabase
          .from('employee_agreements')
          .select('template_id')
          .eq('employee_id', employeeId)
          .eq('tenant_id', tenantId),
      ]);

      if (templatesRes.error) throw templatesRes.error;
      if (assignedRes.error) throw assignedRes.error;

      const assignedIds = new Set((assignedRes.data ?? []).map((a: any) => a.template_id));
      const templates = (templatesRes.data ?? []) as any[];

      const matches: TemplateMatch[] = [];

      for (const t of templates) {
        if (assignedIds.has(t.id)) continue;

        // Company-specific template — skip if different company
        if (t.company_id && t.company_id !== companyId) continue;

        let matchReason = '';

        // 1. Position-specific: cargo_id matches
        if (t.cargo_id && t.cargo_id === positionId) {
          matchReason = 'Específico do cargo';
        }
        // 2. Position in applies_to_positions array
        else if (positionId && t.applies_to_positions?.length > 0 && t.applies_to_positions.includes(positionId)) {
          matchReason = 'Aplicável ao cargo';
        }
        // 3. Department in applies_to_departments array
        else if (departmentId && t.applies_to_departments?.length > 0 && t.applies_to_departments.includes(departmentId)) {
          matchReason = 'Aplicável ao departamento';
        }
        // 4. General template (no specific targeting)
        else if (!t.cargo_id && (!t.applies_to_positions || t.applies_to_positions.length === 0) && (!t.applies_to_departments || t.applies_to_departments.length === 0)) {
          matchReason = 'Documento padrão da empresa';
        }
        else {
          continue; // Not applicable
        }

        matches.push({
          id: t.id,
          name: t.name,
          category: t.category,
          is_mandatory: t.is_mandatory,
          match_reason: matchReason,
        });
      }

      return matches;
    },
    enabled: open,
  });

  const provisionMutation = useMutation({
    mutationFn: async (templateIds: string[]) => {
      // Get the current version for each template
      const { data: versions, error: vErr } = await supabase
        .from('agreement_template_versions')
        .select('id, template_id')
        .in('template_id', templateIds)
        .eq('tenant_id', tenantId)
        .eq('is_current', true);

      if (vErr) throw vErr;

      const versionMap = new Map((versions ?? []).map((v: any) => [v.template_id, v.id]));

      const inserts = templateIds
        .filter(tid => versionMap.has(tid))
        .map(tid => ({
          tenant_id: tenantId,
          company_id: companyId ?? null,
          employee_id: employeeId,
          template_id: tid,
          template_version_id: versionMap.get(tid)!,
          status: 'pending',
        }));

      if (inserts.length === 0) {
        throw new Error('Nenhum template com versão ativa encontrado.');
      }

      const { error } = await supabase.from('employee_agreements').insert(inserts);
      if (error) throw error;

      return inserts.length;
    },
    onSuccess: (count) => {
      toast({ title: 'Documentos gerados', description: `${count} documento(s) adicionado(s) com sucesso.` });
      qc.invalidateQueries({ queryKey: ['employee_agreements', employeeId] });
      setOpen(false);
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  const matches = data ?? [];
  const mandatory = matches.filter(m => m.is_mandatory);
  const optional = matches.filter(m => !m.is_mandatory);

  const categoryLabels: Record<string, string> = {
    geral: 'Geral', funcao: 'Função', empresa: 'Empresa', risco: 'Risco',
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <FileStack className="h-3.5 w-3.5" /> Gerar Documentos do Cargo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Provisionar Documentos Legais</DialogTitle>
          <DialogDescription>
            Documentos padrão da empresa e específicos do cargo serão adicionados automaticamente.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Todos os documentos aplicáveis já foram atribuídos.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {mandatory.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-card-foreground mb-2">Obrigatórios ({mandatory.length})</h4>
                <div className="space-y-2">
                  {mandatory.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-start gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-card-foreground truncate">{m.name}</p>
                          <div className="flex gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{categoryLabels[m.category] || m.category}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{m.match_reason}</Badge>
                          </div>
                        </div>
                      </div>
                      <Badge variant="destructive" className="text-[10px] shrink-0">Obrigatório</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {optional.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-card-foreground mb-2">Opcionais ({optional.length})</h4>
                <div className="space-y-2">
                  {optional.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-start gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-card-foreground truncate">{m.name}</p>
                          <div className="flex gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{categoryLabels[m.category] || m.category}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{m.match_reason}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => provisionMutation.mutate(matches.map(m => m.id))}
              disabled={provisionMutation.isPending}
            >
              {provisionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar {matches.length} documento(s)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
