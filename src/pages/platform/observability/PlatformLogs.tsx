import React from 'react';
/**
 * PlatformLogs — Unified log viewer for PlatformSuperAdmin.
 *
 * Displays audit_logs separated by:
 *   - Per-tenant logs (filterable by tenant)
 *   - Global SaaS logs (no tenant context)
 *
 * Access: platform_super_admin only (enforced via route guard).
 */
import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  Shield,
  Building2,
  Globe,
  Clock,
  Filter,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { getAppErrors, clearAppErrors, onAppErrorsChange, type AppError } from '@/lib/app-error-store';

// ── Types ────────────────────────────────────────────────────

interface AuditLogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  tenant_id: string;
  company_id: string | null;
  company_group_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  real_user_id: string | null;
  active_user_id: string | null;
  impersonation_session_id: string | null;
}

interface TenantOption {
  id: string;
  name: string;
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  insert: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  update: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  delete: 'bg-destructive/15 text-destructive',
  login: 'bg-primary/15 text-primary',
  logout: 'bg-muted text-muted-foreground',
};

function actionColor(action: string): string {
  const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k));
  return key ? ACTION_COLORS[key] : 'bg-secondary text-secondary-foreground';
}

// ── Component ────────────────────────────────────────────────

export default function PlatformLogs() {
  const [tab, setTab] = useState<'tenant' | 'global' | 'app_errors'>('tenant');
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [entityTypes, setEntityTypes] = useState<string[]>([]);

  // ── App errors (in-memory) ──
  const appErrors = useSyncExternalStore(onAppErrorsChange, getAppErrors);
  useEffect(() => {
    supabase
      .from('tenants')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) setTenants(data as TenantOption[]);
      });
  }, []);

  // ── Fetch logs ──
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (tab === 'tenant' && selectedTenant !== 'all') {
        query = query.eq('tenant_id', selectedTenant);
      }

      if (entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter);
      }

      if (searchQuery.trim()) {
        query = query.or(
          `action.ilike.%${searchQuery}%,entity_type.ilike.%${searchQuery}%,entity_id.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching logs:', error);
        return;
      }

      const rows = (data ?? []) as AuditLogRow[];
      setLogs(rows);

      // Extract unique entity types for filter
      const types = [...new Set(rows.map(r => r.entity_type))].sort();
      setEntityTypes(types);
    } finally {
      setLoading(false);
    }
  }, [tab, selectedTenant, entityFilter, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Tenant name lookup ──
  const tenantName = (tenantId: string) =>
    tenants.find(t => t.id === tenantId)?.name ?? tenantId.slice(0, 8);

  // ── Filtered logs by tab ──
  const displayLogs = tab === 'global'
    ? logs
    : selectedTenant === 'all'
      ? logs
      : logs;

  // ── Stats ──
  const uniqueTenants = new Set(logs.map(l => l.tenant_id)).size;
  const uniqueActions = new Set(logs.map(l => l.action)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Logs do Sistema</h1>
            <p className="text-sm text-muted-foreground">
              Visualização unificada de auditoria — acesso exclusivo SuperAdmin
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{logs.length}</p>
              <p className="text-xs text-muted-foreground">Registros carregados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{uniqueTenants}</p>
              <p className="text-xs text-muted-foreground">Tenants com atividade</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{uniqueActions}</p>
              <p className="text-xs text-muted-foreground">Ações distintas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Tenant vs Global */}
      <Tabs value={tab} onValueChange={v => setTab(v as 'tenant' | 'global' | 'app_errors')}>
        <TabsList>
          <TabsTrigger value="tenant" className="gap-2">
            <Building2 className="h-4 w-4" />
            Por Tenant
          </TabsTrigger>
          <TabsTrigger value="global" className="gap-2">
            <Globe className="h-4 w-4" />
            Visão Global
          </TabsTrigger>
          <TabsTrigger value="app_errors" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Erros de Aplicação
            {appErrors.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">
                {appErrors.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {tab === 'tenant' && (
            <Select value={selectedTenant} onValueChange={setSelectedTenant}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Selecionar tenant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tenants</SelectItem>
                {tenants.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo de entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as entidades</SelectItem>
              {entityTypes.map(et => (
                <SelectItem key={et} value={et}>{et}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ação, entidade ou ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Content */}
        <TabsContent value="tenant" className="mt-4">
          <LogTable
            logs={displayLogs}
            expandedIds={expandedIds}
            onToggle={toggleExpand}
            tenantName={tenantName}
            showTenant={selectedTenant === 'all'}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="global" className="mt-4">
          <LogTable
            logs={displayLogs}
            expandedIds={expandedIds}
            onToggle={toggleExpand}
            tenantName={tenantName}
            showTenant
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="app_errors" className="mt-4">
          <AppErrorsTable errors={appErrors} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Log Table Sub-component ──────────────────────────────────

interface LogTableProps {
  logs: AuditLogRow[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  tenantName: (id: string) => string;
  showTenant: boolean;
  loading: boolean;
}

function LogTable({ logs, expandedIds, onToggle, tenantName, showTenant, loading }: LogTableProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <RefreshCw className="h-6 w-6 mx-auto animate-spin mb-2" />
          Carregando logs...
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum log encontrado com os filtros atuais.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <ScrollArea className="h-[600px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Data/Hora</TableHead>
              {showTenant && <TableHead>Tenant</TableHead>}
              <TableHead>Ação</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>ID Entidade</TableHead>
              <TableHead>Usuário</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map(log => {
              const isExpanded = expandedIds.has(log.id);
              const hasDetail = log.old_value || log.new_value || log.metadata;

              return (
                <LogRow
                  key={log.id}
                  log={log}
                  isExpanded={isExpanded}
                  hasDetail={!!hasDetail}
                  onToggle={onToggle}
                  tenantName={tenantName}
                  showTenant={showTenant}
                />
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </Card>
  );
}

// ── Single Log Row ───────────────────────────────────────────

interface LogRowProps {
  log: AuditLogRow;
  isExpanded: boolean;
  hasDetail: boolean;
  onToggle: (id: string) => void;
  tenantName: (id: string) => string;
  showTenant: boolean;
}

function LogRow({ log, isExpanded, hasDetail, onToggle, tenantName, showTenant }: LogRowProps) {
  return (
    <>
      <TableRow
        className={`cursor-pointer hover:bg-muted/50 ${hasDetail ? '' : 'cursor-default'}`}
        onClick={() => hasDetail && onToggle(log.id)}
      >
        <TableCell>
          {hasDetail && (
            isExpanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
        </TableCell>
        {showTenant && (
          <TableCell>
            <Badge variant="outline" className="text-xs font-mono">
              {tenantName(log.tenant_id)}
            </Badge>
          </TableCell>
        )}
        <TableCell>
          <Badge className={`text-xs ${actionColor(log.action)}`}>
            {log.action}
          </Badge>
        </TableCell>
        <TableCell className="text-sm">{log.entity_type}</TableCell>
        <TableCell className="text-xs font-mono text-muted-foreground">
          {log.entity_id ? log.entity_id.slice(0, 8) : '—'}
        </TableCell>
        <TableCell className="text-xs font-mono text-muted-foreground">
          {log.user_id ? log.user_id.slice(0, 8) : '—'}
          {log.impersonation_session_id && (
            <Badge variant="destructive" className="ml-1 text-[10px]">IMP</Badge>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded detail row */}
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={showTenant ? 7 : 6} className="bg-muted/30 p-0">
            <div className="p-4 space-y-3">
              {log.impersonation_session_id && (
                <div className="text-xs text-destructive flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Ação via impersonation — Real: {log.real_user_id?.slice(0, 8) ?? '?'} | Ativo: {log.active_user_id?.slice(0, 8) ?? '?'}
                </div>
              )}
              {log.metadata && (
                <DetailBlock label="Metadata" data={log.metadata} />
              )}
              {log.old_value && (
                <DetailBlock label="Valor Anterior" data={log.old_value} />
              )}
              {log.new_value && (
                <DetailBlock label="Valor Novo" data={log.new_value} />
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── JSON Detail Block ────────────────────────────────────────

function DetailBlock({ label, data }: { label: string; data: Record<string, unknown> }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>
      <pre className="text-xs bg-background border rounded p-2 overflow-x-auto max-h-48">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

// ── App Errors Table ─────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  error_boundary: 'Error Boundary',
  unhandled_rejection: 'Promise Rejeitada',
  global_error: 'Erro Global',
};

const SOURCE_COLORS: Record<string, string> = {
  error_boundary: 'bg-destructive/15 text-destructive',
  unhandled_rejection: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  global_error: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

function AppErrorsTable({ errors }: { errors: AppError[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (errors.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <AlertTriangle className="h-6 w-6 mx-auto mb-2 opacity-40" />
          Nenhum erro de aplicação capturado nesta sessão.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">
          {errors.length} erro(s) capturado(s) nesta sessão
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={clearAppErrors} className="gap-1 text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
          Limpar
        </Button>
      </CardHeader>
      <ScrollArea className="h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Data/Hora</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead>Rota</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errors.map(err => {
              const isExpanded = expandedIds.has(err.id);
              const hasStack = !!err.stack || !!err.componentStack;

              return (
                <React.Fragment key={err.id}>
                  <TableRow
                    className={`cursor-pointer hover:bg-muted/50`}
                    onClick={() => hasStack && toggle(err.id)}
                  >
                    <TableCell>
                      {hasStack && (
                        isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                      {format(new Date(err.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${SOURCE_COLORS[err.source] ?? 'bg-secondary text-secondary-foreground'}`}>
                        {SOURCE_LABELS[err.source] ?? err.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[400px] truncate">
                      {err.message}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {err.url}
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-muted/30 p-0">
                        <div className="p-4 space-y-3">
                          {err.stack && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Stack Trace</p>
                              <pre className="text-xs bg-background border rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap">
                                {err.stack}
                              </pre>
                            </div>
                          )}
                          {err.componentStack && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Component Stack</p>
                              <pre className="text-xs bg-background border rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap">
                                {err.componentStack}
                              </pre>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </Card>
  );
}
