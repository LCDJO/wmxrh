/**
 * DependencyGraphViewer — Visual dependency graph between platform modules.
 */
import { useMemo } from 'react';
import { Network, ArrowRight, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ROLLBACK_PROTECTED_MODULES } from '@/domains/platform-versioning/types';

interface DepEdge {
  from: string;
  to: string;
  required_version: string;
  satisfied: boolean;
  is_mandatory: boolean;
}

const MOCK_EDGES: DepEdge[] = [
  { from: 'growth_engine', to: 'billing_core', required_version: '>=1.5.0', satisfied: true, is_mandatory: true },
  { from: 'growth_engine', to: 'iam', required_version: '>=1.0.0', satisfied: true, is_mandatory: true },
  { from: 'landing_engine', to: 'growth_engine', required_version: '>=2.0.0', satisfied: true, is_mandatory: true },
  { from: 'website_engine', to: 'growth_engine', required_version: '>=1.5.0', satisfied: true, is_mandatory: false },
  { from: 'automation', to: 'core_hr', required_version: '>=3.0.0', satisfied: true, is_mandatory: true },
  { from: 'compensation_engine', to: 'billing_core', required_version: '>=2.0.0', satisfied: true, is_mandatory: true },
  { from: 'revenue_intelligence', to: 'billing_core', required_version: '>=2.0.0', satisfied: true, is_mandatory: true },
  { from: 'coupon_engine', to: 'billing_core', required_version: '>=1.5.0', satisfied: true, is_mandatory: true },
];

const ALL_MODULES = [...new Set(MOCK_EDGES.flatMap(e => [e.from, e.to]))];

export function DependencyGraphViewer() {
  const hasConflicts = MOCK_EDGES.some(e => !e.satisfied);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            Grafo de Dependências
          </CardTitle>
          <Badge variant={hasConflicts ? 'destructive' : 'outline'} className="text-xs">
            {hasConflicts ? (
              <><AlertTriangle className="h-3 w-3 mr-1" /> Conflitos</>
            ) : (
              <><CheckCircle2 className="h-3 w-3 mr-1" /> Resolvido</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Module nodes */}
        <div className="flex flex-wrap gap-2 mb-5">
          {ALL_MODULES.map(m => {
            const isProtected = ROLLBACK_PROTECTED_MODULES.includes(m);
            return (
              <div
                key={m}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium',
                  isProtected
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : 'border-primary/30 bg-primary/8 text-primary'
                )}
              >
                {isProtected && <ShieldAlert className="h-3 w-3" />}
                {m}
              </div>
            );
          })}
        </div>

        {/* Edge list */}
        <ScrollArea className="h-[320px] pr-2">
          <div className="space-y-2">
            {MOCK_EDGES.map((edge, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-2.5 text-xs',
                  edge.satisfied
                    ? 'border-border/40 bg-muted/30'
                    : 'border-destructive/40 bg-destructive/8'
                )}
              >
                <span className="font-mono font-semibold text-foreground">{edge.from}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="font-mono font-semibold text-foreground">{edge.to}</span>
                <Badge variant="outline" className="text-[10px] ml-auto">
                  {edge.required_version}
                </Badge>
                {!edge.is_mandatory && (
                  <Badge variant="outline" className="text-[10px] border-muted text-muted-foreground">
                    opcional
                  </Badge>
                )}
                {edge.satisfied ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
