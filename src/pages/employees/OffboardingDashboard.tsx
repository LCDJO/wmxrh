/**
 * OffboardingDashboard — Automated Offboarding Workflow Engine
 *
 * Main page for managing employee offboarding workflows.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryScope } from '@/domains/hooks';
import { offboardingService } from '@/domains/automated-offboarding';
import type { OffboardingWorkflow, CreateOffboardingDTO, OffboardingType, AvisoPrevioType, ChecklistItemStatus } from '@/domains/automated-offboarding';
import { OFFBOARDING_TYPE_LABELS, OFFBOARDING_STATUS_LABELS, CHECKLIST_CATEGORY_LABELS, AVISO_PREVIO_LABELS } from '@/domains/automated-offboarding';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/core/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  UserMinus, Plus, Eye, CheckCircle2, Clock, AlertTriangle, XCircle,
  ClipboardList, FileText, Send, Ban, ChevronRight, Loader2, Award
} from 'lucide-react';

// ── Status badge colors ──
const statusBadge: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  draft: { variant: 'secondary' },
  validation: { variant: 'default', className: 'bg-primary/80' },
  documents_pending: { variant: 'outline', className: 'border-chart-3 text-chart-3' },
  esocial_pending: { variant: 'outline', className: 'border-chart-4 text-chart-4' },
  archived: { variant: 'destructive' },
  completed: { variant: 'default', className: 'bg-chart-2' },
};

export default function OffboardingDashboard() {
  const qs = useQueryScope();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailWorkflow, setDetailWorkflow] = useState<OffboardingWorkflow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OffboardingWorkflow | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // ── Workflows list ──
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['offboarding_workflows', qs?.tenantId],
    queryFn: () => offboardingService.list(qs!.tenantId),
    enabled: !!qs,
  });

  // ── Employees for selector ──
  const { data: employees = [] } = useQuery({
    queryKey: ['employees_for_offboarding', qs?.tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, name, email, cpf')
        .eq('tenant_id', qs!.tenantId)
        .eq('status', 'active')
        .order('name');
      return data || [];
    },
    enabled: !!qs,
  });

  // ── Stats ──
  const active = workflows.filter(w => ['draft', 'validation', 'documents_pending', 'esocial_pending'].includes(w.status));
  const completed = workflows.filter(w => w.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserMinus className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Desligamento Automatizado</h1>
            <p className="text-sm text-muted-foreground">Gerencie o processo completo de offboarding do colaborador</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Desligamento
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-primary/60" />
          <div>
            <p className="text-2xl font-bold text-foreground">{workflows.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <Clock className="h-8 w-8 text-chart-3/60" />
          <div>
            <p className="text-2xl font-bold text-foreground">{active.length}</p>
            <p className="text-xs text-muted-foreground">Em Andamento</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-chart-2/60" />
          <div>
            <p className="text-2xl font-bold text-foreground">{completed.length}</p>
            <p className="text-xs text-muted-foreground">Concluídos</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive/60" />
          <div>
            <p className="text-2xl font-bold text-foreground">{workflows.filter(w => w.status === 'esocial_pending').length}</p>
            <p className="text-xs text-muted-foreground">eSocial Pendente</p>
          </div>
        </CardContent></Card>
      </div>

      {/* Workflows Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Processos de Desligamento</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : workflows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum processo de desligamento registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Desligamento</TableHead>
                  <TableHead>eSocial</TableHead>
                  <TableHead>Carta Ref.</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map(wf => {
                  const badge = statusBadge[wf.status] || statusBadge.draft;
                  return (
                    <TableRow key={wf.id} className="cursor-pointer hover:bg-accent/40" onClick={() => setDetailWorkflow(wf)}>
                      <TableCell className="font-medium">{wf.employee?.name || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{OFFBOARDING_TYPE_LABELS[wf.offboarding_type]}</Badge></TableCell>
                      <TableCell><Badge variant={badge.variant} className={badge.className}>{OFFBOARDING_STATUS_LABELS[wf.status]}</Badge></TableCell>
                      <TableCell className="text-sm">{new Date(wf.data_desligamento).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {wf.esocial_status === 'sent' ? '✔ Enviado' : wf.esocial_status === 'error' ? '✖ Erro' : '⏳ Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {wf.reference_letter_eligible ? (
                          <Badge variant="outline" className="text-[10px] text-chart-2 border-chart-2">Elegível</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDetailWorkflow(wf); }}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <CreateOffboardingDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        employees={employees}
        tenantId={qs?.tenantId || ''}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['offboarding_workflows'] });
          setCreateOpen(false);
        }}
      />

      {/* Detail Dialog */}
      {detailWorkflow && (
        <OffboardingDetailDialog
          workflow={detailWorkflow}
          tenantId={qs?.tenantId || ''}
          onClose={() => { setDetailWorkflow(null); qc.invalidateQueries({ queryKey: ['offboarding_workflows'] }); }}
          onCancel={() => { setCancelTarget(detailWorkflow); }}
        />
      )}

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) { setCancelTarget(null); setCancelReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar processo de desligamento</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo do cancelamento do desligamento de <strong>{cancelTarget?.employee?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label>Motivo *</Label>
            <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} placeholder="Descreva o motivo..." />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!cancelReason.trim()}
              className="bg-destructive text-destructive-foreground"
              onClick={async () => {
                try {
                  await offboardingService.cancel(cancelTarget!.id, qs!.tenantId, cancelReason);
                  toast({ title: 'Processo cancelado.' });
                  qc.invalidateQueries({ queryKey: ['offboarding_workflows'] });
                  setDetailWorkflow(null);
                } catch { toast({ title: 'Erro ao cancelar', variant: 'destructive' }); }
                setCancelTarget(null);
                setCancelReason('');
              }}
            >Cancelar Processo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ══════════════════════════════════════════
