/**
 * ActivePlatformVersionWidget — Shows the current active platform version in the Control Plane.
 */
import { Tag, Rocket, Calendar, Layers, GitBranch } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const MOCK_ACTIVE = {
  version_tag: 'v4.2.0',
  title: 'Sprint 44 — Growth v2',
  release_type: 'minor' as const,
  released_at: '2026-02-15T18:00:00Z',
  released_by: 'admin',
  modules_included: ['growth_engine', 'landing_engine', 'billing_core'],
  release_status: 'final' as const,
};

const RELEASE_TYPE_STYLE: Record<string, string> = {
  major: 'bg-destructive/15 text-destructive border-destructive/30',
  minor: 'bg-primary/15 text-primary border-primary/30',
  patch: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  hotfix: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

export function ActivePlatformVersionWidget() {
  const v = MOCK_ACTIVE;

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          Versão Ativa da Plataforma
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-mono font-bold text-foreground">{v.version_tag}</span>
          <Badge variant="outline" className={`text-[10px] border ${RELEASE_TYPE_STYLE[v.release_type] ?? ''}`}>
            {v.release_type}
          </Badge>
          <Badge variant="outline" className="text-[10px] border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            {v.release_status}
          </Badge>
        </div>

        <p className="text-sm text-foreground/80 font-medium">{v.title}</p>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(v.released_at).toLocaleDateString('pt-BR')}
          </span>
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {v.modules_included.length} módulos
          </span>
          <span className="flex items-center gap-1">
            <Rocket className="h-3 w-3" />
            {v.released_by}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {v.modules_included.map(m => (
            <Badge key={m} variant="outline" className="text-[10px] font-mono border-border/40">
              <GitBranch className="h-2.5 w-2.5 mr-0.5" />
              {m}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
