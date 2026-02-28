import { useState, useMemo } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useEmployees, useCompaniesSimple, useCreateEmployee, useDeleteEmployee } from '@/domains/hooks';
import { usePermissions } from '@/domains/security';
import { useEmployeeLimit } from '@/hooks/use-employee-limit';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmployeeLimitBanner } from '@/components/shared/EmployeeLimitBanner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Plus, Filter, Pencil, Trash2, Rocket } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { StartHiringDialog } from '@/components/hiring/StartHiringDialog';

export default function Employees() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formSalary, setFormSalary] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [hiringOpen, setHiringOpen] = useState(false);

  const { data: employees = [] } = useEmployees();
  const { data: companies = [] } = useCompaniesSimple();
  const createMutation = useCreateEmployee();
  const deleteMutation = useDeleteEmployee();
  const { canManageEmployees } = usePermissions();
  const { canAddMore, maxAllowed } = useEmployeeLimit();

  const handleCreate = () => {
    if (!canAddMore) {
      toast({ title: `Limite de ${maxAllowed} colaboradores atingido`, description: 'Faça upgrade do plano para adicionar mais.', variant: 'destructive' });
      return;
    }
    if (!tenantId || !formCompany) { toast({ title: 'Erro', description: 'Preencha os campos obrigatórios', variant: 'destructive' }); return; }
    const salary = parseFloat(formSalary) || 0;
    createMutation.mutate({
      tenant_id: tenantId,
      company_id: formCompany,
      name: formName,
      email: formEmail || null,
      phone: formPhone || null,
      base_salary: salary,
      current_salary: salary,
      hire_date: new Date().toISOString().split('T')[0],
    }, {
      onSuccess: () => {
        toast({ title: 'Funcionário cadastrado!' });
        setOpen(false);
        setFormName(''); setFormEmail(''); setFormPhone(''); setFormCompany(''); setFormSalary('');
      },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => {
        toast({ title: 'Funcionário removido!' });
        setDeleteId(null);
      },
      onError: (e) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
    });
  };

  const filtered = useMemo(() => {
    return employees.filter(e => {
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || (e.email || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchCompany = companyFilter === 'all' || e.company_id === companyFilter;
      return matchSearch && matchStatus && matchCompany;
    });
  }, [employees, search, statusFilter, companyFilter]);

  return (
    <div className="space-y-6">
      <EmployeeLimitBanner />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Funcionários</h1>
          <p className="text-muted-foreground mt-1">{employees.length} cadastrados</p>
        </div>
        {canManageEmployees && (
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setHiringOpen(true)}>
              <Rocket className="h-4 w-4" />
              Nova Admissão
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" disabled={!canAddMore}><Plus className="h-4 w-4" />Novo Funcionário</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Funcionário</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); handleCreate(); }} className="space-y-4">
                  <div className="space-y-2"><Label>Nome *</Label><Input value={formName} onChange={e => setFormName(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Telefone</Label><Input value={formPhone} onChange={e => setFormPhone(e.target.value)} /></div>
                  <div className="space-y-2">
                    <Label>Empresa *</Label>
                    <Select value={formCompany} onValueChange={setFormCompany}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Salário</Label><Input type="number" value={formSalary} onChange={e => setFormSalary(e.target.value)} placeholder="0.00" /></div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? 'Salvando...' : 'Cadastrar'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-card border-border" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-card"><Filter className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="on_leave">Afastados</SelectItem>
          </SelectContent>
        </Select>
        {companies.length > 1 && (
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-[180px] bg-card"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden animate-fade-in">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3.5 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Funcionário</th>
              <th className="text-left py-3.5 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Cargo</th>
              <th className="text-left py-3.5 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Empresa</th>
              <th className="text-left py-3.5 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Salário</th>
              <th className="text-left py-3.5 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              {canManageEmployees && <th className="text-left py-3.5 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => (
              <tr key={emp.id} onClick={() => navigate(`/employees/${emp.id}`)} className="border-b border-border/50 last:border-0 hover:bg-secondary/50 cursor-pointer transition-colors">
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9"><AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">{emp.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</AvatarFallback></Avatar>
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.email || '—'}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-5 hidden md:table-cell text-sm text-card-foreground">{emp.positions?.title || '—'}</td>
                <td className="py-3.5 px-5 hidden lg:table-cell text-sm text-muted-foreground">{emp.companies?.name || '—'}</td>
                <td className="py-3.5 px-5 hidden lg:table-cell text-sm font-medium text-card-foreground">R$ {(emp.current_salary || 0).toLocaleString('pt-BR')}</td>
                <td className="py-3.5 px-5"><StatusBadge status={emp.status} /></td>
                {canManageEmployees && (
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate(`/employees/${emp.id}`); }}>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(emp.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground">Nenhum funcionário encontrado.</div>}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja desativar este funcionário? Esta ação pode ser revertida.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? 'Removendo...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {tenantId && (
        <StartHiringDialog
          open={hiringOpen}
          onOpenChange={setHiringOpen}
          tenantId={tenantId}
          companies={companies}
        />
      )}
    </div>
  );
}
