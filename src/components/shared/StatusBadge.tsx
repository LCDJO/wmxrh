import { cn } from '@/lib/utils';
import { EmployeeStatus } from '@/domains/shared';

const statusConfig: Record<EmployeeStatus, { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'bg-accent text-accent-foreground' },
  inactive: { label: 'Inativo', className: 'bg-muted text-muted-foreground' },
  on_leave: { label: 'Afastado', className: 'bg-warning/10 text-warning' },
};

export function StatusBadge({ status }: { status: EmployeeStatus }) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold", config.className)}>
      {config.label}
    </span>
  );
}
