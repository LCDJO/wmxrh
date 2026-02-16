import { useState, useMemo } from 'react';
import { employees } from '@/data/mock-data';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';

export default function Employees() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    return employees.filter(e => {
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchDept = deptFilter === 'all' || e.department === deptFilter;
      return matchSearch && matchStatus && matchDept;
    });
  }, [search, statusFilter, deptFilter]);

  const depts = [...new Set(employees.map(e => e.department))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Funcionários</h1>
          <p className="text-muted-foreground mt-1">{employees.length} funcionários cadastrados</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Funcionário
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-card border-border" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-card"><Filter className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="on_leave">Afastados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[180px] bg-card"><SelectValue placeholder="Departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {depts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden animate-fade-in">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3.5 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Funcionário</th>
              <th className="text-left py-3.5 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Cargo</th>
              <th className="text-left py-3.5 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Departamento</th>
              <th className="text-left py-3.5 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Salário</th>
              <th className="text-left py-3.5 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp, i) => (
              <tr
                key={emp.id}
                onClick={() => navigate(`/employees/${emp.id}`)}
                className="border-b border-border/50 last:border-0 hover:bg-secondary/50 cursor-pointer transition-colors"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
                        {emp.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-5 hidden md:table-cell">
                  <p className="text-sm text-card-foreground">{emp.positionTitle}</p>
                </td>
                <td className="py-3.5 px-5 hidden lg:table-cell">
                  <p className="text-sm text-muted-foreground">{emp.department}</p>
                </td>
                <td className="py-3.5 px-5 hidden lg:table-cell">
                  <p className="text-sm font-medium text-card-foreground">R$ {emp.currentSalary.toLocaleString('pt-BR')}</p>
                </td>
                <td className="py-3.5 px-5"><StatusBadge status={emp.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">Nenhum funcionário encontrado.</div>
        )}
      </div>
    </div>
  );
}
