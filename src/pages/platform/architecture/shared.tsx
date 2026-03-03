/**
 * Shared components for Architecture Intelligence sub-pages
 */
import type { ArchModuleInfo, DeliverableStatus } from '@/domains/architecture-intelligence';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const statusColor: Record<string, string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  down: 'bg-destructive',
  unknown: 'bg-muted-foreground/40',
};

export const deliverableVariant: Record<DeliverableStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  done: 'default',
  in_progress: 'secondary',
  planned: 'outline',
  blocked: 'destructive',
};

export function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">{icon}<span className="text-xs">{label}</span></div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

export function ModuleCard({ mod, onClick }: { mod: ArchModuleInfo; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-lg border p-3 hover:border-primary/40 hover:bg-accent/5 transition-colors w-full"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm">{mod.label}</span>
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${statusColor[mod.status]}`} />
          <Badge variant="outline" className="text-xs">{mod.version_tag}</Badge>
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{mod.description}</p>
    </button>
  );
}
