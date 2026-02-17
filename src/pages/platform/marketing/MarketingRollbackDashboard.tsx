/**
 * /platform/marketing/rollback — Smart Rollback Dashboard
 *
 * Shows:
 *  - Rollback history (all decisions & executions)
 *  - Financial impact avoided (revenue saved by rolling back)
 *  - Affected pages
 *  - Pending suggestions with approve/dismiss actions
 */
import { useMemo, useCallback, useState, useEffect } from 'react';
import {
  RotateCcw,
  ShieldCheck,
  DollarSign,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { getSmartRollbackEngine } from '@/domains/platform-growth/smart-rollback/smart-rollback-engine';
import { rollbackDecisionEngine } from '@/domains/platform-growth/smart-rollback/rollback-decision-engine';
import { rollbackExecutor } from '@/domains/platform-growth/smart-rollback/rollback-executor';
import { rollbackAuditService } from '@/domains/platform-growth/smart-rollback/rollback-audit-service';
import { onGrowthEventType } from '@/domains/platform-growth/growth.events';
import type { RollbackDecision } from '@/domains/platform-growth/smart-rollback/types';
import { RollbackAlertBanner } from '@/domains/platform-growth/smart-rollback/components/RollbackAlertBanner';

// ── Helpers ──

function formatReason(reason: string): string {
  const map: Record<string, string> = {
    conversion_drop: 'Queda de conversão',
    revenue_drop: 'Queda de receita',
    bounce_spike: 'Aumento de bounce',
    combined_degradation: 'Degradação combinada',
    manual_trigger: 'Manual',
  };
  return map[reason] ?? reason;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Component ──

export default function MarketingRollbackDashboard() {
  const engine = getSmartRollbackEngine();
  const [refreshKey, setRefreshKey] = useState(0);

  // Listen for rollback events to auto-refresh
  useEffect(() => {
    const unsubs = [
      onGrowthEventType('RollbackExecuted', () => setRefreshKey(k => k + 1)),
      onGrowthEventType('RollbackSuggested', () => setRefreshKey(k => k + 1)),
      onGrowthEventType('RollbackAuditLogged', () => setRefreshKey(k => k + 1)),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  // Pull live data from engine singletons
  const decisions = useMemo(() => {
    void refreshKey; // react to changes
    return rollbackDecisionEngine.getHistory();
  }, [refreshKey]);

  const pendingSuggestions = useMemo(() => {
    void refreshKey;
    return engine.getPendingSuggestions();
  }, [engine, refreshKey]);

  const executions = useMemo(() => {
    void refreshKey;
    return rollbackExecutor.getAll();
  }, [refreshKey]);

  const auditEntries = useMemo(() => {
    void refreshKey;
    return rollbackAuditService.getAll();
  }, [refreshKey]);

  const stats = useMemo(() => {
    const executed = decisions.filter(d => d.executedAt);
    const totalRevenueSaved = executed.reduce(
      (acc, d) => acc + Math.abs(d.comparison.revenueDelta),
      0,
    );
    const affectedPages = new Set(executed.map(d => d.landingPageId));
    const completedExecutions = executions.filter(e => e.status === 'completed').length;
    const totalExecutions = executions.length;
    const successRate = totalExecutions > 0
      ? Math.round((completedExecutions / totalExecutions) * 100)
      : 100;

    return {
      totalRollbacks: executed.length,
      pendingSuggestions: pendingSuggestions.length,
      estimatedRevenueSaved: totalRevenueSaved.toFixed(1),
      affectedPages: affectedPages.size,
      successRate,
      totalAuditEntries: auditEntries.length,
    };
  }, [decisions, pendingSuggestions, executions, auditEntries]);

  // All decisions for the table (history + pending)
  const allDecisions = useMemo(() => {
    const historyIds = new Set(decisions.map(d => d.id));
    const pending = pendingSuggestions.filter(d => !historyIds.has(d.id));
    return [...pending, ...decisions];
  }, [decisions, pendingSuggestions]);

  const handleApprove = useCallback(async (decisionId: string) => {
    try {
      await engine.approveSuggested(decisionId, 'platform-user');
      toast.success('Rollback aprovado e executado com sucesso.');
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast.error(`Erro ao executar rollback: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [engine]);

  const handleDismiss = useCallback((decisionId: string) => {
    rollbackDecisionEngine.cancel(decisionId);
    toast.info('Sugestão de rollback dispensada.');
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Smart Rollback</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Histórico de reversões automáticas, impacto financeiro evitado e páginas afetadas.
        </p>
      </div>

      {/* Pending Rollback Alert Banner */}
      {pendingSuggestions.length > 0 && (
        <RollbackAlertBanner
          decisions={pendingSuggestions}
          onApprove={handleApprove}
          onDismiss={handleDismiss}
        />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          icon={<RotateCcw className="h-4 w-4" />}
          label="Rollbacks Executados"
          value={stats.totalRollbacks}
          accent="primary"
        />
        <KPICard
          icon={<Clock className="h-4 w-4" />}
          label="Sugestões Pendentes"
          value={stats.pendingSuggestions}
          accent={stats.pendingSuggestions > 0 ? 'warning' : 'muted'}
        />
        <KPICard
          icon={<DollarSign className="h-4 w-4" />}
          label="Impacto Evitado (%)"
          value={`${stats.estimatedRevenueSaved}%`}
          accent="success"
        />
        <KPICard
          icon={<FileText className="h-4 w-4" />}
          label="Páginas Afetadas"
          value={stats.affectedPages}
          accent="primary"
        />
        <KPICard
          icon={<Activity className="h-4 w-4" />}
          label="Taxa de Sucesso"
          value={`${stats.successRate}%`}
          accent="success"
        />
      </div>

      {/* Rollback History Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Histórico de Rollbacks
            {allDecisions.length > 0 && (
              <Badge variant="outline" className="ml-auto text-xs">
                {allDecisions.length} registro(s)
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allDecisions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <RotateCcw className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum rollback registrado ainda.</p>
              <p className="text-xs mt-1">
                O SmartRollbackEngine monitorará automaticamente após cada publicação.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Página</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Conversão Δ</TableHead>
                  <TableHead>Receita Δ</TableHead>
                  <TableHead>Confiança</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allDecisions.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium text-sm">
                      {d.landingPageId}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      v{d.currentVersionNumber} → v{d.targetVersionNumber}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {formatReason(d.reason)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-destructive font-medium text-sm">
                        {d.comparison.conversionRateDelta.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-destructive font-medium text-sm">
                        {d.comparison.revenueDelta.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {d.comparison.confidence}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={d.mode === 'automatic' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {d.mode === 'automatic' ? 'Auto' : 'Manual'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge decision={d} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(d.decidedAt)}
                    </TableCell>
                    <TableCell>
                      {d.approved === null && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs"
                            onClick={() => handleApprove(d.id)}
                          >
                            Reverter
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => handleDismiss(d.id)}
                          >
                            Dispensar
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Audit Trail Summary */}
      {auditEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Trilha de Auditoria
              <Badge variant="outline" className="ml-auto text-xs">
                {auditEntries.length} entrada(s)
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {auditEntries.slice(0, 20).map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between text-xs border-b border-border/50 pb-2"
                >
                  <div className="flex items-center gap-2">
                    <AuditActionIcon action={entry.action} />
                    <span className="text-muted-foreground">{entry.landingPageId}</span>
                    <span className="font-medium">
                      v{entry.fromVersion} → v{entry.toVersion}
                    </span>
                  </div>
                  <span className="text-muted-foreground">{formatDate(entry.createdAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Sub-components ──

function KPICard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: 'primary' | 'warning' | 'success' | 'muted';
}) {
  const accentClasses: Record<string, string> = {
    primary: 'text-primary',
    warning: 'text-warning',
    success: 'text-success',
    muted: 'text-muted-foreground',
  };

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={accentClasses[accent]}>{icon}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ decision }: { decision: RollbackDecision }) {
  if (decision.executedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Executado
      </span>
    );
  }
  if (decision.approved === false) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <XCircle className="h-3.5 w-3.5" />
        Cancelado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
      <AlertTriangle className="h-3.5 w-3.5" />
      Pendente
    </span>
  );
}

function AuditActionIcon({ action }: { action: string }) {
  switch (action) {
    case 'rollback_completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
    case 'rollback_failed':
      return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    case 'rollback_suggested':
      return <AlertTriangle className="h-3.5 w-3.5 text-warning" />;
    default:
      return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}
