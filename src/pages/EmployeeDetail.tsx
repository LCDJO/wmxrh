import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/domains/security';
import {
  useEmployee, useSalaryHistoryByEmployee, useEmployeeEvents,
  useSalaryContracts, useSalaryAdjustments, useSalaryAdditionals,
  useCreateSalaryContract, useCreateSalaryAdjustment, useCreateSalaryAdditional
} from '@/domains/hooks';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Mail, Phone, Calendar, TrendingUp, Building2, FileText, Plus, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const tenantId = currentTenant?.id;

  const { data: employee } = useEmployee(id!);
  const { data: history = [] } = useSalaryHistoryByEmployee(id!);
  const { data: events = [] } = useEmployeeEvents(id!);
  const { data: contracts = [] } = useSalaryContracts(id!);
  const { data: adjustments = [] } = useSalaryAdjustments(id!);
  const { data: additionals = [] } = useSalaryAdditionals(id!);

  const createContract = useCreateSalaryContract();
  const createAdjustment = useCreateSalaryAdjustment();
  const createAdditional = useCreateSalaryAdditional();
  const { canManageCompensation } = usePermissions();

  // Contract form
  const [contractOpen, setContractOpen] = useState(false);
  const [contractSalary, setContractSalary] = useState('');

  // Adjustment form
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjType, setAdjType] = useState('');
  const [adjPct, setAdjPct] = useState('');
  const [adjReason, setAdjReason] = useState('');

  // Additional form
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addRecurring, setAddRecurring] = useState('false');

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
        {/* Profile Card */}
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
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Salary Cards */}
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

          {/* Action Buttons (permission-gated) */}
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

          {/* Tabs */}
          <Tabs defaultValue="events" className="space-y-4">
            <TabsList>
              <TabsTrigger value="events">Timeline</TabsTrigger>
              <TabsTrigger value="contracts">Contratos ({contracts.length})</TabsTrigger>
              <TabsTrigger value="adjustments">Ajustes ({adjustments.length})</TabsTrigger>
              <TabsTrigger value="additionals">Adicionais ({additionals.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="events">
              <div className="bg-card rounded-xl shadow-card p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Clock className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold font-display text-card-foreground">Timeline de Eventos</h3>
                </div>
                {events.length > 0 ? (
                  <div className="space-y-4">
                    {events.map(ev => (
                      <div key={ev.id} className="flex items-start gap-4 py-3 border-b border-border/50 last:border-0">
                        <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                              {eventTypeLabels[ev.event_type] || ev.event_type}
                            </span>
                            <span className="text-xs text-muted-foreground">{new Date(ev.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                          {ev.reason && <p className="text-sm text-muted-foreground mt-1">{ev.reason}</p>}
                          {ev.new_value && (
                            <pre className="text-xs text-muted-foreground mt-1 bg-secondary rounded p-2 overflow-x-auto">
                              {JSON.stringify(ev.new_value, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento registrado.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="contracts">
              <div className="bg-card rounded-xl shadow-card p-6">
                <h3 className="text-lg font-semibold font-display text-card-foreground mb-5">Contratos Salariais</h3>
                {contracts.length > 0 ? (
                  <div className="space-y-3">
                    {contracts.map(c => (
                      <div key={c.id} className={`flex items-center justify-between p-4 rounded-lg border ${c.is_active ? 'border-primary/30 bg-accent/30' : 'border-border'}`}>
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
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum contrato registrado.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="adjustments">
              <div className="bg-card rounded-xl shadow-card p-6">
                <h3 className="text-lg font-semibold font-display text-card-foreground mb-5">Ajustes Salariais</h3>
                {adjustments.length > 0 ? (
                  <div className="space-y-3">
                    {adjustments.map(adj => (
                      <div key={adj.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{adjTypeLabels[adj.adjustment_type]}</span>
                            {adj.percentage && <span className="text-xs font-semibold text-primary">+{adj.percentage}%</span>}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            R$ {adj.previous_salary.toLocaleString('pt-BR')} → <span className="text-primary font-medium">R$ {adj.new_salary.toLocaleString('pt-BR')}</span>
                          </p>
                          {adj.reason && <p className="text-xs text-muted-foreground mt-0.5">{adj.reason}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(adj.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum ajuste registrado.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="additionals">
              <div className="bg-card rounded-xl shadow-card p-6">
                <h3 className="text-lg font-semibold font-display text-card-foreground mb-5">Adicionais</h3>
                {additionals.length > 0 ? (
                  <div className="space-y-3">
                    {additionals.map(add => (
                      <div key={add.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
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
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum adicional registrado.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
