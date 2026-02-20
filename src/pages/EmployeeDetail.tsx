import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/domains/security';
import {
  useEmployee, useEmployeeEvents, useCompensationTimeline,
  useSalaryContracts, useSalaryAdjustments, useSalaryAdditionals,
  useCreateSalaryContract, useCreateSalaryAdjustment, useCreateSalaryAdditional,
  useEmployeeBenefits, useHealthExams, useEmployeeRiskExposures,
  useNrTrainingByEmployee, useUpdateEmployee,
} from '@/domains/hooks';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Mail, Phone, Calendar, TrendingUp, Building2, FileText,
  Plus, Clock, Heart, ShieldAlert, Gift, Activity, Calculator, GraduationCap, Pencil, HardHat,
} from 'lucide-react';
import { SimulacaoTrabalhistaTab } from '@/components/employee/SimulacaoTrabalhistaTab';
import { DocumentosTab } from '@/components/employee/DocumentosTab';
import { TermosDocumentosTab } from '@/components/employee/TermosDocumentosTab';
import { TreinamentosNrTab } from '@/components/employee/TreinamentosNrTab';
import { CorrectiveActionsTab } from '@/components/employee/CorrectiveActionsTab';
import { EpisTab } from '@/components/employee/EpisTab';
import { useToast } from '@/hooks/use-toast';

// ── Labels ──

const adjTypeLabels: Record<string, string> = {
  annual: 'Anual', promotion: 'Promoção', adjustment: 'Ajuste', merit: 'Mérito', correction: 'Correção',
};
const additionalTypeLabels: Record<string, string> = {
  bonus: 'Bônus', commission: 'Comissão', allowance: 'Auxílio', hazard_pay: 'Insalubridade', overtime: 'Hora Extra', other: 'Outro',
};
const eventTypeLabels: Record<string, string> = {
  company_transfer: 'Transferência', position_change: 'Mudança de Cargo', department_change: 'Mudança de Depto',
  status_change: 'Mudança de Status', manager_change: 'Mudança de Gestor', salary_change: 'Alteração Salarial',
  employee_hired: 'Contratação', salary_contract_started: 'Novo Contrato', salary_adjusted: 'Ajuste Salarial',
  additional_added: 'Adicional', job_changed: 'Mudança de Função',
};
const examTypeLabels: Record<string, string> = {
  admissional: 'Admissional', periodico: 'Periódico', demissional: 'Demissional',
  mudanca_funcao: 'Mudança Função', retorno_trabalho: 'Retorno',
};
const examResultLabels: Record<string, string> = { apto: 'Apto', inapto: 'Inapto', apto_restricao: 'Apto c/ Restrição' };

