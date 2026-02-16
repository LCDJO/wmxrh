import { useState, useMemo } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Plus, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export default function Employees() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formSalary, setFormSalary] = useState('');

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from('employees').select('*, positions(title), departments(name), companies(name)').eq('tenant_id', tenantId);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from('companies').select('id, name').eq('tenant_id', tenantId);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !formCompany) throw new Error('Preencha todos os campos obrigatórios');
      const salary = parseFloat(formSalary) || 0;
      const { error } = await supabase.from('employees').insert({
        tenant_id: tenantId,
        company_id: formCompany,
        name: formName,
        email: formEmail || null,
        phone: formPhone || null,
        base_salary: salary,
        current_salary: salary,
        hire_date: new Date().toISOString().split('T')[0],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', tenantId] });
      toast({ title: 'Funcionário cadastrado!' });
      setOpen(false);
      setFormName(''); setFormEmail(''); setFormPhone(''); setFormCompany(''); setFormSalary('');
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const filtered = useMemo(() => {
    return employees.filter((e: any) => {
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || (e.email || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchCompany = companyFilter === 'all' || e.company_id === companyFilter;
      return matchSearch && matchStatus && matchCompany;
    });
  }, [employees, search, statusFilter, companyFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Funcionários</h1>
          <p className="text-muted-foreground mt-1">{employees.length} cadastrados</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Novo Funcionário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Funcionário</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={formName} onChange={e => setFormName(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input value={formPhone} onChange={e => setFormPhone(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select value={formCompany} onValueChange={setFormCompany}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Salário</Label><Input type="number" value={formSalary} onChange={e => setFormSalary(e.target.value)} placeholder="0.00" /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? 'Salvando...' : 'Cadastrar'}</Button>
            </form>
          </DialogContent>
        </Dialog>
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
              {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp: any) => (
              <tr key={emp.id} onClick={() => navigate(`/employees/${emp.id}`)} className="border-b border-border/50 last:border-0 hover:bg-secondary/50 cursor-pointer transition-colors">
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9"><AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">{emp.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}</AvatarFallback></Avatar>
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
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground">Nenhum funcionário encontrado.</div>}
      </div>
    </div>
  );
}
