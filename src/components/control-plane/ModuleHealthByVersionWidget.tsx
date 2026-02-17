/**
 * ModuleHealthByVersionWidget — Module health status correlated with version info.
 */
import { GitBranch, CheckCircle2, AlertTriangle, XCircle, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ROLLBACK_PROTECTED_MODULES } from '@/domains/platform-versioning/types';

interface ModuleHealthEntry {
  module_id: string;
  version_tag: string;
  health: 'healthy' | 'degraded' | 'critical';
  uptime_pct: number;
  last_incident: string | null;
  dep_conflicts: number;
}

const MOCK_DATA: ModuleHealthEntry[] = [
  { module_id: 'billing_core', version_tag: 'v2.1.0', health: 'healthy', uptime_pct: 99.98, last_incident: null, dep_conflicts: 0 },
  { module_id: 'growth_engine', version_tag: 'v2.0.0', health: 'healthy', uptime_pct: 99.9, last_incident: null, dep_conflicts: 0 },
  { module_id: 'core_hr', version_tag: 'v3.2.1', health: 'healthy', uptime_pct: 99.95, last_incident: null, dep_conflicts: 0 },
  { module_id: 'iam', version_tag: 'v1.3.0', health: 'degraded', uptime_pct: 98.2, last_incident: '2026-02-16', dep_conflicts: 0 },
  { module_id: 'landing_engine', version_tag: 'v1.3.0', health: 'healthy', uptime_pct: 99.8, last_incident: null, dep_conflicts: 0 },
  { module_id: 'automation', version_tag: 'v1.1.0', health: 'healthy', uptime_pct: 99.7, last_incident: null, dep_conflicts: 0 },
  { module_id: 'revenue_intelligence', version_tag: 'v1.0.0', health: 'healthy', uptime_pct: 100, last_incident: null, dep_conflicts: 0 },
  { module_id: 'compensation_engine', version_tag: 'v1.8.0', health: 'critical', uptime_pct: 94.5, last_incident: '2026-02-17', dep_conflicts: 1 },
];

const HEALTH_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  healthy: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  degraded: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  critical: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
};

export function ModuleHealthByVersionWidget() {
  const healthyCount = MOCK_DATA.filter(m => m.health === 'healthy').length;
  const totalCount = MOCK_DATA.length;

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            Saúde por Versão
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            {healthyCount}/{totalCount} saudáveis
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px] pr-2">
          <div className="space-y-1.5">
            {MOCK_DATA.map(m => {
              const cfg = HEALTH_CONFIG[m.health];
              const Icon = cfg.icon;
              const isProtected = ROLLBACK_PROTECTED_MODULES.includes(m.module_id);

              return (
                <div
                  key={m.module_id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-2.5 text-xs',
                    m.health === 'critical' ? 'border-destructive/30 bg-destructive/5' : 'border-border/40'
                  )}
                >
                  <div className={cn('flex h-7 w-7 items-center justify-center rounded-md shrink-0', cfg.bg)}>
                    <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground truncate">{m.module_id}</span>
                      {isProtected && <ShieldAlert className="h-3 w-3 text-amber-400 shrink-0" />}
                    </div>
                    <span className="text-muted-foreground font-mono">{m.version_tag}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('font-mono font-semibold', m.uptime_pct >= 99.5 ? 'text-emerald-400' : m.uptime_pct >= 97 ? 'text-amber-400' : 'text-destructive')}>
                      {m.uptime_pct.toFixed(1)}%
                    </p>
                    {m.dep_conflicts > 0 && (
                      <Badge variant="outline" className="text-[9px] border-destructive/30 text-destructive mt-0.5">
                        {m.dep_conflicts} conflito(s)
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
