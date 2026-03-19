import { useState, useCallback } from 'react';
import { FileText, Search, Filter, Loader2 } from 'lucide-react';
import { useAuditLogs } from '@/domains/hooks';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  create: 'Criação',
  update: 'Atualização',
  delete: 'Exclusão',
};

const ENTITY_LABELS: Record<string, string> = {
  employees: 'Funcionário',
  companies: 'Empresa',
  company_groups: 'Grupo',
  departments: 'Departamento',
  positions: 'Cargo',
  salary_contracts: 'Contrato Salarial',
  salary_adjustments: 'Reajuste',
  salary_additionals: 'Adicional',
  benefit_plans: 'Plano Benefício',
  employee_benefits: 'Benefício Func.',
  health_programs: 'Programa Saúde',
  employee_health_exams: 'Exame Saúde',
  employee_risk_exposures: 'Exposição Risco',
  payroll_item_catalog: 'Rubrica',
  salary_structures: 'Estrutura Salarial',
};

export default function Audit() {
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);

  // Debounce search to avoid excessive queries
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 400);
    setTimer(t);
  }, [timer]);

  const offset = page * PAGE_SIZE;

  const { data, isLoading } = useAuditLogs({
    limit: PAGE_SIZE,
    offset,
    action: actionFilter !== 'all' ? actionFilter : undefined,
    entity_type: entityFilter !== 'all' ? entityFilter : undefined,
    search: debouncedSearch || undefined,
  });

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Auditoria Legal</h1>
        <p className="text-muted-foreground mt-1">Registro imutável de todas as operações no sistema</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por entidade, ação ou ID..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={actionFilter} onValueChange={handleFilterChange(setActionFilter)}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Ações</SelectItem>
            <SelectItem value="create">Criação</SelectItem>
            <SelectItem value="update">Atualização</SelectItem>
            <SelectItem value="delete">Exclusão</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={handleFilterChange(setEntityFilter)}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Entidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Entidades</SelectItem>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {total} registro{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Log Table */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data/Hora</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Ação</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Entidade</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">ID Entidade</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Valor Anterior</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Valor Novo</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Usuário</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Carregando...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    Nenhum registro encontrado
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        log.action === 'create' ? 'bg-primary/10 text-primary' :
                        log.action === 'delete' ? 'bg-destructive/10 text-destructive' :
                        'bg-accent text-accent-foreground'
                      }`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-card-foreground">
                      {ENTITY_LABELS[log.entity_type] || log.entity_type}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground font-mono text-xs">
                      {log.entity_id ? log.entity_id.slice(0, 8) + '…' : '—'}
                    </td>
                    <td className="py-2.5 px-4 max-w-[200px]">
                      {log.old_value ? (
                        <details className="text-xs text-muted-foreground cursor-pointer">
                          <summary className="hover:text-card-foreground">Ver anterior</summary>
                          <pre className="mt-1 p-2 bg-secondary rounded text-[10px] overflow-auto max-h-32 whitespace-pre-wrap">
                            {JSON.stringify(log.old_value, null, 2)}
                          </pre>
                        </details>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="py-2.5 px-4 max-w-[200px]">
                      {log.new_value ? (
                        <details className="text-xs text-muted-foreground cursor-pointer">
                          <summary className="hover:text-card-foreground">Ver novo</summary>
                          <pre className="mt-1 p-2 bg-secondary rounded text-[10px] overflow-auto max-h-32 whitespace-pre-wrap">
                            {JSON.stringify(log.new_value, null, 2)}
                          </pre>
                        </details>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground font-mono text-xs">
                      {log.user_id ? log.user_id.slice(0, 8) + '…' : 'Sistema'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
