/**
 * Operational Command Center — Interactive real-time operations dashboard.
 * Integrates Fleet, SST, Compliance, and Risk Heatmap domains.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useScope } from '@/contexts/ScopeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Activity, AlertTriangle, Car, ShieldAlert, FileText, User,
  Clock, TrendingUp, TrendingDown, Filter, Search, RefreshCw,
  Eye, Zap, ChevronRight, BarChart3, Target, Radio, XCircle,
  CheckCircle2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════

type DomainFilter = 'all' | 'fleet' | 'sst' | 'compliance';
type SeverityFilter = 'all' | 'low' | 'medium' | 'high' | 'critical';
type TimeFilter = '1h' | '6h' | '24h' | '7d' | '30d';

interface UnifiedEvent {
  id: string;
  domain: 'fleet' | 'sst' | 'compliance';
  type: string;
  severity: string;
  description: string;
  employee_id: string | null;
  employee_name?: string;
  created_at: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

interface DomainMetrics {
  fleet: { total: number; critical: number; trend: number };
  sst: { total: number; critical: number; trend: number };
  compliance: { total: number; critical: number; trend: number };
}

interface EmployeeDrilldown {
  id: string;
  name: string;
  events: UnifiedEvent[];
  riskScore: number;
}

// ════════════════════════════════════════════════
// HOOKS
// ════════════════════════════════════════════════

function useCommandCenterData(tenantId: string | null, timeFilter: TimeFilter) {
  const cutoff = useMemo(() => {
    const now = new Date();
    const hours = { '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720 }[timeFilter];
    return new Date(now.getTime() - hours * 3600_000).toISOString();
  }, [timeFilter]);

  // Fleet behavior events
  const fleetEvents = useQuery({
    queryKey: ['cmd-fleet-events', tenantId, cutoff],
    enabled: !!tenantId,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_behavior_events')
        .select('id, event_type, severity, details, employee_id, event_timestamp, created_at')
        .eq('tenant_id', tenantId!)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map(e => ({
        id: e.id,
        domain: 'fleet' as const,
        type: e.event_type,
        severity: e.severity,
        description: `${e.event_type} — ${typeof e.details === 'object' && e.details !== null ? (e.details as Record<string, unknown>).description || '' : ''}`,
        employee_id: e.employee_id,
        created_at: e.created_at,
        status: 'active',
        metadata: typeof e.details === 'object' ? e.details as Record<string, unknown> : {},
      }));
    },
  });

  // Fleet compliance incidents
  const complianceIncidents = useQuery({
    queryKey: ['cmd-compliance-incidents', tenantId, cutoff],
    enabled: !!tenantId,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_compliance_incidents')
        .select('id, violation_type, severity, status, employee_id, notes, created_at')
        .eq('tenant_id', tenantId!)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map(e => ({
        id: e.id,
        domain: 'compliance' as const,
        type: e.violation_type,
        severity: e.severity,
        description: `Incidente: ${e.violation_type}${e.notes ? ' — ' + e.notes : ''}`,
        employee_id: e.employee_id,
        created_at: e.created_at,
        status: e.status,
        metadata: {},
      }));
    },
  });

  // Fleet warnings
  const fleetWarnings = useQuery({
    queryKey: ['cmd-fleet-warnings', tenantId, cutoff],
    enabled: !!tenantId,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_warnings')
        .select('id, warning_type, description, employee_id, signature_status, created_at')
        .eq('tenant_id', tenantId!)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map(e => ({
        id: e.id,
        domain: 'compliance' as const,
        type: e.warning_type,
        severity: 'high' as const,
        description: e.description,
        employee_id: e.employee_id,
        created_at: e.created_at,
        status: e.signature_status,
        metadata: {},
      }));
    },
  });

  // Safety tasks (SST)
  const safetyTasks = useQuery({
    queryKey: ['cmd-safety-tasks', tenantId, cutoff],
    enabled: !!tenantId,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('safety_tasks')
        .select('id, descricao, status, priority, employee_id, prazo, created_at')
        .eq('tenant_id', tenantId!)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map(e => ({
        id: e.id,
        domain: 'sst' as const,
        type: 'safety_task',
        severity: e.priority === 'critical' ? 'critical' : e.priority === 'high' ? 'high' : e.priority === 'medium' ? 'medium' : 'low',
        description: e.descricao,
        employee_id: e.employee_id,
        created_at: e.created_at,
        status: e.status,
        metadata: { prazo: e.prazo },
      }));
    },
  });

  // Employee name lookup
  const employeeIds = useMemo(() => {
    const all = [
      ...(fleetEvents.data ?? []),
      ...(complianceIncidents.data ?? []),
      ...(fleetWarnings.data ?? []),
      ...(safetyTasks.data ?? []),
    ];
    return [...new Set(all.map(e => e.employee_id).filter(Boolean))] as string[];
  }, [fleetEvents.data, complianceIncidents.data, fleetWarnings.data, safetyTasks.data]);

  const employees = useQuery({
    queryKey: ['cmd-employees', tenantId, employeeIds],
    enabled: !!tenantId && employeeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name')
        .eq('tenant_id', tenantId!)
        .in('id', employeeIds.slice(0, 100));
      if (error) throw error;
      return Object.fromEntries((data ?? []).map(e => [e.id, e.name])) as Record<string, string>;
    },
  });

  const unifiedEvents = useMemo<UnifiedEvent[]>(() => {
    const all = [
      ...(fleetEvents.data ?? []),
      ...(complianceIncidents.data ?? []),
      ...(fleetWarnings.data ?? []),
      ...(safetyTasks.data ?? []),
    ];
    const nameMap = employees.data ?? {};
    return all
      .map(e => ({ ...e, employee_name: e.employee_id ? nameMap[e.employee_id] : undefined }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [fleetEvents.data, complianceIncidents.data, fleetWarnings.data, safetyTasks.data, employees.data]);

  const metrics = useMemo<DomainMetrics>(() => {
    const calc = (domain: UnifiedEvent['domain']) => {
      const items = unifiedEvents.filter(e => e.domain === domain);
      return {
        total: items.length,
        critical: items.filter(e => e.severity === 'critical' || e.severity === 'high').length,
        trend: items.length > 0 ? Math.round((items.filter(e => e.severity === 'critical').length / items.length) * 100) : 0,
      };
    };
    return { fleet: calc('fleet'), sst: calc('sst'), compliance: calc('compliance') };
  }, [unifiedEvents]);

  const loading = fleetEvents.isLoading || complianceIncidents.isLoading || safetyTasks.isLoading;

  return { unifiedEvents, metrics, loading, employeeNames: employees.data ?? {} };
}

// ════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  low: 'bg-muted text-muted-foreground',
};

const DOMAIN_ICONS: Record<string, typeof Activity> = {
  fleet: Car,
  sst: ShieldAlert,
  compliance: FileText,
};

const DOMAIN_LABELS: Record<string, string> = {
  fleet: 'Frota',
  sst: 'SST',
  compliance: 'Compliance',
};

function MetricCard({ title, icon: Icon, value, critical, trend, color }: {
  title: string; icon: typeof Activity; value: number; critical: number; trend: number; color: string;
}) {
  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
          {trend > 20 && <TrendingUp className="h-4 w-4 text-destructive" />}
          {trend <= 20 && trend > 0 && <TrendingDown className="h-4 w-4 text-emerald-400" />}
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{title}</p>
        {critical > 0 && (
          <p className="text-xs text-destructive mt-1 font-medium">{critical} críticos</p>
        )}
      </CardContent>
    </Card>
  );
}

function EventRow({ event, onDrilldown }: { event: UnifiedEvent; onDrilldown: (id: string) => void }) {
  const Icon = DOMAIN_ICONS[event.domain] || Activity;
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/30 transition-colors group cursor-pointer"
         onClick={() => event.employee_id && onDrilldown(event.employee_id)}>
      <div className={`p-1.5 rounded-md ${
        event.severity === 'critical' ? 'bg-destructive/20' :
        event.severity === 'high' ? 'bg-orange-500/20' :
        event.severity === 'medium' ? 'bg-yellow-500/20' : 'bg-muted'
      }`}>
        <Icon className={`h-3.5 w-3.5 ${
          event.severity === 'critical' ? 'text-destructive' :
          event.severity === 'high' ? 'text-orange-400' :
          event.severity === 'medium' ? 'text-yellow-300' : 'text-muted-foreground'
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{event.description}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {event.employee_name && (
            <span className="text-xs text-primary flex items-center gap-1">
              <User className="h-3 w-3" /> {event.employee_name}
            </span>
          )}
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
      </div>
      <Badge variant="outline" className={`text-[10px] ${SEVERITY_COLORS[event.severity] || ''}`}>
        {event.severity}
      </Badge>
      <Badge variant="outline" className="text-[10px]">
        {DOMAIN_LABELS[event.domain]}
      </Badge>
      {event.employee_id && (
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}

function EmployeeDrilldownPanel({ employeeId, employeeName, events, onClose, onAction }: {
  employeeId: string; employeeName: string; events: UnifiedEvent[];
  onClose: () => void; onAction: (type: string, employeeId: string) => void;
}) {
  const byDomain = useMemo(() => ({
    fleet: events.filter(e => e.domain === 'fleet'),
    sst: events.filter(e => e.domain === 'sst'),
    compliance: events.filter(e => e.domain === 'compliance'),
  }), [events]);

  const riskScore = useMemo(() => {
    const weights = { critical: 15, high: 7, medium: 3, low: 1 };
    const total = events.reduce((sum, e) => sum + (weights[e.severity as keyof typeof weights] || 1), 0);
    return Math.min(100, total);
  }, [events]);

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              {employeeName || 'Colaborador'}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">ID: {employeeId.slice(0, 8)}…</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-sm font-bold ${
              riskScore >= 60 ? 'bg-destructive/20 text-destructive' :
              riskScore >= 30 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              <Target className="h-3 w-3 inline mr-1" />{riskScore}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-accent/30">
            <Car className="h-4 w-4 mx-auto text-blue-400" />
            <p className="text-lg font-bold">{byDomain.fleet.length}</p>
            <p className="text-[10px] text-muted-foreground">Frota</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-accent/30">
            <ShieldAlert className="h-4 w-4 mx-auto text-orange-400" />
            <p className="text-lg font-bold">{byDomain.sst.length}</p>
            <p className="text-[10px] text-muted-foreground">SST</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-accent/30">
            <FileText className="h-4 w-4 mx-auto text-purple-400" />
            <p className="text-lg font-bold">{byDomain.compliance.length}</p>
            <p className="text-[10px] text-muted-foreground">Compliance</p>
          </div>
        </div>

        {/* Recent events */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Últimos eventos</p>
          <ScrollArea className="h-40">
            <div className="space-y-1">
              {events.slice(0, 10).map(e => (
                <div key={e.id} className="flex items-center gap-2 p-2 rounded-md bg-accent/20 text-xs">
                  <Badge variant="outline" className={`text-[9px] ${SEVERITY_COLORS[e.severity]}`}>{e.severity}</Badge>
                  <span className="truncate flex-1 text-foreground">{e.description}</span>
                  <span className="text-muted-foreground shrink-0">{format(new Date(e.created_at), 'HH:mm', { locale: ptBR })}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Corrective Actions */}
        <Separator />
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Ações Corretivas</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="text-xs justify-start gap-2"
                    onClick={() => onAction('warning', employeeId)}>
              <AlertTriangle className="h-3 w-3 text-yellow-400" /> Emitir Advertência
            </Button>
            <Button variant="outline" size="sm" className="text-xs justify-start gap-2"
                    onClick={() => onAction('training', employeeId)}>
              <Zap className="h-3 w-3 text-blue-400" /> Solicitar Treinamento
            </Button>
            <Button variant="outline" size="sm" className="text-xs justify-start gap-2"
                    onClick={() => onAction('block', employeeId)}>
              <XCircle className="h-3 w-3 text-destructive" /> Bloquear Operação
            </Button>
            <Button variant="outline" size="sm" className="text-xs justify-start gap-2"
                    onClick={() => onAction('exam', employeeId)}>
              <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Agendar Exame
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════

export default function OperationalCommandCenter() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const qc = useQueryClient();

  // Filters
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24h');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('live');

  // Drilldown
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Action dialog
  const [actionDialog, setActionDialog] = useState<{ type: string; employeeId: string } | null>(null);
  const [actionNotes, setActionNotes] = useState('');

  const { unifiedEvents, metrics, loading, employeeNames } = useCommandCenterData(tenantId, timeFilter);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return unifiedEvents.filter(e => {
      if (domainFilter !== 'all' && e.domain !== domainFilter) return false;
      if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!e.description.toLowerCase().includes(q) && !(e.employee_name?.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [unifiedEvents, domainFilter, severityFilter, searchQuery]);

  // Employee drilldown data
  const drilldownData = useMemo<EmployeeDrilldown | null>(() => {
    if (!selectedEmployeeId) return null;
    const events = unifiedEvents.filter(e => e.employee_id === selectedEmployeeId);
    return {
      id: selectedEmployeeId,
      name: employeeNames[selectedEmployeeId] || 'Colaborador',
      events,
      riskScore: 0,
    };
  }, [selectedEmployeeId, unifiedEvents, employeeNames]);

  // Action execution
  const executeAction = useMutation({
    mutationFn: async ({ type, employeeId }: { type: string; employeeId: string }) => {
      // Create a safety task for the corrective action
      const { error } = await supabase.from('safety_tasks').insert({
        tenant_id: tenantId!,
        employee_id: employeeId,
        descricao: `Ação corretiva: ${type} — ${actionNotes || 'Sem observações'}`,
        status: 'pending',
        priority: type === 'block' ? 'critical' : 'high',
        prazo: new Date(Date.now() + 7 * 86400_000).toISOString(),
        workflow_id: `cmd_action_${Date.now()}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Ação corretiva registrada com sucesso');
      setActionDialog(null);
      setActionNotes('');
      qc.invalidateQueries({ queryKey: ['cmd-safety-tasks'] });
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const handleAction = useCallback((type: string, employeeId: string) => {
    setActionDialog({ type, employeeId });
  }, []);

  const ACTION_LABELS: Record<string, string> = {
    warning: 'Emitir Advertência',
    training: 'Solicitar Treinamento',
    block: 'Bloquear Operação',
    exam: 'Agendar Exame Médico',
  };

  const totalEvents = unifiedEvents.length;
  const criticalCount = unifiedEvents.filter(e => e.severity === 'critical').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary animate-pulse" />
            Operational Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento operacional em tempo real — Fleet · SST · Compliance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Activity className="h-3 w-3" /> {totalEvents} eventos
          </Badge>
          {criticalCount > 0 && (
            <Badge variant="destructive" className="gap-1 animate-pulse">
              <AlertTriangle className="h-3 w-3" /> {criticalCount} críticos
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['cmd-'] })}
                  className="gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>
      </div>

      {/* ── Metrics Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard title="Eventos de Frota" icon={Car} value={metrics.fleet.total}
                    critical={metrics.fleet.critical} trend={metrics.fleet.trend}
                    color="bg-blue-500/20 text-blue-400" />
        <MetricCard title="Tarefas SST" icon={ShieldAlert} value={metrics.sst.total}
                    critical={metrics.sst.critical} trend={metrics.sst.trend}
                    color="bg-orange-500/20 text-orange-400" />
        <MetricCard title="Incidentes Compliance" icon={FileText} value={metrics.compliance.total}
                    critical={metrics.compliance.critical} trend={metrics.compliance.trend}
                    color="bg-purple-500/20 text-purple-400" />
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="live" className="gap-1"><Radio className="h-3 w-3" /> Eventos ao Vivo</TabsTrigger>
          <TabsTrigger value="history" className="gap-1"><BarChart3 className="h-3 w-3" /> Histórico</TabsTrigger>
        </TabsList>

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição ou colaborador..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50"
            />
          </div>
          <Select value={domainFilter} onValueChange={v => setDomainFilter(v as DomainFilter)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Domínios</SelectItem>
              <SelectItem value="fleet">Frota</SelectItem>
              <SelectItem value="sst">SST</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={v => setSeverityFilter(v as SeverityFilter)}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Severidade</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
              <SelectItem value="high">Alto</SelectItem>
              <SelectItem value="medium">Médio</SelectItem>
              <SelectItem value="low">Baixo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeFilter} onValueChange={v => setTimeFilter(v as TimeFilter)}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1 hora</SelectItem>
              <SelectItem value="6h">6 horas</SelectItem>
              <SelectItem value="24h">24 horas</SelectItem>
              <SelectItem value="7d">7 dias</SelectItem>
              <SelectItem value="30d">30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="text-xs gap-1">
            <Filter className="h-3 w-3" /> {filteredEvents.length} resultados
          </Badge>
        </div>

        {/* ── Live Feed + Drilldown ── */}
        <TabsContent value="live" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Event Stream */}
            <div className={drilldownData ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
                    Feed de Eventos — Tempo Real
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-1">
                      {filteredEvents.length === 0 && !loading && (
                        <div className="text-center py-12 text-muted-foreground">
                          <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p className="text-sm">Nenhum evento encontrado para os filtros selecionados</p>
                        </div>
                      )}
                      {filteredEvents.map(event => (
                        <EventRow key={event.id} event={event} onDrilldown={setSelectedEmployeeId} />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Drilldown Panel */}
            {drilldownData && (
              <div className="lg:col-span-1">
                <EmployeeDrilldownPanel
                  employeeId={drilldownData.id}
                  employeeName={drilldownData.name}
                  events={drilldownData.events}
                  onClose={() => setSelectedEmployeeId(null)}
                  onAction={handleAction}
                />
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Historical View ── */}
        <TabsContent value="history" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Domain breakdown */}
            {(['fleet', 'sst', 'compliance'] as const).map(domain => {
              const events = filteredEvents.filter(e => e.domain === domain);
              const Icon = DOMAIN_ICONS[domain];
              const bySeverity = {
                critical: events.filter(e => e.severity === 'critical').length,
                high: events.filter(e => e.severity === 'high').length,
                medium: events.filter(e => e.severity === 'medium').length,
                low: events.filter(e => e.severity === 'low').length,
              };
              return (
                <Card key={domain} className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Icon className="h-4 w-4" /> {DOMAIN_LABELS[domain]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-destructive/10">
                          <p className="text-lg font-bold text-destructive">{bySeverity.critical}</p>
                          <p className="text-[10px] text-muted-foreground">Crítico</p>
                        </div>
                        <div className="p-2 rounded-lg bg-orange-500/10">
                          <p className="text-lg font-bold text-orange-400">{bySeverity.high}</p>
                          <p className="text-[10px] text-muted-foreground">Alto</p>
                        </div>
                        <div className="p-2 rounded-lg bg-yellow-500/10">
                          <p className="text-lg font-bold text-yellow-300">{bySeverity.medium}</p>
                          <p className="text-[10px] text-muted-foreground">Médio</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/30">
                          <p className="text-lg font-bold text-muted-foreground">{bySeverity.low}</p>
                          <p className="text-[10px] text-muted-foreground">Baixo</p>
                        </div>
                      </div>
                      <Separator />
                      <div className="text-xs text-muted-foreground">
                        Total: <span className="font-semibold text-foreground">{events.length}</span> eventos no período
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Top employees by risk */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-destructive" /> Colaboradores com Maior Risco
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {Object.entries(
                      filteredEvents.reduce<Record<string, { count: number; critical: number; name: string }>>((acc, e) => {
                        if (!e.employee_id) return acc;
                        if (!acc[e.employee_id]) acc[e.employee_id] = { count: 0, critical: 0, name: e.employee_name || e.employee_id.slice(0, 8) };
                        acc[e.employee_id].count++;
                        if (e.severity === 'critical' || e.severity === 'high') acc[e.employee_id].critical++;
                        return acc;
                      }, {})
                    )
                      .sort(([, a], [, b]) => b.critical - a.critical || b.count - a.count)
                      .slice(0, 10)
                      .map(([id, data]) => (
                        <button key={id}
                                className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-accent/30 transition-colors text-left"
                                onClick={() => setSelectedEmployeeId(id)}>
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm flex-1 truncate">{data.name}</span>
                          <Badge variant="outline" className="text-[10px]">{data.count} eventos</Badge>
                          {data.critical > 0 && (
                            <Badge variant="destructive" className="text-[10px]">{data.critical} críticos</Badge>
                          )}
                        </button>
                      ))}
                    {filteredEvents.filter(e => e.employee_id).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhum dado disponível</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Action Dialog ── */}
      <Dialog open={!!actionDialog} onOpenChange={open => { if (!open) setActionDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog ? ACTION_LABELS[actionDialog.type] : ''}</DialogTitle>
            <DialogDescription>
              Registrar ação corretiva para o colaborador {actionDialog?.employeeId ? (employeeNames[actionDialog.employeeId] || actionDialog.employeeId.slice(0, 8)) : ''}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Observações sobre a ação corretiva..."
            value={actionNotes}
            onChange={e => setActionNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={() => actionDialog && executeAction.mutate(actionDialog)}
              disabled={executeAction.isPending}
            >
              {executeAction.isPending ? 'Registrando...' : 'Confirmar Ação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