const TIMELINE_COLORS: Record<string, string> = {
  contract: 'bg-primary',
  adjustment: 'bg-chart-2',
  additional: 'bg-chart-3',
  history: 'bg-chart-4',
  exam: 'bg-chart-5',
};
const TIMELINE_LABELS: Record<string, string> = {
  contract: 'Contrato',
  adjustment: 'Ajuste',
  additional: 'Adicional',
  history: 'Histórico',
  exam: 'Exame',
};

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const tenantId = currentTenant?.id;

  // Data hooks
  const { data: employee } = useEmployee(id!);
  const { data: events = [] } = useEmployeeEvents(id!);
  const { data: contracts = [] } = useSalaryContracts(id!);
  const { data: adjustments = [] } = useSalaryAdjustments(id!);
  const { data: additionals = [] } = useSalaryAdditionals(id!);
  const { data: timeline = [] } = useCompensationTimeline(id!);
  const { data: benefits = [] } = useEmployeeBenefits(id!);
  const { data: exams = [] } = useHealthExams(id!);
  const { data: riskExposures = [] } = useEmployeeRiskExposures(id!);

  const createContract = useCreateSalaryContract();
  const createAdjustment = useCreateSalaryAdjustment();
  const createAdditional = useCreateSalaryAdditional();
  const updateEmployee = useUpdateEmployee();
  const { canManageEmployees, canManageCompensation } = usePermissions();

  // Forms
  const [contractOpen, setContractOpen] = useState(false);
  const [contractSalary, setContractSalary] = useState('');
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjType, setAdjType] = useState('');
  const [adjPct, setAdjPct] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addRecurring, setAddRecurring] = useState('false');

  // Edit employee state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editHireDate, setEditHireDate] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const openEditDialog = () => {
    if (!employee) return;
    setEditName(employee.name || '');
    setEditEmail(employee.email || '');
    setEditPhone(employee.phone || '');
    setEditCpf(employee.cpf || '');
    setEditHireDate(employee.hire_date ? employee.hire_date.split('T')[0] : '');
    setEditStatus(employee.status || 'active');
    setEditOpen(true);
  };

  const handleUpdateEmployee = () => {
    if (!id) return;
    updateEmployee.mutate({
      id,
      name: editName,
      email: editEmail || null,
      phone: editPhone || null,
      cpf: editCpf || null,
      hire_date: editHireDate || null,
      status: editStatus,
    }, {
      onSuccess: () => { toast({ title: 'Colaborador atualizado!' }); setEditOpen(false); },
      onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  // ── Unified timeline merging compensation + exams ──
  const unifiedTimeline = useMemo(() => {
    const items: { id: string; type: string; date: string; description: string; amount?: number; meta?: Record<string, unknown> }[] = [];

    timeline.forEach(t => items.push({ id: t.id, type: t.type, date: t.date, description: t.description, amount: t.amount, meta: t.metadata }));

    (exams as any[]).forEach(ex => {
      items.push({
        id: ex.id,
        type: 'exam',
        date: ex.exam_date,
        description: `Exame ${examTypeLabels[ex.exam_type] || ex.exam_type} — ${examResultLabels[ex.result] || ex.result}`,
        meta: { physician: ex.physician_name, next: ex.next_exam_date },
      });
    });

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [timeline, exams]);

  if (!employee) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Carregando...</p>
        <Button variant="ghost" onClick={() => navigate('/employees')} className="mt-4">Voltar</Button>
      </div>
    );
  }

  const initials = employee.name.split(' ').map(n => n[0]).slice(0, 2).join('');
  const activeContract = contracts.find(c => c.is_active);

  // ── Handlers ──
  const handleCreateContract = () => {
    if (!tenantId) return;
    createContract.mutate({
      tenant_id: tenantId, employee_id: id!, base_salary: parseFloat(contractSalary),
      start_date: new Date().toISOString().split('T')[0], created_by: user?.id || null,
    }, {
      onSuccess: () => { toast({ title: 'Contrato criado!' }); setContractOpen(false); setContractSalary(''); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleCreateAdjustment = () => {
    if (!tenantId || !activeContract) { toast({ title: 'Erro', description: 'Sem contrato ativo', variant: 'destructive' }); return; }
    const pct = parseFloat(adjPct) || 0;
    const currentSal = employee.current_salary || 0;
    const newSal = pct > 0 ? Math.round(currentSal * (1 + pct / 100)) : currentSal;
    createAdjustment.mutate({
      tenant_id: tenantId, employee_id: id!, contract_id: activeContract.id,
      adjustment_type: adjType as any, percentage: pct || null,
      previous_salary: currentSal, new_salary: newSal,
      reason: adjReason || null, created_by: user?.id || null,
    }, {
      onSuccess: () => { toast({ title: 'Ajuste registrado!' }); setAdjOpen(false); setAdjType(''); setAdjPct(''); setAdjReason(''); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleCreateAdditional = () => {
    if (!tenantId) return;
    createAdditional.mutate({
      tenant_id: tenantId, employee_id: id!, additional_type: addType as any,
      amount: parseFloat(addAmount), is_recurring: addRecurring === 'true',
      start_date: new Date().toISOString().split('T')[0],
      description: addDesc || null, created_by: user?.id || null,
    }, {
      onSuccess: () => { toast({ title: 'Adicional registrado!' }); setAddOpen(false); setAddType(''); setAddAmount(''); setAddDesc(''); setAddRecurring('false'); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" onClick={() => navigate('/employees')} className="gap-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ═══════════ Profile Card ═══════════ */}
        <div className="bg-card rounded-xl shadow-card p-6">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 mb-4">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-bold font-display text-card-foreground">{employee.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{employee.positions?.title || '—'}</p>
            <div className="mt-3"><StatusBadge status={employee.status} /></div>
          </div>
          <div className="mt-6 space-y-3 border-t border-border pt-5">
            {employee.email && <div className="flex items-center gap-3 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-card-foreground">{employee.email}</span></div>}
            {employee.phone && <div className="flex items-center gap-3 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-card-foreground">{employee.phone}</span></div>}
            {employee.hire_date && <div className="flex items-center gap-3 text-sm"><Calendar className="h-4 w-4 text-muted-foreground" /><span className="text-card-foreground">Admissão: {new Date(employee.hire_date).toLocaleDateString('pt-BR')}</span></div>}
            {employee.companies?.name && <div className="flex items-center gap-3 text-sm"><Building2 className="h-4 w-4 text-muted-foreground" /><span className="text-card-foreground">{employee.companies.name}</span></div>}
            {employee.departments?.name && <div className="flex items-center gap-3 text-sm"><Building2 className="h-4 w-4 text-muted-foreground" /><span className="text-card-foreground">{employee.departments.name}</span></div>}
            {employee.cpf && <div className="flex items-center gap-3 text-sm"><FileText className="h-4 w-4 text-muted-foreground" /><span className="text-card-foreground">CPF: {employee.cpf}</span></div>}
          </div>

          {/* Quick salary summary */}
          <div className="mt-5 border-t border-border pt-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Salário Base</span>
              <span className="font-semibold text-card-foreground">R$ {(employee.base_salary || 0).toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Salário Atual</span>
              <span className="font-bold text-primary">R$ {(employee.current_salary || 0).toLocaleString('pt-BR')}</span>
            </div>
          </div>
        </div>

        {/* ═══════════ Main Tabs ═══════════ */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="trabalhista" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="trabalhista" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />Dados Trabalhistas</TabsTrigger>
              <TabsTrigger value="composicao" className="gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" />Composição Salarial</TabsTrigger>
              <TabsTrigger value="beneficios" className="gap-1.5 text-xs"><Gift className="h-3.5 w-3.5" />Benefícios</TabsTrigger>
              <TabsTrigger value="saude" className="gap-1.5 text-xs"><Heart className="h-3.5 w-3.5" />Saúde Ocupacional</TabsTrigger>
              <TabsTrigger value="riscos" className="gap-1.5 text-xs"><ShieldAlert className="h-3.5 w-3.5" />Riscos Ambientais</TabsTrigger>
              <TabsTrigger value="documentos" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />Documentos</TabsTrigger>
              <TabsTrigger value="termos" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />Termos e Acordos</TabsTrigger>
              <TabsTrigger value="simulacao" className="gap-1.5 text-xs"><Calculator className="h-3.5 w-3.5" />Simulação Trabalhista</TabsTrigger>
              <TabsTrigger value="nr_trainings" className="gap-1.5 text-xs"><GraduationCap className="h-3.5 w-3.5" />Treinamentos NR</TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" />Timeline</TabsTrigger>
              <TabsTrigger value="corrective_actions" className="gap-1.5 text-xs"><ShieldAlert className="h-3.5 w-3.5" />Ações Corretivas</TabsTrigger>
              <TabsTrigger value="epis" className="gap-1.5 text-xs"><HardHat className="h-3.5 w-3.5" />EPIs</TabsTrigger>
            </TabsList>

            {/* ── TAB: Dados Trabalhistas ── */}
            <TabsContent value="trabalhista">
              <div className="bg-card rounded-xl shadow-card p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold font-display text-card-foreground">Dados Trabalhistas</h3>
                  {canManageEmployees && (
                    <Button variant="outline" size="sm" className="gap-1" onClick={openEditDialog}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoField label="Nome" value={employee.name} />
                  <InfoField label="CPF" value={employee.cpf} />
                  <InfoField label="Status" value={<StatusBadge status={employee.status} />} />
                  <InfoField label="Data Admissão" value={employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('pt-BR') : '—'} />
                  <InfoField label="Empresa" value={employee.companies?.name} />
                  <InfoField label="Departamento" value={employee.departments?.name} />
                  <InfoField label="Cargo" value={employee.positions?.title} />
                  <InfoField label="E-mail" value={employee.email} />
                  <InfoField label="Telefone" value={employee.phone} />
                </div>

                {/* Edit Employee Dialog */}
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>Editar Colaborador — {employee.name}</DialogTitle></DialogHeader>
                    <form onSubmit={e => { e.preventDefault(); handleUpdateEmployee(); }} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Nome *</Label><Input value={editName} onChange={e => setEditName(e.target.value)} required /></div>
                        <div className="space-y-2"><Label>CPF</Label><Input value={editCpf} onChange={e => setEditCpf(e.target.value)} /></div>
                        <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Telefone</Label><Input value={editPhone} onChange={e => setEditPhone(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Data Admissão</Label><Input type="date" value={editHireDate} onChange={e => setEditHireDate(e.target.value)} /></div>
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={editStatus} onValueChange={setEditStatus}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Ativo</SelectItem>
                              <SelectItem value="inactive">Inativo</SelectItem>
                              <SelectItem value="on_leave">Afastado</SelectItem>
                              <SelectItem value="terminated">Desligado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button type="submit" className="w-full" disabled={updateEmployee.isPending}>
                        {updateEmployee.isPending ? 'Salvando...' : 'Salvar Alterações'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>

                {/* Events */}
                <div className="border-t border-border pt-5">
                  <h4 className="text-sm font-semibold text-card-foreground mb-3">Eventos Recentes</h4>
                  {events.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {events.slice(0, 10).map(ev => (
                        <div key={ev.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                          <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                                {eventTypeLabels[ev.event_type] || ev.event_type}
                              </span>
                              <span className="text-xs text-muted-foreground shrink-0">{new Date(ev.created_at).toLocaleDateString('pt-BR')}</span>
                            </div>
                            {ev.reason && <p className="text-xs text-muted-foreground mt-0.5">{ev.reason}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>}
                </div>
              </div>
            </TabsContent>

            {/* ── TAB: Composição Salarial ── */}
            <TabsContent value="composicao">
              <div className="space-y-5">
                {/* KPI cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-card rounded-xl shadow-card p-5">
                    <p className="text-xs text-muted-foreground font-medium">Salário Base</p>
                    <p className="text-2xl font-bold font-display text-card-foreground mt-1">R$ {(employee.base_salary || 0).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="bg-card rounded-xl shadow-card p-5">
                    <p className="text-xs text-muted-foreground font-medium">Salário Atual</p>
                    <p className="text-2xl font-bold font-display text-primary mt-1">R$ {(employee.current_salary || 0).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="bg-card rounded-xl shadow-card p-5">
                    <p className="text-xs text-muted-foreground font-medium">Contrato Ativo</p>
                    <p className="text-lg font-bold font-display text-card-foreground mt-1">
                      {activeContract ? `R$ ${activeContract.base_salary.toLocaleString('pt-BR')}` : 'Nenhum'}
                    </p>
                    {activeContract && <p className="text-xs text-muted-foreground">Desde {new Date(activeContract.start_date).toLocaleDateString('pt-BR')}</p>}
                  </div>
                </div>

                {/* Action buttons */}
                {canManageCompensation && (
                  <div className="flex flex-wrap gap-2">
                    <Dialog open={contractOpen} onOpenChange={setContractOpen}>
                      <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-1"><FileText className="h-3.5 w-3.5" />Novo Contrato</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Novo Contrato — {employee.name}</DialogTitle></DialogHeader>
                        <form onSubmit={e => { e.preventDefault(); handleCreateContract(); }} className="space-y-4">
                          <div className="space-y-2"><Label>Salário Base *</Label><Input type="number" value={contractSalary} onChange={e => setContractSalary(e.target.value)} required /></div>
                          <p className="text-xs text-muted-foreground">O contrato anterior será encerrado automaticamente.</p>
                          <Button type="submit" className="w-full" disabled={createContract.isPending}>{createContract.isPending ? 'Criando...' : 'Criar'}</Button>
                        </form>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
                      <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-1" disabled={!activeContract}><TrendingUp className="h-3.5 w-3.5" />Ajuste Salarial</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Ajuste — {employee.name}</DialogTitle></DialogHeader>
                        <form onSubmit={e => { e.preventDefault(); handleCreateAdjustment(); }} className="space-y-4">
                          <div className="space-y-2">
                            <Label>Tipo *</Label>
                            <Select value={adjType} onValueChange={setAdjType}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>{Object.entries(adjTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2"><Label>Percentual (%)</Label><Input type="number" step="0.1" value={adjPct} onChange={e => setAdjPct(e.target.value)} /></div>
                          <div className="space-y-2"><Label>Motivo</Label><Input value={adjReason} onChange={e => setAdjReason(e.target.value)} /></div>
                          <Button type="submit" className="w-full" disabled={createAdjustment.isPending}>{createAdjustment.isPending ? 'Salvando...' : 'Registrar'}</Button>
                        </form>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={addOpen} onOpenChange={setAddOpen}>
                      <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-1"><Plus className="h-3.5 w-3.5" />Adicional</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Adicional — {employee.name}</DialogTitle></DialogHeader>
                        <form onSubmit={e => { e.preventDefault(); handleCreateAdditional(); }} className="space-y-4">
                          <div className="space-y-2">
                            <Label>Tipo *</Label>
                            <Select value={addType} onValueChange={setAddType}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>{Object.entries(additionalTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2"><Label>Valor *</Label><Input type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)} required /></div>
                          <div className="space-y-2">
                            <Label>Recorrente?</Label>
                            <Select value={addRecurring} onValueChange={setAddRecurring}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="false">Não</SelectItem><SelectItem value="true">Sim</SelectItem></SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2"><Label>Descrição</Label><Input value={addDesc} onChange={e => setAddDesc(e.target.value)} /></div>
                          <Button type="submit" className="w-full" disabled={createAdditional.isPending}>{createAdditional.isPending ? 'Salvando...' : 'Registrar'}</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}

                {/* Contracts list */}
                <div className="bg-card rounded-xl shadow-card p-6">
                  <h4 className="text-sm font-semibold text-card-foreground mb-3">Contratos Salariais ({contracts.length})</h4>
                  {contracts.length > 0 ? (
                    <div className="space-y-2">
                      {contracts.map(c => (
                        <div key={c.id} className={`flex items-center justify-between p-3 rounded-lg border ${c.is_active ? 'border-primary/30 bg-accent/30' : 'border-border'}`}>
                          <div>
                            <p className="text-sm font-medium text-card-foreground">R$ {c.base_salary.toLocaleString('pt-BR')}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(c.start_date).toLocaleDateString('pt-BR')}
                              {c.end_date ? ` — ${new Date(c.end_date).toLocaleDateString('pt-BR')}` : ' — Atual'}
                            </p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${c.is_active ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                            {c.is_active ? 'Ativo' : 'Encerrado'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground text-center py-4">Nenhum contrato.</p>}
                </div>

                {/* Adjustments */}
                <div className="bg-card rounded-xl shadow-card p-6">
                  <h4 className="text-sm font-semibold text-card-foreground mb-3">Ajustes Salariais ({adjustments.length})</h4>
                  {adjustments.length > 0 ? (
                    <div className="space-y-2">
                      {adjustments.map(adj => (
                        <div key={adj.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{adjTypeLabels[adj.adjustment_type]}</span>
                              {adj.percentage && <span className="text-xs font-semibold text-primary">+{adj.percentage}%</span>}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              R$ {adj.previous_salary.toLocaleString('pt-BR')} → <span className="text-primary font-medium">R$ {adj.new_salary.toLocaleString('pt-BR')}</span>
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">{new Date(adj.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground text-center py-4">Nenhum ajuste.</p>}
                </div>

                {/* Additionals */}
                <div className="bg-card rounded-xl shadow-card p-6">
                  <h4 className="text-sm font-semibold text-card-foreground mb-3">Adicionais ({additionals.length})</h4>
                  {additionals.length > 0 ? (
                    <div className="space-y-2">
                      {additionals.map(add => (
                        <div key={add.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{additionalTypeLabels[add.additional_type]}</span>
                              {add.is_recurring && <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Recorrente</span>}
                            </div>
                            <p className="text-sm font-medium text-primary mt-1">R$ {add.amount.toLocaleString('pt-BR')}</p>
                            {add.description && <p className="text-xs text-muted-foreground">{add.description}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">{new Date(add.start_date).toLocaleDateString('pt-BR')}</p>
                            {add.end_date && <p className="text-xs text-muted-foreground">até {new Date(add.end_date).toLocaleDateString('pt-BR')}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground text-center py-4">Nenhum adicional.</p>}
                </div>
              </div>
            </TabsContent>

            {/* ── TAB: Benefícios ── */}
            <TabsContent value="beneficios">
              <div className="bg-card rounded-xl shadow-card p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Gift className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold font-display text-card-foreground">Benefícios ({benefits.length})</h3>
                </div>
                {benefits.length > 0 ? (
                  <div className="space-y-3">
                    {benefits.map((b: any) => (
                      <div key={b.id} className={`flex items-center justify-between p-4 rounded-lg border ${b.is_active ? 'border-primary/20 bg-accent/20' : 'border-border'}`}>
                        <div>
                          <p className="text-sm font-medium text-card-foreground">{b.benefit_plans?.name || 'Plano'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Tipo: {b.benefit_plans?.benefit_type || '—'} · Matrícula: {new Date(b.enrollment_date).toLocaleDateString('pt-BR')}
                          </p>
                          {b.card_number && <p className="text-xs text-muted-foreground">Cartão: {b.card_number}</p>}
                        </div>
                        <div className="text-right">
                          {b.monthly_value != null && <p className="text-sm font-semibold text-primary">R$ {b.monthly_value.toLocaleString('pt-BR')}/mês</p>}
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${b.is_active ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                            {b.is_active ? 'Ativo' : 'Cancelado'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum benefício vinculado.</p>}
              </div>
            </TabsContent>

            {/* ── TAB: Saúde Ocupacional ── */}
            <TabsContent value="saude">
              <div className="bg-card rounded-xl shadow-card p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Heart className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold font-display text-card-foreground">Exames Ocupacionais ({exams.length})</h3>
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
            </TabsContent>

            {/* ── TAB: Riscos Ambientais ── */}
            <TabsContent value="riscos">
              <div className="bg-card rounded-xl shadow-card p-6">
                <div className="flex items-center gap-2 mb-5">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold font-display text-card-foreground">Exposições a Risco ({riskExposures.length})</h3>
                </div>
                {riskExposures.length > 0 ? (
                  <div className="space-y-3">
                    {(riskExposures as any[]).map(re => {
                      const levelColors: Record<string, string> = {
                        critico: 'bg-destructive/10 text-destructive',
                        alto: 'bg-chart-2/10 text-chart-2',
                        medio: 'bg-chart-3/10 text-chart-3',
                        baixo: 'bg-primary/10 text-primary',
                      };
                      return (
                        <div key={re.id} className={`p-4 rounded-lg border ${re.is_active ? 'border-border' : 'border-border opacity-60'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${levelColors[re.risk_level] || 'bg-accent text-accent-foreground'}`}>
                                {re.risk_level?.charAt(0).toUpperCase() + re.risk_level?.slice(1)}
                              </span>
                              {re.generates_hazard_pay && <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">Periculosidade</span>}
                              {!re.is_active && <span className="text-xs text-muted-foreground">(Inativo)</span>}
                            </div>
                            <span className="text-xs text-muted-foreground">{new Date(re.start_date).toLocaleDateString('pt-BR')}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                            {re.hazard_pay_type && <span>Tipo: {re.hazard_pay_type}</span>}
                            {re.hazard_pay_percentage && <span>Percentual: {re.hazard_pay_percentage}%</span>}
                            {re.requires_epi && <span>Requer EPI</span>}
                            {re.epi_description && <span>EPI: {re.epi_description}</span>}
                          </div>
                          {re.notes && <p className="text-xs text-muted-foreground mt-1">{re.notes}</p>}
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhuma exposição registrada.</p>}
              </div>
            </TabsContent>

            {/* ── TAB: Documentos ── */}
            <TabsContent value="documentos">
              <DocumentosTab employeeId={id!} />
            </TabsContent>

            {/* ── TAB: Termos e Acordos ── */}
            <TabsContent value="termos">
              <TermosDocumentosTab employeeId={id!} />
            </TabsContent>

            {/* ── TAB: Simulação Trabalhista ── */}
            <TabsContent value="simulacao">
              <SimulacaoTrabalhistaTab employee={employee} />
            </TabsContent>

            {/* ── TAB: Treinamentos NR ── */}
            <TabsContent value="nr_trainings">
              <TreinamentosNrTab employeeId={id!} />
            </TabsContent>

            {/* ── TAB: Timeline Unificada ── */}
            <TabsContent value="timeline">
              <div className="bg-card rounded-xl shadow-card p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold font-display text-card-foreground">Timeline Unificada</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-5">Salários, rubricas, exames e adicionais em ordem cronológica.</p>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-5">
                  {Object.entries(TIMELINE_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className={`h-2.5 w-2.5 rounded-full ${TIMELINE_COLORS[key]}`} />
                      {label}
                    </div>
                  ))}
                </div>

                {unifiedTimeline.length > 0 ? (
                  <div className="relative">
                    <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" />
                    <div className="space-y-4">
                      {unifiedTimeline.map((item) => (
                        <div key={`${item.type}-${item.id}`} className="flex items-start gap-4 relative">
                          <div className={`h-4 w-4 rounded-full ${TIMELINE_COLORS[item.type] || 'bg-muted'} shrink-0 z-10 ring-2 ring-card`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                {TIMELINE_LABELS[item.type] || item.type}
                              </span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {new Date(item.date).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            <p className="text-sm text-card-foreground mt-1">{item.description}</p>
                            {item.amount != null && (
                              <p className="text-sm font-semibold text-primary mt-0.5">R$ {item.amount.toLocaleString('pt-BR')}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro na timeline.</p>}
              </div>
            </TabsContent>

            {/* ── TAB: Ações Corretivas ── */}
            <TabsContent value="corrective_actions">
              {tenantId && id ? (
                <CorrectiveActionsTab employeeId={id} tenantId={tenantId} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Dados não disponíveis.</p>
              )}
            </TabsContent>

            {/* ── TAB: EPIs ── */}
            <TabsContent value="epis">
              {tenantId && id ? (
                <EpisTab employeeId={id} tenantId={tenantId} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Dados não disponíveis.</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ── Helper component ──
function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <div className="text-sm text-card-foreground mt-0.5">{value || '—'}</div>
    </div>
  );
}
