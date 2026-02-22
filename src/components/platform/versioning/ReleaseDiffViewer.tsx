/**
 * ReleaseDiffViewer — DB-backed release viewer with promote actions.
 * Auto-seeds initial production release (v1.0.0) from MODULE_CATALOG.
 */
import { useState, useEffect, useCallback } from 'react';
import { Rocket, ChevronDown, ChevronRight, Tag, Layers, Calendar, User, ArrowUpCircle, Loader2, PackagePlus, CheckCircle2 } from 'lucide-react';
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

const STATUS_MAP: Record<string, { label: string; style: string; dot: string }> = {
  draft: { label: 'Draft', style: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
  candidate: { label: 'Candidate', style: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  final: { label: 'Produção', style: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  rolled_back: { label: 'Rolled Back', style: 'bg-destructive/15 text-destructive border-destructive/30', dot: 'bg-destructive' },
  archived: { label: 'Archived', style: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
};

const getModuleName = (id: string) => MODULE_CATALOG.find(m => m.module_id === id)?.name ?? id;
const getModuleCategory = (id: string) => MODULE_CATALOG.find(m => m.module_id === id)?.category ?? 'platform';

export function ReleaseDiffViewer({ canPublish = true }: { canPublish?: boolean }) {
  const { user } = useAuth();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

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

  /** Seed initial production release from MODULE_CATALOG */
  const handleSeedInitialRelease = async () => {
    setSeeding(true);
    try {
      const engine = getAdvancedVersioningEngine();
      const userId = user?.id ?? 'system';
      const moduleVersionIds: string[] = [];

      // 1. Register + release each module version
      for (const mod of MODULE_CATALOG) {
        const existing = await engine.modules.getCurrent(mod.module_id);
        if (existing) {
          moduleVersionIds.push(existing.id);
          continue;
        }
        const mv = await engine.modules.register(
          mod.module_id,
          mod.initial_version,
          userId,
          { changelog_summary: mod.changelog_summary },
        );
        await engine.modules.release(mod.module_id, mv.id);
        moduleVersionIds.push(mv.id);
      }

      // 2. Create release with all modules → promote to final
      const release = await engine.releases.create({
        name: 'v1.0.0 — Release Inicial',
        createdBy: userId,
        module_versions: moduleVersionIds,
        dependency_snapshot: {
          timestamp: new Date().toISOString(),
          modules: MODULE_CATALOG.map(m => ({
            module_key: m.module_id,
            version: m.initial_version,
            dependencies: [],
          })),
          conflicts: [],
        },
      });

      // Draft → Candidate → Final
      await engine.releases.promoteToCandidate(release.id, userId);
      await engine.releases.finalize(release.id, userId);

      toast.success('Release inicial v1.0.0 criada em produção', {
        description: `${MODULE_CATALOG.length} módulos registrados.`,
      });
      await fetchReleases();
    } catch (err: unknown) {
      toast.error('Erro ao criar release inicial', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSeeding(false);
    }
  };

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
        const next = release.status === 'draft' ? 'Candidate' : 'Produção';
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

  // Resolve module version IDs to names (best-effort from catalog)
  const resolveModuleVersionLabel = (mvId: string): string => {
    // Try to find a matching module from catalog by ID substring
    const mod = MODULE_CATALOG.find(m => mvId.includes(m.module_id));
    return mod ? mod.name : mvId.slice(0, 8);
  };

  const currentRelease = releases.find(r => r.status === 'final');

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          Platform Releases
          {currentRelease && (
            <Badge variant="outline" className="ml-auto text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
              {currentRelease.name}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando releases...
          </div>
        ) : releases.length === 0 ? (
          <div className="text-center py-10 space-y-4">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <PackagePlus className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Nenhuma release registrada</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Crie a release inicial v1.0.0 representando o estado atual de produção com todos os {MODULE_CATALOG.length} módulos.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-2"
              disabled={seeding}
              onClick={handleSeedInitialRelease}
            >
              {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
              {seeding ? 'Criando...' : 'Criar Release v1.0.0'}
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[420px] pr-2">
            <div className="space-y-2">
              {releases.map(r => {
                const st = STATUS_MAP[r.status] ?? STATUS_MAP.draft;
                const isOpen = openId === r.id;
                const domainModules = r.module_versions.filter(mvId => {
                  const mod = MODULE_CATALOG.find(m => mvId.includes(m.module_id));
                  return mod?.category === 'domain';
                });
                const platformModules = r.module_versions.filter(mvId => {
                  const mod = MODULE_CATALOG.find(m => mvId.includes(m.module_id));
                  return !mod || mod.category === 'platform';
                });

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
                            <span className={cn('h-2 w-2 rounded-full shrink-0', st.dot)} />
                            <span className="text-sm font-semibold text-foreground truncate">{r.name}</span>
                            <Badge variant="outline" className={cn('text-[10px] border', st.style)}>{st.label}</Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground ml-4">
                            <span className="flex items-center gap-0.5"><Layers className="h-2.5 w-2.5" />{r.module_versions.length} módulos</span>
                            <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                            {r.finalized_at && (
                              <span className="flex items-center gap-0.5"><CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />Publicado {new Date(r.finalized_at).toLocaleDateString('pt-BR')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-7 mt-1 space-y-3 pb-2">
                        {r.module_versions.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Nenhuma versão de módulo vinculada.</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Módulos incluídos</p>
                            <div className="flex flex-wrap gap-1.5">
                              {r.module_versions.map((mvId) => {
                                const mod = MODULE_CATALOG.find(m => mvId.includes(m.module_id));
                                const isDomain = mod?.category === 'domain';
                                return (
                                  <Badge
                                    key={mvId}
                                    variant="outline"
                                    className={cn(
                                      'text-[10px] font-normal',
                                      isDomain
                                        ? 'bg-primary/8 text-primary border-primary/20'
                                        : 'bg-accent/40 text-accent-foreground border-accent/30'
                                    )}
                                  >
                                    {mod?.name ?? mvId.slice(0, 8)}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {r.finalized_at && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <User className="h-2.5 w-2.5" /> Finalizado em {new Date(r.finalized_at).toLocaleDateString('pt-BR')}
                          </p>
                        )}

                        {r.status !== 'final' && r.status !== 'rolled_back' && r.status !== 'archived' && (
                          <div className="pt-2 border-t border-border/20">
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
                              {r.status === 'draft' ? 'Promover a Candidate' : 'Publicar em Produção'}
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
