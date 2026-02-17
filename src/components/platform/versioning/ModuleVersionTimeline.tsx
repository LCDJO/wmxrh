/**
 * ModuleVersionTimeline — Visual timeline of module version history.
 */
import { useState } from 'react';
import { GitBranch, ChevronDown, ChevronRight, Tag, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ModuleVersionEntry {
  id: string;
  module_id: string;
  version_tag: string;
  status: string;
  breaking_changes: boolean;
  changelog_summary: string;
  released_at: string | null;
  created_at: string;
  created_by: string;
}

/* ─── Mock data ─── */
const MOCK_VERSIONS: ModuleVersionEntry[] = [
  { id: '1', module_id: 'billing_core', version_tag: 'v2.1.0', status: 'published', breaking_changes: false, changelog_summary: 'Suporte a múltiplas moedas', released_at: '2026-02-15T10:00:00Z', created_at: '2026-02-14T08:00:00Z', created_by: 'admin' },
  { id: '2', module_id: 'billing_core', version_tag: 'v2.0.0', status: 'published', breaking_changes: true, changelog_summary: 'Novo ledger financeiro imutável', released_at: '2026-01-20T10:00:00Z', created_at: '2026-01-18T08:00:00Z', created_by: 'admin' },
  { id: '3', module_id: 'growth_engine', version_tag: 'v2.0.0', status: 'published', breaking_changes: true, changelog_summary: 'Landing Page Builder v2 + FAB', released_at: '2026-02-10T10:00:00Z', created_at: '2026-02-08T08:00:00Z', created_by: 'admin' },
  { id: '4', module_id: 'growth_engine', version_tag: 'v1.5.0', status: 'published', breaking_changes: false, changelog_summary: 'A/B testing automático', released_at: '2026-01-05T10:00:00Z', created_at: '2026-01-03T08:00:00Z', created_by: 'admin' },
  { id: '5', module_id: 'core_hr', version_tag: 'v3.2.1', status: 'published', breaking_changes: false, changelog_summary: 'Fix cálculo de férias', released_at: '2026-02-12T10:00:00Z', created_at: '2026-02-11T08:00:00Z', created_by: 'admin' },
  { id: '6', module_id: 'iam', version_tag: 'v1.3.0', status: 'draft', breaking_changes: false, changelog_summary: 'Custom roles por empresa', released_at: null, created_at: '2026-02-16T08:00:00Z', created_by: 'admin' },
];

const STATUS_STYLE: Record<string, string> = {
  published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  draft: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  deprecated: 'bg-muted text-muted-foreground border-muted',
};

export function ModuleVersionTimeline() {
  const [filter, setFilter] = useState<string | null>(null);
  const moduleKeys = [...new Set(MOCK_VERSIONS.map(v => v.module_id))];
  const filtered = filter ? MOCK_VERSIONS.filter(v => v.module_id === filter) : MOCK_VERSIONS;

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            Timeline de Versões
          </CardTitle>
          <div className="flex gap-1.5">
            <Badge
              variant={!filter ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setFilter(null)}
            >
              Todos
            </Badge>
            {moduleKeys.map(k => (
              <Badge
                key={k}
                variant={filter === k ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => setFilter(k)}
              >
                {k}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[420px] pr-3">
          <div className="relative ml-3 border-l-2 border-border/40 pl-6 space-y-5">
            {filtered.map(v => (
              <div key={v.id} className="relative">
                <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-primary bg-background" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-foreground">{v.version_tag}</span>
                      <Badge variant="outline" className={cn('text-[10px] border', STATUS_STYLE[v.status] ?? '')}>
                        {v.status}
                      </Badge>
                      {v.breaking_changes && (
                        <Badge variant="outline" className="text-[10px] border border-destructive/40 text-destructive bg-destructive/10">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> breaking
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{v.module_id}</p>
                    <p className="text-sm text-foreground/80 mt-1">{v.changelog_summary}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {v.released_at ? new Date(v.released_at).toLocaleDateString('pt-BR') : 'Não publicado'} · {v.created_by}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
