/**
 * SecurityStatsCards — KPI cards for Security Center.
 */
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Shield, ShieldAlert, ShieldCheck, Activity, Ban } from 'lucide-react';
import type { AlertStats } from '../hooks/useSecurityAlerts';

interface Props { stats: AlertStats }

const cards = [
  { key: 'today', label: 'Alertas Hoje', icon: AlertTriangle, color: 'text-destructive' },
  { key: 'open', label: 'Alertas Abertos', icon: ShieldAlert, color: 'text-amber-500' },
  { key: 'high_risk', label: 'Alto Risco', icon: Ban, color: 'text-destructive' },
  { key: 'investigating', label: 'Em Investigação', icon: Activity, color: 'text-blue-500' },
  { key: 'resolved', label: 'Resolvidos', icon: ShieldCheck, color: 'text-emerald-500' },
  { key: 'false_positive', label: 'Falsos Positivos', icon: Shield, color: 'text-muted-foreground' },
] as const;

export function SecurityStatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(c => {
        const Icon = c.icon;
        const value = stats[c.key as keyof AlertStats];
        return (
          <Card key={c.key}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${c.color}`} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{c.label}</span>
              </div>
              <div className="text-2xl font-bold mt-1">{value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
