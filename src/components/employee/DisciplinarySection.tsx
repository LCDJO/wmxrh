/**
 * Histórico Disciplinar Section
 *
 * Displays warnings (advertências), suspensions, and incidents
 * from Fleet Compliance Engine tables. Includes manual warning creation.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, AlertTriangle, Ban, FileWarning, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/core/use-toast';

interface Props {
  employeeId: string;
  tenantId: string;
}

function useEmployeeWarnings(employeeId: string, tenantId: string) {
  return useQuery({
    queryKey: ['employee_warnings', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_warnings')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('tenant_id', tenantId)
        .order('issued_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!employeeId && !!tenantId,
  });
}

function useEmployeeDisciplinaryHistory(employeeId: string, tenantId: string) {
  return useQuery({
    queryKey: ['employee_disciplinary_history', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_disciplinary_history')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!employeeId && !!tenantId,
  });
}

function useEmployeeComplianceIncidents(employeeId: string, tenantId: string) {
  return useQuery({
    queryKey: ['employee_compliance_incidents', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_compliance_incidents')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!employeeId && !!tenantId,
  });
}

const WARNING_TYPE_LABELS: Record<string, string> = {
  verbal: 'Verbal',
  written: 'Escrita',
  suspension: 'Suspensão',
  termination: 'Desligamento por Justa Causa',
};

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

export function DisciplinarySection({ employeeId, tenantId }: Props) {
  const { data: warnings = [], isLoading: l1 } = useEmployeeWarnings(employeeId, tenantId);
  const { data: history = [], isLoading: l2 } = useEmployeeDisciplinaryHistory(employeeId, tenantId);
  const { data: incidents = [], isLoading: l3 } = useEmployeeComplianceIncidents(employeeId, tenantId);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [warningType, setWarningType] = useState('verbal');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const isLoading = l1 || l2 || l3;

  const handleAddWarning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('fleet_warnings').insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        warning_type: warningType,
        description: description.trim(),
        signature_status: 'pending',
      } as any);
      if (error) throw error;
      toast({ title: 'Advertência registrada com sucesso!' });
      setAddOpen(false);
      setDescription('');
      setWarningType('verbal');
      queryClient.invalidateQueries({ queryKey: ['employee_warnings', employeeId] });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const advertencias = warnings.filter((w: any) => w.warning_type === 'verbal' || w.warning_type === 'written');
  const suspensoes = warnings.filter((w: any) => w.warning_type === 'suspension');

  return (
    <div className="space-y-6">
      {/* ── Advertências ── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-card-foreground">Advertências</h4>
          <Badge variant="secondary" className="ml-auto">{advertencias.length}</Badge>
          <Button variant="outline" size="sm" className="gap-1.5 ml-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Registrar Advertência
          </Button>
        </div>
        {advertencias.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma advertência registrada.</p>
        ) : (
          <div className="space-y-2">
            {advertencias.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-card-foreground">{w.description || 'Advertência'}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.issued_at ? new Date(w.issued_at).toLocaleDateString('pt-BR') : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {WARNING_TYPE_LABELS[w.warning_type] || w.warning_type}
                  </Badge>
                  {w.signature_status && (
                    <Badge variant={w.signature_status === 'signed' ? 'secondary' : 'outline'} className="text-xs">
                      {w.signature_status === 'signed' ? 'Assinado' : 'Pendente'}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Suspensões ── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Ban className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-card-foreground">Suspensões</h4>
          <Badge variant={suspensoes.length > 0 ? 'destructive' : 'secondary'} className="ml-auto">{suspensoes.length}</Badge>
        </div>
        {suspensoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma suspensão registrada.</p>
        ) : (
          <div className="space-y-2">
            {suspensoes.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-card-foreground">{w.description || 'Suspensão'}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.issued_at ? new Date(w.issued_at).toLocaleDateString('pt-BR') : '—'}
                  </p>
                </div>
                <Badge variant="destructive" className="text-xs">Suspensão</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Ocorrências (Compliance Incidents) ── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileWarning className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-card-foreground">Ocorrências</h4>
          <Badge variant="secondary" className="ml-auto">{incidents.length}</Badge>
        </div>
        {incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma ocorrência registrada.</p>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc: any) => (
              <div key={inc.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-card-foreground">{inc.violation_type || 'Ocorrência'}</p>
                  <p className="text-xs text-muted-foreground">
                    {inc.created_at ? new Date(inc.created_at).toLocaleDateString('pt-BR') : '—'}
                    {inc.notes ? ` — ${inc.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {inc.severity && (
                    <Badge
                      variant={inc.severity === 'critical' || inc.severity === 'high' ? 'destructive' : 'outline'}
                      className="text-xs"
                    >
                      {SEVERITY_LABELS[inc.severity] || inc.severity}
                    </Badge>
                  )}
                  <Badge variant={inc.status === 'resolved' ? 'secondary' : 'outline'} className="text-xs">
                    {inc.status === 'resolved' ? 'Resolvido' : inc.status === 'pending' ? 'Pendente' : inc.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Timeline from fleet_disciplinary_history ── */}
      {history.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileWarning className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-semibold text-card-foreground">Histórico Disciplinar (Fleet)</h4>
            <Badge variant="secondary" className="ml-auto">{history.length}</Badge>
          </div>
          <div className="space-y-2">
            {history.map((h: any) => (
              <div key={h.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-card-foreground">{h.event_type || h.description || 'Evento'}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.created_at ? new Date(h.created_at).toLocaleDateString('pt-BR') : '—'}
                    {h.description && h.event_type ? ` — ${h.description}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Add Warning Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Advertência</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddWarning} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={warningType} onValueChange={setWarningType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="verbal">Advertência Verbal</SelectItem>
                  <SelectItem value="written">Advertência Escrita</SelectItem>
                  <SelectItem value="suspension">Suspensão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição / Motivo *</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descreva o motivo da advertência..."
                rows={3}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving || !description.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar Advertência
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
