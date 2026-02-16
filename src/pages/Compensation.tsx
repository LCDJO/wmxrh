import { useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/domains/security';
import {
  useEmployeesSimple, useSalaryHistoryByTenant,
  useSalaryAdjustmentsByTenant, useCompaniesSimple,
  useEmployees, useActiveSalaryContract,
  useCreateSalaryAdjustment, useCreateSalaryContract
} from '@/domains/hooks';
import { TrendingUp, DollarSign, FileText, Plus } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const adjTypeLabels: Record<string, string> = {
  annual: 'Anual', promotion: 'Promoção', adjustment: 'Ajuste', merit: 'Mérito', correction: 'Correção',
};

export default function Compensation() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const tenantId = currentTenant?.id;

  const { data: employeesSimple = [] } = useEmployeesSimple();
  const { data: employees = [] } = useEmployees();
  const { data: history = [] } = useSalaryHistoryByTenant();
  const { data: adjustments = [] } = useSalaryAdjustmentsByTenant();
  const { canManageCompensation } = usePermissions();

  const active = employeesSimple.filter(e => e.status === 'active');
  const totalPayroll = active.reduce((sum, e) => sum + (e.current_salary || 0), 0);
  const avgSalary = active.length > 0 ? Math.round(totalPayroll / active.length) : 0;
  const maxSalary = active.length > 0 ? Math.max(...active.map(e => e.current_salary || 0)) : 0;

  // Adjustment dialog state
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjEmployeeId, setAdjEmployeeId] = useState('');
  const [adjType, setAdjType] = useState('');
  const [adjPercentage, setAdjPercentage] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const createAdjustment = useCreateSalaryAdjustment();

  // Contract dialog state
  const [contractOpen, setContractOpen] = useState(false);
  const [contractEmployeeId, setContractEmployeeId] = useState('');
  const [contractSalary, setContractSalary] = useState('');
  const createContract = useCreateSalaryContract();

  const handleCreateAdjustment = () => {
    if (!tenantId || !adjEmployeeId || !adjType) return;
    const emp = employeesSimple.find(e => e.id === adjEmployeeId);
    const currentSal = emp?.current_salary || 0;
    const pct = parseFloat(adjPercentage) || 0;
    const newSal = pct > 0 ? Math.round(currentSal * (1 + pct / 100)) : currentSal;

    // Need active contract
    // We'll do a simple approach: we need the contract_id
    // For now we'll fetch it inline
    import('@/domains/compensation/salary-contract.service').then(({ salaryContractService }) => {
      salaryContractService.getActive(adjEmployeeId).then(contract => {
        if (!contract) {
          toast({ title: 'Erro', description: 'Funcionário não possui contrato ativo', variant: 'destructive' });
          return;
        }
        createAdjustment.mutate({
          tenant_id: tenantId,
          employee_id: adjEmployeeId,
          contract_id: contract.id,
          adjustment_type: adjType as any,
          percentage: pct || null,
          previous_salary: currentSal,
          new_salary: newSal,
          reason: adjReason || null,
          created_by: user?.id || null,
        }, {
          onSuccess: () => {
            toast({ title: 'Ajuste registrado!' });
            setAdjOpen(false);
            setAdjEmployeeId(''); setAdjType(''); setAdjPercentage(''); setAdjReason('');
          },
          onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
        });
      });
    });
  };

  const handleCreateContract = () => {
    if (!tenantId || !contractEmployeeId || !contractSalary) return;
    createContract.mutate({
      tenant_id: tenantId,
      employee_id: contractEmployeeId,
      base_salary: parseFloat(contractSalary),
      start_date: new Date().toISOString().split('T')[0],
      created_by: user?.id || null,
    }, {
      onSuccess: () => {
        toast({ title: 'Contrato criado! O anterior foi encerrado automaticamente.' });
        setContractOpen(false);
        setContractEmployeeId(''); setContractSalary('');
      },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Remuneração</h1>
          <p className="text-muted-foreground mt-1">Gestão de salários, contratos e aumentos</p>
        </div>
        {canManageCompensation && (
        <div className="flex gap-2">
          <Dialog open={contractOpen} onOpenChange={setContractOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><FileText className="h-4 w-4" />Novo Contrato</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Contrato Salarial</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); handleCreateContract(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Funcionário *</Label>
                  <Select value={contractEmployeeId} onValueChange={setContractEmployeeId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Salário Base *</Label><Input type="number" value={contractSalary} onChange={e => setContractSalary(e.target.value)} required /></div>
                <p className="text-xs text-muted-foreground">O contrato anterior será encerrado automaticamente.</p>
                <Button type="submit" className="w-full" disabled={createContract.isPending}>{createContract.isPending ? 'Criando...' : 'Criar Contrato'}</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Novo Ajuste</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Ajuste Salarial</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); handleCreateAdjustment(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Funcionário *</Label>
                  <Select value={adjEmployeeId} onValueChange={setAdjEmployeeId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name} — R$ {(e.current_salary || 0).toLocaleString('pt-BR')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select value={adjType} onValueChange={setAdjType}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(adjTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Percentual (%)</Label><Input type="number" step="0.1" value={adjPercentage} onChange={e => setAdjPercentage(e.target.value)} placeholder="Ex: 10" /></div>
                <div className="space-y-2"><Label>Motivo</Label><Input value={adjReason} onChange={e => setAdjReason(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={createAdjustment.isPending}>{createAdjustment.isPending ? 'Salvando...' : 'Registrar Ajuste'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatsCard title="Folha Total" value={`R$ ${totalPayroll > 0 ? (totalPayroll / 1000).toFixed(0) + 'k' : '0'}`} icon={DollarSign} />
        <StatsCard title="Salário Médio" value={`R$ ${avgSalary.toLocaleString('pt-BR')}`} icon={TrendingUp} />
        <StatsCard title="Maior Salário" value={`R$ ${maxSalary.toLocaleString('pt-BR')}`} icon={TrendingUp} />
      </div>

      <Tabs defaultValue="adjustments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="adjustments">Ajustes Salariais</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="adjustments">
          <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
            <h2 className="text-lg font-semibold font-display text-card-foreground mb-5">Ajustes Recentes</h2>
            {adjustments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Funcionário</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Tipo</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Anterior</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Novo</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">%</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Motivo</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustments.map(adj => {
                      const pct = adj.percentage || (((adj.new_salary - adj.previous_salary) / adj.previous_salary) * 100);
                      return (
                        <tr key={adj.id} className="border-b border-border/50 last:border-0">
                          <td className="py-3 px-4 text-sm font-medium text-card-foreground">{adj.employees?.name || '—'}</td>
                          <td className="py-3 px-4"><span className="text-xs font-semibold px-2 py-1 rounded-full bg-accent text-accent-foreground">{adjTypeLabels[adj.adjustment_type] || adj.adjustment_type}</span></td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">R$ {adj.previous_salary.toLocaleString('pt-BR')}</td>
                          <td className="py-3 px-4 text-sm font-medium text-primary">R$ {adj.new_salary.toLocaleString('pt-BR')}</td>
                          <td className="py-3 px-4 text-sm font-semibold text-accent-foreground">+{pct.toFixed(1)}%</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{adj.reason || '—'}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{new Date(adj.created_at).toLocaleDateString('pt-BR')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum ajuste salarial registrado.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="bg-card rounded-xl shadow-card p-6 animate-fade-in">
            <h2 className="text-lg font-semibold font-display text-card-foreground mb-5">Histórico de Alterações</h2>
            {history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Funcionário</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Anterior</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Novo</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Motivo</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => {
                      const increase = (((h.new_salary - h.previous_salary) / h.previous_salary) * 100).toFixed(1);
                      return (
                        <tr key={h.id} className="border-b border-border/50 last:border-0">
                          <td className="py-3 px-4 text-sm font-medium text-card-foreground">{h.employees?.name || '—'}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">R$ {h.previous_salary.toLocaleString('pt-BR')}</td>
                          <td className="py-3 px-4 text-sm font-medium text-primary">R$ {h.new_salary.toLocaleString('pt-BR')}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{h.reason || '—'} <span className="text-accent-foreground font-semibold">(+{increase}%)</span></td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{new Date(h.effective_date).toLocaleDateString('pt-BR')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum histórico de alteração salarial.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
