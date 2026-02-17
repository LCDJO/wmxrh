/**
 * ReleaseDiffViewer — Shows grouped releases with platform + module versions.
 */
import { useState } from 'react';
import { Rocket, ChevronDown, ChevronRight, Tag, Layers, Calendar, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface ReleaseEntry {
  id: string;
  name: string;
  status: 'draft' | 'candidate' | 'final' | 'rolled_back';
  platform_version_tag: string | null;
  module_versions: { module_id: string; version_tag: string }[];
  created_at: string;
  created_by: string;
  finalized_at: string | null;
}

const MOCK_RELEASES: ReleaseEntry[] = [
  {
    id: 'r3', name: 'Sprint 44 — Growth v2', status: 'final',
    platform_version_tag: 'v4.2.0',
    module_versions: [
      { module_id: 'growth_engine', version_tag: 'v2.0.0' },
      { module_id: 'landing_engine', version_tag: 'v1.3.0' },
      { module_id: 'billing_core', version_tag: 'v2.1.0' },
    ],
    created_at: '2026-02-14T08:00:00Z', created_by: 'admin', finalized_at: '2026-02-15T18:00:00Z',
  },
  {
    id: 'r2', name: 'Sprint 43 — IAM Roles', status: 'final',
    platform_version_tag: 'v4.1.0',
    module_versions: [
      { module_id: 'iam', version_tag: 'v1.2.0' },
      { module_id: 'core_hr', version_tag: 'v3.2.0' },
    ],
    created_at: '2026-02-01T08:00:00Z', created_by: 'admin', finalized_at: '2026-02-03T14:00:00Z',
  },
  {
    id: 'r1', name: 'Sprint 42 — Billing Overhaul', status: 'rolled_back',
    platform_version_tag: 'v4.0.0',
    module_versions: [
      { module_id: 'billing_core', version_tag: 'v2.0.0' },
      { module_id: 'compensation_engine', version_tag: 'v1.8.0' },
    ],
    created_at: '2026-01-18T08:00:00Z', created_by: 'admin', finalized_at: '2026-01-20T16:00:00Z',
  },
  {
    id: 'rc1', name: 'Sprint 45 — Website v2', status: 'candidate',
    platform_version_tag: null,
    module_versions: [
      { module_id: 'website_engine', version_tag: 'v2.0.0' },
    ],
    created_at: '2026-02-16T08:00:00Z', created_by: 'admin', finalized_at: null,
  },
];

const STATUS_MAP: Record<string, { label: string; style: string }> = {
  draft: { label: 'Draft', style: 'bg-muted text-muted-foreground border-border' },
  candidate: { label: 'Candidate', style: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  final: { label: 'Final', style: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  rolled_back: { label: 'Rolled Back', style: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export function ReleaseDiffViewer({ canPublish = true }: { canPublish?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(MOCK_RELEASES[0]?.id ?? null);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          Platform Releases
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[420px] pr-2">
          <div className="space-y-2">
            {MOCK_RELEASES.map(r => {
              const st = STATUS_MAP[r.status];
              const isOpen = openId === r.id;
              return (
                <Collapsible key={r.id} open={isOpen} onOpenChange={() => setOpenId(isOpen ? null : r.id)}>
                  <CollapsibleTrigger className="w-full">
                    <div className={cn(
                      'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40',
                      isOpen ? 'border-primary/40 bg-primary/5' : 'border-border/40'
                    )}>
                      {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">{r.name}</span>
                          <Badge variant="outline" className={cn('text-[10px] border', st.style)}>{st.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                          {r.platform_version_tag && <span className="flex items-center gap-0.5"><Tag className="h-2.5 w-2.5" />{r.platform_version_tag}</span>}
                          <span className="flex items-center gap-0.5"><Layers className="h-2.5 w-2.5" />{r.module_versions.length} módulos</span>
                          <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-7 mt-1 space-y-1.5 pb-2">
                      {r.module_versions.map(mv => (
                        <div key={mv.module_id} className="flex items-center gap-2 rounded border border-border/30 bg-muted/20 px-3 py-1.5 text-xs">
                          <Layers className="h-3 w-3 text-primary" />
                          <span className="font-medium text-foreground">{mv.module_id}</span>
                          <span className="font-mono text-muted-foreground ml-auto">{mv.version_tag}</span>
                        </div>
                      ))}
                      {r.finalized_at && (
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <User className="h-2.5 w-2.5" /> Finalizado por {r.created_by} em {new Date(r.finalized_at).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
