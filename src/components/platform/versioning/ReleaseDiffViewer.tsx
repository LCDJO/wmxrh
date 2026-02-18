/**
 * ReleaseDiffViewer — DB-backed release viewer with promote actions.
 */
import { useState, useEffect, useCallback } from 'react';
import { Rocket, ChevronDown, ChevronRight, Tag, Layers, Calendar, User, ArrowUpCircle, Loader2, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getAdvancedVersioningEngine } from '@/domains/platform-versioning';
import { MODULE_CATALOG } from '@/domains/platform-versioning/module-catalog';
import { useAuth } from '@/contexts/AuthContext';
import type { Release } from '@/domains/platform-versioning/types';

const STATUS_MAP: Record<string, { label: string; style: string }> = {
  draft: { label: 'Draft', style: 'bg-muted text-muted-foreground border-border' },
  candidate: { label: 'Candidate', style: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  final: { label: 'Final', style: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  rolled_back: { label: 'Rolled Back', style: 'bg-destructive/15 text-destructive border-destructive/30' },
  archived: { label: 'Archived', style: 'bg-muted text-muted-foreground border-border' },
};

const getModuleName = (id: string) => MODULE_CATALOG.find(m => m.module_id === id)?.name ?? id;

export function ReleaseDiffViewer({ canPublish = true }: { canPublish?: boolean }) {
  const { user } = useAuth();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);

  const fetchReleases = useCallback(async () => {
    setLoading(true);
    try {
      const engine = getAdvancedVersioningEngine();
      const data = await engine.releases.list();
      setReleases(data);
      if (data.length > 0 && !openId) setOpenId(data[0].id);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReleases(); }, [fetchReleases]);

  const handlePromote = async (release: Release) => {
    const engine = getAdvancedVersioningEngine();
    const userId = user?.id ?? 'system';
    setPromoting(release.id);
    try {
      let result: Release | null = null;
      if (release.status === 'draft') {
        result = await engine.releases.promoteToCandidate(release.id, userId);
      } else if (release.status === 'candidate') {
        result = await engine.releases.finalize(release.id, userId);
      }
      if (result) {
        const next = release.status === 'draft' ? 'Candidate' : 'Final';
        toast.success(`Release promovida para ${next}`, { description: release.name });
        await fetchReleases();
      } else {
        toast.error('Não foi possível promover a release.');
      }
    } catch {
      toast.error('Erro ao promover release.');
    } finally {
      setPromoting(null);
    }
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          Platform Releases
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando releases...
          </div>
        ) : releases.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-sm text-muted-foreground">Nenhuma release registrada.</p>
            <p className="text-xs text-muted-foreground">
              Crie releases agrupando versões de módulos para publicação coordenada.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[420px] pr-2">
            <div className="space-y-2">
              {releases.map(r => {
                const st = STATUS_MAP[r.status] ?? STATUS_MAP.draft;
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
                            {r.platform_version_id && <span className="flex items-center gap-0.5"><Tag className="h-2.5 w-2.5" />Linked</span>}
                            <span className="flex items-center gap-0.5"><Layers className="h-2.5 w-2.5" />{r.module_versions.length} módulos</span>
                            <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-7 mt-1 space-y-1.5 pb-2">
                        {r.module_versions.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">Nenhuma versão de módulo vinculada.</p>
                        )}
                        {r.module_versions.map((mvId, i) => (
                          <div key={mvId} className="flex items-center gap-2 rounded border border-border/30 bg-muted/20 px-3 py-1.5 text-xs">
                            <Layers className="h-3 w-3 text-primary" />
                            <span className="font-medium text-foreground">Module Version</span>
                            <span className="font-mono text-muted-foreground ml-auto truncate max-w-[200px]">{mvId}</span>
                          </div>
                        ))}
                        {r.finalized_at && (
                          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                            <User className="h-2.5 w-2.5" /> Finalizado em {new Date(r.finalized_at).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                        {r.status !== 'final' && r.status !== 'rolled_back' && r.status !== 'archived' && (
                          <div className="mt-2 pt-2 border-t border-border/20">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canPublish || promoting === r.id}
                              title={!canPublish ? 'Permissão necessária: versioning.publish' : undefined}
                              className="h-7 text-xs gap-1.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePromote(r);
                              }}
                            >
                              {promoting === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
                              {r.status === 'draft' ? 'Promover a Candidate' : 'Publicar Release'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
