/**
 * /platform/marketing/rollback — Smart Rollback Dashboard
 *
 * Shows:
 *  - Rollback history (all decisions & executions)
 *  - Financial impact avoided (revenue saved by rolling back)
 *  - Affected pages
 */
import { useMemo, useState } from 'react';
import {
  RotateCcw,
  ShieldCheck,
  DollarSign,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { RollbackDecision, RollbackExecution } from '@/domains/platform-growth/smart-rollback/types';

// ── Mock data (replace with real engine data when wired) ──

const MOCK_DECISIONS: RollbackDecision[] = [
  {
    id: 'rd-001',
    landingPageId: 'lp-pricing',
    currentVersionId: 'v3',
    targetVersionId: 'v2',
    currentVersionNumber: 3,
    targetVersionNumber: 2,
    reason: 'conversion_drop',
    mode: 'automatic',
    comparison: {
      currentVersion: {} as any,
      previousVersion: {} as any,
      conversionRateDelta: -28.5,
      revenueDelta: -34.2,
      bounceRateDelta: 15.3,
      isDegraded: true,
      confidence: 92,
      comparedAt: '2026-02-15T14:30:00Z',
    },
    decidedAt: '2026-02-15T14:30:00Z',
    approved: true,
    executedAt: '2026-02-15T14:30:05Z',
  },
  {
    id: 'rd-002',
    landingPageId: 'lp-homepage',
    currentVersionId: 'v5',
    targetVersionId: 'v4',
    currentVersionNumber: 5,
    targetVersionNumber: 4,
    reason: 'revenue_drop',
    mode: 'suggested',
    comparison: {
      currentVersion: {} as any,
      previousVersion: {} as any,
      conversionRateDelta: -12.1,
      revenueDelta: -26.8,
      bounceRateDelta: 8.4,
      isDegraded: true,
      confidence: 78,
      comparedAt: '2026-02-16T10:00:00Z',
    },
    decidedAt: '2026-02-16T10:00:00Z',
    approved: true,
    approvedBy: 'director@company.com',
    executedAt: '2026-02-16T10:05:00Z',
  },
  {
    id: 'rd-003',
    landingPageId: 'lp-trial',
    currentVersionId: 'v2',
    targetVersionId: 'v1',
    currentVersionNumber: 2,
    targetVersionNumber: 1,
    reason: 'bounce_spike',
    mode: 'suggested',
    comparison: {
      currentVersion: {} as any,
      previousVersion: {} as any,
      conversionRateDelta: -8.3,
      revenueDelta: -5.0,
      bounceRateDelta: 42.1,
      isDegraded: true,
      confidence: 65,
      comparedAt: '2026-02-17T08:00:00Z',
    },
    decidedAt: '2026-02-17T08:00:00Z',
    approved: null,
  },
];

const PAGE_NAMES: Record<string, string> = {
  'lp-pricing': 'Pricing Page',
  'lp-homepage': 'Homepage',
  'lp-trial': 'Free Trial LP',
};

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
  const decisions = MOCK_DECISIONS;

  const stats = useMemo(() => {
    const executed = decisions.filter(d => d.executedAt);
    const pending = decisions.filter(d => d.approved === null);
    const totalRevenueSaved = executed.reduce(
      (acc, d) => acc + Math.abs(d.comparison.revenueDelta),
      0,
    );
    const affectedPages = new Set(executed.map(d => d.landingPageId));

    return {
      totalRollbacks: executed.length,
      pendingSuggestions: pending.length,
      estimatedRevenueSaved: totalRevenueSaved.toFixed(1),
      affectedPages: affectedPages.size,
    };
  }, [decisions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Smart Rollback</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Histórico de reversões automáticas e impacto financeiro evitado.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
      </div>

      {/* Rollback History Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Histórico de Rollbacks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Página</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Conversão Δ</TableHead>
                <TableHead>Receita Δ</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decisions.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    {PAGE_NAMES[d.landingPageId] ?? d.landingPageId}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
