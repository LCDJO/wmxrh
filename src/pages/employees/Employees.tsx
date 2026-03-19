import { useState, useMemo } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useEmployees, useCompaniesSimple, useDeleteEmployee } from '@/domains/hooks';
import { usePermissions } from '@/domains/security';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmployeeLimitBanner } from '@/components/shared/EmployeeLimitBanner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Filter, Pencil, Trash2, Rocket, UserMinus, UserPlus, ArrowRightLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/core/use-toast';
import { StartHiringDialog } from '@/components/hiring/StartHiringDialog';

export default function Employees() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [hiringOpen, setHiringOpen] = useState(false);

  const { data: employees = [] } = useEmployees();
  const { data: companies = [] } = useCompaniesSimple();
  const deleteMutation = useDeleteEmployee();
  const { canManageEmployees } = usePermissions();

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

  const activeEmployees = employees.filter((employee) => employee.status === 'active').length;
  const inactiveEmployees = employees.filter((employee) => employee.status === 'inactive').length;

  return (
    <div className="space-y-6">
      <EmployeeLimitBanner />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Colaboradores</h1>
          <p className="mt-1 text-muted-foreground">
            Centralize admissão, contratação e demissão no fluxo certo do colaborador.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{employees.length} registros</span>
          <span className="text-border">•</span>
          <span>{activeEmployees} ativos</span>
          <span className="text-border">•</span>
          <span>{inactiveEmployees} inativos</span>
        </div>
      </div>

      {canManageEmployees && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden border-border bg-card shadow-card">
            <CardContent className="flex h-full flex-col gap-5 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold font-display text-card-foreground">Admissão</h2>
                    <p className="text-sm text-muted-foreground">
                      Inicie a contratação com workflow guiado, validações e etapas obrigatórias.
                    </p>
                  </div>
                </div>
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-secondary px-2.5 py-1">Pré-cadastro</span>
                <span className="rounded-full bg-secondary px-2.5 py-1">Compliance</span>
                <span className="rounded-full bg-secondary px-2.5 py-1">eSocial</span>
                <span className="rounded-full bg-secondary px-2.5 py-1">Ativação</span>
              </div>
              <Button className="mt-auto gap-2" onClick={() => setHiringOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Iniciar admissão
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border bg-card shadow-card">
            <CardContent className="flex h-full flex-col gap-5 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                    <UserMinus className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold font-display text-card-foreground">Demissão</h2>
                    <p className="text-sm text-muted-foreground">
                      Abra o workflow de desligamento para cálculo rescisório, documentos e encerramento.
                    </p>
                  </div>
                </div>
                <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-secondary px-2.5 py-1">Rescisão</span>
                <span className="rounded-full bg-secondary px-2.5 py-1">Checklist</span>
                <span className="rounded-full bg-secondary px-2.5 py-1">Documentos</span>
                <span className="rounded-full bg-secondary px-2.5 py-1">Arquivo</span>
              </div>
              <Button variant="outline" className="mt-auto gap-2" onClick={() => navigate('/offboarding')}>
                <UserMinus className="h-4 w-4" />
                Iniciar demissão
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar colaborador..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-card border-border" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-card"><Filter className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue /></SelectTrigger>
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
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Colaborador</th>
              <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Cargo</th>
              <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">Empresa</th>
              <th className="hidden px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">Salário</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              {canManageEmployees && <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => (
              <tr key={emp.id} onClick={() => navigate(`/employees/${emp.id}`)} className="cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-secondary/50">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9"><AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">{emp.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</AvatarFallback></Avatar>
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.email || '—'}</p>
                    </div>
                  </div>
                </td>
                <td className="hidden px-5 py-3.5 text-sm text-card-foreground md:table-cell">{emp.positions?.title || '—'}</td>
                <td className="hidden px-5 py-3.5 text-sm text-muted-foreground lg:table-cell">{emp.companies?.name || '—'}</td>
                <td className="hidden px-5 py-3.5 text-sm font-medium text-card-foreground lg:table-cell">R$ {(emp.current_salary || 0).toLocaleString('pt-BR')}</td>
                <td className="px-5 py-3.5"><StatusBadge status={emp.status} /></td>
                {canManageEmployees && (
                  <td className="px-5 py-3.5">
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
        {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground">Nenhum colaborador encontrado.</div>}
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