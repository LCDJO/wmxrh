import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RiskLevel } from './types';

const config: Record<RiskLevel, { label: string; icon: typeof ShieldCheck; className: string }> = {
  baixo: { label: 'Baixo risco', icon: ShieldCheck, className: 'bg-accent text-accent-foreground border-transparent' },
  médio: { label: 'Médio risco', icon: AlertTriangle, className: 'bg-secondary text-secondary-foreground border-transparent' },
  alto: { label: 'Alto risco', icon: ShieldAlert, className: 'bg-destructive/10 text-destructive border-transparent' },
};

export function RiskBadge({ risk, compact = false }: { risk: RiskLevel; compact?: boolean }) {
  const item = config[risk];
  const Icon = item.icon;

  return (
    <Badge className={cn('gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', item.className)}>
      <Icon className="h-3.5 w-3.5" />
      {compact ? risk : item.label}
    </Badge>
  );
}
