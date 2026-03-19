/**
 * HealthExamsSection — Occupational health exams list + manual registration.
 */
import { useState } from 'react';
import { Heart, Plus } from 'lucide-react';
import { useHealthExams, useCreateHealthExam } from '@/domains/hooks';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/core/use-toast';
import type { ExamType, ExamResult } from '@/domains/shared/types';

const examTypeLabels: Record<string, string> = {
  admissional: 'Admissional', periodico: 'Periódico', demissional: 'Demissional',
  mudanca_funcao: 'Mudança Função', retorno_trabalho: 'Retorno',
};
const examResultLabels: Record<string, string> = { apto: 'Apto', inapto: 'Inapto', apto_restricao: 'Apto c/ Restrição' };

interface Props {
  employeeId: string;
  tenantId?: string;
}

export function HealthExamsSection({ employeeId, tenantId }: Props) {
  const { data: exams = [] } = useHealthExams(employeeId);
  const createExam = useCreateHealthExam();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [examType, setExamType] = useState<ExamType>('periodico');
  const [examDate, setExamDate] = useState('');
  const [result, setResult] = useState<ExamResult>('apto');
  const [physicianName, setPhysicianName] = useState('');
  const [physicianCrm, setPhysicianCrm] = useState('');
  const [nextExamDate, setNextExamDate] = useState('');
  const [observations, setObservations] = useState('');

  const resetForm = () => {
    setExamType('periodico');
    setExamDate('');
    setResult('apto');
    setPhysicianName('');
    setPhysicianCrm('');
    setNextExamDate('');
    setObservations('');
  };

  const handleSubmit = async () => {
    if (!examDate || !tenantId) {
      toast({ title: 'Preencha a data do exame', variant: 'destructive' });
      return;
    }
    try {
      await createExam.mutateAsync({
        tenant_id: tenantId,
        employee_id: employeeId,
        exam_type: examType,
        exam_date: examDate,
        result,
        physician_name: physicianName || null,
        physician_crm: physicianCrm || null,
        observations: observations || null,
      });
      toast({ title: 'Exame registrado com sucesso' });
      resetForm();
      setOpen(false);
    } catch {
      toast({ title: 'Erro ao registrar exame', variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          <h4 className="text-sm font-semibold text-card-foreground">Exames Ocupacionais ({exams.length})</h4>
        </div>
        {tenantId && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Registrar Exame
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar Exame Ocupacional</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Tipo de Exame</Label>
                    <Select value={examType} onValueChange={(v) => setExamType(v as ExamType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(examTypeLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Resultado</Label>
                    <Select value={result} onValueChange={(v) => setResult(v as ExamResult)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(examResultLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Data do Exame *</Label>
                    <Input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Próximo Exame</Label>
                    <Input type="date" value={nextExamDate} onChange={e => setNextExamDate(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Médico</Label>
                    <Input placeholder="Nome do médico" value={physicianName} onChange={e => setPhysicianName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CRM</Label>
                    <Input placeholder="CRM" value={physicianCrm} onChange={e => setPhysicianCrm(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea placeholder="Observações..." value={observations} onChange={e => setObservations(e.target.value)} rows={3} />
                </div>
                <Button onClick={handleSubmit} disabled={createExam.isPending} className="w-full">
                  {createExam.isPending ? 'Salvando...' : 'Salvar Exame'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {exams.length > 0 ? (
        <div className="space-y-3">
          {(exams as any[]).map(ex => {
            const isOverdue = ex.next_exam_date && new Date(ex.next_exam_date) < new Date();
            return (
              <div key={ex.id} className={`p-4 rounded-lg border ${isOverdue ? 'border-destructive/30 bg-destructive/5' : 'border-border'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                      {examTypeLabels[ex.exam_type] || ex.exam_type}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      ex.result === 'apto' ? 'bg-primary/10 text-primary' :
                      ex.result === 'inapto' ? 'bg-destructive/10 text-destructive' :
                      'bg-accent text-accent-foreground'
                    }`}>
                      {examResultLabels[ex.result] || ex.result}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(ex.exam_date).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  {ex.physician_name && <span>Médico: {ex.physician_name}</span>}
                  {ex.physician_crm && <span>CRM: {ex.physician_crm}</span>}
                  {ex.next_exam_date && (
                    <span className={isOverdue ? 'text-destructive font-semibold' : ''}>
                      Próximo: {new Date(ex.next_exam_date).toLocaleDateString('pt-BR')}
                      {isOverdue && ' (VENCIDO)'}
                    </span>
                  )}
                </div>
                {ex.observations && <p className="text-xs text-muted-foreground mt-1">{ex.observations}</p>}
              </div>
            );
          })}
        </div>
      ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum exame registrado.</p>}
    </div>
  );
}
