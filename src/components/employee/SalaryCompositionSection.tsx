/**
 * SalaryCompositionSection — Extracted from EmployeeDetail inline salary tab.
 * Shows contracts, adjustments, additionals, and KPI cards.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, TrendingUp, Plus } from 'lucide-react';
import { useToast } from '@/hooks/core/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  useSalaryContracts, useSalaryAdjustments, useSalaryAdditionals,
  useCreateSalaryContract, useCreateSalaryAdjustment, useCreateSalaryAdditional,
} from '@/domains/hooks';

const adjTypeLabels: Record<string, string> = {
  annual: 'Anual', promotion: 'Promoção', adjustment: 'Ajuste', merit: 'Mérito', correction: 'Correção',
};
const additionalTypeLabels: Record<string, string> = {
  bonus: 'Bônus', commission: 'Comissão', allowance: 'Auxílio', hazard_pay: 'Insalubridade', overtime: 'Hora Extra', other: 'Outro',
};

interface Props {
  employeeId: string;
  tenantId: string;
  employeeName: string;
  baseSalary: number;
  currentSalary: number;
  canManageCompensation: boolean;
}

export function SalaryCompositionSection({ employeeId, tenantId, employeeName, baseSalary, currentSalary, canManageCompensation }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: contracts = [] } = useSalaryContracts(employeeId);
  const { data: adjustments = [] } = useSalaryAdjustments(employeeId);
  const { data: additionals = [] } = useSalaryAdditionals(employeeId);
  const createContract = useCreateSalaryContract();
  const createAdjustment = useCreateSalaryAdjustment();
  const createAdditional = useCreateSalaryAdditional();

  const activeContract = contracts.find(c => c.is_active);

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

  const handleCreateContract = () => {
    createContract.mutate({
      tenant_id: tenantId, employee_id: employeeId, base_salary: parseFloat(contractSalary),
      start_date: new Date().toISOString().split('T')[0], created_by: user?.id || null,
    }, {
      onSuccess: () => { toast({ title: 'Contrato criado!' }); setContractOpen(false); setContractSalary(''); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleCreateAdjustment = () => {
    if (!activeContract) { toast({ title: 'Erro', description: 'Sem contrato ativo', variant: 'destructive' }); return; }
    const pct = parseFloat(adjPct) || 0;
    const newSal = pct > 0 ? Math.round(currentSalary * (1 + pct / 100)) : currentSalary;
    createAdjustment.mutate({
      tenant_id: tenantId, employee_id: employeeId, contract_id: activeContract.id,
      adjustment_type: adjType as any, percentage: pct || null,
      previous_salary: currentSalary, new_salary: newSal,
      reason: adjReason || null, created_by: user?.id || null,
    }, {
      onSuccess: () => { toast({ title: 'Ajuste registrado!' }); setAdjOpen(false); setAdjType(''); setAdjPct(''); setAdjReason(''); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleCreateAdditional = () => {
    createAdditional.mutate({
      tenant_id: tenantId, employee_id: employeeId, additional_type: addType as any,
      amount: parseFloat(addAmount), is_recurring: addRecurring === 'true',
      start_date: new Date().toISOString().split('T')[0],
      description: addDesc || null, created_by: user?.id || null,
    }, {
      onSuccess: () => { toast({ title: 'Adicional registrado!' }); setAddOpen(false); setAddType(''); setAddAmount(''); setAddDesc(''); setAddRecurring('false'); },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl shadow-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Salário Base</p>
          <p className="text-2xl font-bold font-display text-card-foreground mt-1">R$ {baseSalary.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-card rounded-xl shadow-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Salário Atual</p>
          <p className="text-2xl font-bold font-display text-primary mt-1">R$ {currentSalary.toLocaleString('pt-BR')}</p>
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
              <DialogHeader><DialogTitle>Novo Contrato — {employeeName}</DialogTitle></DialogHeader>
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
              <DialogHeader><DialogTitle>Ajuste — {employeeName}</DialogTitle></DialogHeader>
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
              <DialogHeader><DialogTitle>Adicional — {employeeName}</DialogTitle></DialogHeader>
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
      <div className="bg-muted/30 rounded-lg p-4">
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
      <div className="bg-muted/30 rounded-lg p-4">
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
      <div className="bg-muted/30 rounded-lg p-4">
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
  );
}