// Create Dialog
// ══════════════════════════════════════════

function CreateOffboardingDialog({ open, onOpenChange, employees, tenantId, onCreated }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employees: { id: string; name: string; email: string | null; cpf: string | null }[];
  tenantId: string;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [type, setType] = useState<OffboardingType>('sem_justa_causa');
  const [dataDesligamento, setDataDesligamento] = useState('');
  const [motivo, setMotivo] = useState('');
  const [avisoType, setAvisoType] = useState<AvisoPrevioType>('nao_aplicavel');
  const [avisoDays, setAvisoDays] = useState(30);
  const [justaCausaMotivo, setJustaCausaMotivo] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!employeeId || !dataDesligamento) return;
    setLoading(true);
    try {
      await offboardingService.create({
        tenant_id: tenantId,
        employee_id: employeeId,
        offboarding_type: type,
        motivo: motivo || undefined,
        data_desligamento: dataDesligamento,
        aviso_previo_type: avisoType,
        aviso_previo_days: avisoDays,
        justa_causa_motivo: type === 'justa_causa' ? justaCausaMotivo : undefined,
        notes: notes || undefined,
      });
      toast({ title: 'Processo de desligamento criado!' });
      onCreated();
      setEmployeeId('');
      setType('sem_justa_causa');
      setDataDesligamento('');
      setMotivo('');
      setNotes('');
    } catch {
      toast({ title: 'Erro ao criar processo', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Processo de Desligamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Colaborador *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Selecionar colaborador" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name} {e.cpf ? `(${e.cpf})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de Desligamento *</Label>
            <Select value={type} onValueChange={v => setType(v as OffboardingType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(OFFBOARDING_TYPE_LABELS) as [OffboardingType, string][]).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} placeholder="Motivo do desligamento..." />
          </div>
          <div className="space-y-1.5">
            <Label>Data de Desligamento *</Label>
            <Input type="date" value={dataDesligamento} onChange={e => setDataDesligamento(e.target.value)} />
          </div>
          {type !== 'justa_causa' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Aviso Prévio</Label>
                <Select value={avisoType} onValueChange={v => setAvisoType(v as AvisoPrevioType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(AVISO_PREVIO_LABELS) as [AvisoPrevioType, string][]).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Dias</Label>
                <Input type="number" min={0} value={avisoDays} onChange={e => setAvisoDays(Number(e.target.value))} />
              </div>
            </div>
          )}
          {type === 'justa_causa' && (
            <div className="space-y-1.5">
              <Label>Motivo Justa Causa (Art. 482 CLT) *</Label>
              <Textarea value={justaCausaMotivo} onChange={e => setJustaCausaMotivo(e.target.value)} rows={3} placeholder="Descreva o motivo da justa causa..." />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Observações opcionais..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={loading || !employeeId || !dataDesligamento}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Iniciar Desligamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════
// Detail Dialog (with checklist + reference letter)
// ══════════════════════════════════════════

function OffboardingDetailDialog({ workflow, tenantId, onClose, onCancel }: {
  workflow: OffboardingWorkflow;
  tenantId: string;
  onClose: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: checklist = [], isLoading: loadingChecklist } = useQuery({
    queryKey: ['offboarding_checklist', workflow.id],
    queryFn: () => offboardingService.getChecklist(workflow.id, tenantId),
  });

  const { data: letter } = useQuery({
    queryKey: ['offboarding_letter', workflow.id],
    queryFn: () => offboardingService.getReferenceLetter(workflow.id, tenantId),
  });

  const eligibility = offboardingService.assessReferenceLetterEligibility(workflow);

  const completedCount = checklist.filter(c => c.status === 'completed').length;
  const totalMandatory = checklist.filter(c => c.is_mandatory).length;
  const completedMandatory = checklist.filter(c => c.is_mandatory && c.status === 'completed').length;
  const progress = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;

  const handleToggleItem = async (item: typeof checklist[0]) => {
    const newStatus: ChecklistItemStatus = item.status === 'completed' ? 'pending' : 'completed';
    try {
      await offboardingService.updateChecklistItem(item.id, tenantId, newStatus);
      qc.invalidateQueries({ queryKey: ['offboarding_checklist', workflow.id] });
    } catch {
      toast({ title: 'Erro ao atualizar item', variant: 'destructive' });
    }
  };

  const handleAdvanceStatus = async () => {
    const nextStatus = workflow.status === 'draft' ? 'validation'
      : workflow.status === 'validation' ? 'documents_pending'
      : workflow.status === 'documents_pending' ? 'esocial_pending'
      : workflow.status === 'esocial_pending' ? 'completed'
      : null;
    if (!nextStatus) return;
    try {
      await offboardingService.updateStatus(workflow.id, tenantId, nextStatus as any);
      toast({ title: `Status atualizado para: ${OFFBOARDING_STATUS_LABELS[nextStatus as keyof typeof OFFBOARDING_STATUS_LABELS]}` });
      onClose();
    } catch {
      toast({ title: 'Erro ao avançar status', variant: 'destructive' });
    }
  };

  const categories = [...new Set(checklist.map(c => c.category))];

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-display">
            <UserMinus className="h-5 w-5 text-primary" />
            {workflow.employee?.name || 'Colaborador'}
            <Badge variant="outline" className="ml-2 text-xs">{OFFBOARDING_TYPE_LABELS[workflow.offboarding_type]}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Status:</span> <Badge variant={statusBadge[workflow.status]?.variant || 'secondary'} className={statusBadge[workflow.status]?.className}>{OFFBOARDING_STATUS_LABELS[workflow.status]}</Badge></div>
            <div><span className="text-muted-foreground">Data Desligamento:</span> {new Date(workflow.data_desligamento).toLocaleDateString('pt-BR')}</div>
            <div><span className="text-muted-foreground">Aviso Prévio:</span> {AVISO_PREVIO_LABELS[workflow.aviso_previo_type]} ({workflow.aviso_previo_days} dias)</div>
            <div><span className="text-muted-foreground">eSocial:</span> {workflow.esocial_status}</div>
            {workflow.motivo && (
              <div className="col-span-2"><span className="text-muted-foreground">Motivo:</span> {workflow.motivo}</div>
            )}
            {workflow.justa_causa_motivo && (
              <div className="col-span-2"><span className="text-muted-foreground">Motivo Justa Causa:</span> {workflow.justa_causa_motivo}</div>
            )}
            {workflow.notes && (
              <div className="col-span-2"><span className="text-muted-foreground">Obs:</span> {workflow.notes}</div>
            )}
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-card-foreground">Checklist ({completedCount}/{checklist.length})</span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            {totalMandatory > 0 && completedMandatory < totalMandatory && (
              <p className="text-xs text-chart-3">⚠ {totalMandatory - completedMandatory} item(ns) obrigatório(s) pendente(s)</p>
            )}
          </div>

          {/* Checklist by category */}
          {loadingChecklist ? (
            <div className="py-6 text-center text-muted-foreground text-sm">Carregando checklist...</div>
          ) : (
            categories.map(cat => (
              <div key={cat} className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {CHECKLIST_CATEGORY_LABELS[cat] || cat}
                </h4>
                {checklist.filter(c => c.category === cat).map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/30 transition-colors">
                    <Checkbox
                      checked={item.status === 'completed'}
                      onCheckedChange={() => handleToggleItem(item)}
                      disabled={workflow.status === 'completed' || workflow.status === 'archived'}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.status === 'completed' ? 'line-through text-muted-foreground' : 'text-card-foreground'}`}>
                        {item.title}
                        {item.is_mandatory && <span className="text-destructive ml-1">*</span>}
                        {item.is_automated && <Badge variant="outline" className="ml-2 text-[9px] px-1">Auto</Badge>}
                      </p>
                      {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
                    </div>
                    {item.completed_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(item.completed_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}

          {/* Reference Letter Eligibility */}
          <div className="border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-card-foreground">Carta de Referência</h4>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {eligibility.eligible ? (
                <Badge className="bg-chart-2/10 text-chart-2 border-chart-2" variant="outline">✔ Elegível ({eligibility.score}%)</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">✖ Não elegível ({eligibility.score}%)</Badge>
              )}
              {letter ? (
                <span className="text-xs text-muted-foreground">
                  {letter.approved === true ? '✔ Aprovada' : letter.approved === false ? '✖ Rejeitada' : '⏳ Aguardando aprovação'}
                </span>
              ) : eligibility.eligible ? (
                <span className="text-xs text-muted-foreground">Carta não gerada ainda. Aguardando aprovação do RH.</span>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
              {Object.entries(eligibility.criteria).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5">
                  {v ? <CheckCircle2 className="h-3 w-3 text-chart-2" /> : <XCircle className="h-3 w-3 text-destructive" />}
                  <span>{k.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {workflow.status !== 'completed' && workflow.status !== 'archived' && (
            <Button variant="destructive" size="sm" onClick={onCancel} className="gap-1">
              <Ban className="h-3.5 w-3.5" />
              Cancelar Processo
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          {!['completed', 'archived'].includes(workflow.status) && (
            <Button onClick={handleAdvanceStatus} className="gap-1">
              <ChevronRight className="h-4 w-4" />
              Avançar Etapa
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
