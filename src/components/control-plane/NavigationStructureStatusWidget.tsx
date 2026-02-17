/**
 * NavigationStructureStatusWidget — Shows current navigation/menu structure
 * health and stats in the Control Plane dashboard.
 */
import { useMemo } from 'react';
import { LayoutGrid, Layers, ShieldCheck, AlertTriangle, GitBranch, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePlatformOS } from '@/domains/platform-os/platform-context';

interface NavStats {
  totalNodes: number;
  rootCount: number;
  maxDepth: number;
  protectedCount: number;
  lastUpdated: string | null;
  health: 'healthy' | 'warning' | 'error';
  issues: string[];
}

function useNavigationStats(): NavStats {
  const os = usePlatformOS();

  return useMemo(() => {
    const tree = os.navigation.mergedTree();
    const coreEntries = tree.core ?? [];
    const moduleEntries = tree.modules ?? [];
    const all = [...coreEntries, ...moduleEntries];

    let totalNodes = 0;
    let maxDepth = 0;
    let protectedCount = 0;
    const issues: string[] = [];

    const walk = (entries: any[], depth: number) => {
      for (const e of entries) {
        totalNodes++;
        if (depth > maxDepth) maxDepth = depth;
        if (e.required_permissions?.length > 0) protectedCount++;
        if (!e.label) issues.push(`Nó sem label: ${e.path}`);
        if (!e.path) issues.push('Nó sem path detectado');
        if (e.children?.length > 0) walk(e.children, depth + 1);
      }
    };
    walk(all, 0);

    if (maxDepth > 4) issues.push(`Profundidade excessiva: ${maxDepth} níveis`);
    if (totalNodes === 0) issues.push('Nenhum nó registrado');

    const health: NavStats['health'] =
      issues.some(i => i.includes('excessiva') || i.includes('Nenhum')) ? 'error'
      : issues.length > 0 ? 'warning'
      : 'healthy';

    // Get last saved timestamp from localStorage
    let lastUpdated: string | null = null;
    try {
      const saved = localStorage.getItem('platform-menu-order');
      if (saved) lastUpdated = JSON.parse(saved).savedAt ?? null;
    } catch { /* safe */ }

    return {
      totalNodes,
      rootCount: all.length,
      maxDepth,
      protectedCount,
      lastUpdated,
      health,
      issues,
    };
  }, [os]);
}

const HEALTH_STYLE = {
  healthy: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  error: 'bg-destructive/15 text-destructive border-destructive/30',
};

const HEALTH_LABEL = {
  healthy: 'Saudável',
  warning: 'Atenção',
  error: 'Crítico',
};

export function NavigationStructureStatusWidget() {
  const stats = useNavigationStats();

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary" />
          Estrutura de Navegação
          <Badge variant="outline" className={`ml-auto text-[10px] border ${HEALTH_STYLE[stats.health]}`}>
            {HEALTH_LABEL[stats.health]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2">
          <StatCell icon={Layers} label="Total" value={stats.totalNodes} />
          <StatCell icon={LayoutGrid} label="Raízes" value={stats.rootCount} />
          <StatCell icon={GitBranch} label="Prof. Máx" value={stats.maxDepth} />
          <StatCell icon={ShieldCheck} label="Protegidos" value={stats.protectedCount} />
        </div>

        {/* Last updated */}
        {stats.lastUpdated && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Última atualização: {new Date(stats.lastUpdated).toLocaleString('pt-BR')}
          </div>
        )}

        {/* Issues */}
        {stats.issues.length > 0 && (
          <div className="space-y-1">
            {stats.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                {issue}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCell({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: number }) {
  return (
    <div className="text-center space-y-0.5">
      <Icon className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
      <div className="text-lg font-bold font-mono text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
