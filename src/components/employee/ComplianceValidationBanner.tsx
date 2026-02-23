/**
 * Compliance Validation Banner
 *
 * Displays compliance validation results for the employee master record.
 * Shows blockers, warnings and info items.
 */
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, XCircle, CheckCircle, Info } from 'lucide-react';
import { complianceValidationService } from '@/domains/employee-master-record';
import type { EmployeeMasterRecord } from '@/domains/employee-master-record';
import type { ComplianceValidationItem } from '@/domains/employee-master-record';

interface Props {
  record: EmployeeMasterRecord | null | undefined;
  exams: any[];
  pisoSalarial?: number;
}

const SEVERITY_ICON = {
  blocker: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const SEVERITY_COLORS = {
  blocker: 'text-destructive',
  warning: 'text-yellow-600 dark:text-yellow-400',
  info: 'text-muted-foreground',
} as const;

export function ComplianceValidationBanner({ record, exams, pisoSalarial }: Props) {
  const result = useMemo(() => {
    if (!record) return null;
    return complianceValidationService.validate(record, exams, pisoSalarial);
  }, [record, exams, pisoSalarial]);

  if (!result || result.items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        <p className="text-sm text-card-foreground">Todas as validações de conformidade passaram.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!result.canActivate && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
          <XCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm font-medium text-destructive">Ativação bloqueada — corrija os itens abaixo.</p>
        </div>
      )}
      {result.items.map((item) => (
        <ValidationItem key={item.code} item={item} />
      ))}
    </div>
  );
}

function ValidationItem({ item }: { item: ComplianceValidationItem }) {
  const Icon = SEVERITY_ICON[item.severity];
  const color = SEVERITY_COLORS[item.severity];

  return (
    <div className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-card-foreground">{item.message}</p>
        {item.legal_basis && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.legal_basis}</p>
        )}
      </div>
      <Badge
        variant={item.severity === 'blocker' ? 'destructive' : 'outline'}
        className="text-xs shrink-0"
      >
        {item.severity === 'blocker' ? 'Bloqueio' : item.severity === 'warning' ? 'Alerta' : 'Info'}
      </Badge>
    </div>
  );
}
