/**
 * ModuleVersionTimeline — Grouped-by-module view with collapsible cards.
 * Each module shows its current version, status, and expandable version history.
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  GitBranch, AlertTriangle, Loader2, Rocket, ChevronDown, ChevronRight,
  Package, Clock, User, Tag, Search, CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getAdvancedVersioningEngine } from '@/domains/platform-versioning';
import { seedAllModuleVersions } from '@/domains/platform-versioning/module-version-seeder';
import { MODULE_CATALOG } from '@/domains/platform-versioning/module-catalog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { ModuleVersion } from '@/domains/platform-versioning/types';

const STATUS_STYLE: Record<string, { label: string; dot: string; badge: string }> = {
  released: { label: 'Released', dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  draft: { label: 'Draft', dot: 'bg-amber-500', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  deprecated: { label: 'Deprecated', dot: 'bg-muted-foreground', badge: 'bg-muted text-muted-foreground border-muted' },
};

interface ModuleGroup {
  module_id: string;
  name: string;
  description: string;
  current: ModuleVersion | null;
  versions: ModuleVersion[];
  totalVersions: number;
}

export function ModuleVersionTimeline() {
  const { user } = useAuth();
  const [versions, setVersions] = useState<ModuleVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const engine = getAdvancedVersioningEngine();
      const moduleKeys = await engine.modules.listModuleKeys();
      const all: ModuleVersion[] = [];
      for (const key of moduleKeys) {
        const mvs = await engine.modules.listForModule(key);
        all.push(...mvs);
      }
      setVersions(all);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const result = await seedAllModuleVersions(user?.id ?? 'system');
      if (result.seeded.length > 0) toast.success(`${result.seeded.length} módulos versionados.`);
      if (result.skipped.length > 0) toast.info(`${result.skipped.length} já possuíam versão.`);
      if (result.errors.length > 0) toast.error(`${result.errors.length} erros.`);
      await fetchVersions();
    } catch {
      toast.error('Erro ao inicializar versões.');
    } finally {
      setSeeding(false);
    }
  };

  // Group versions by module — always show ALL modules from catalog
  const groups: ModuleGroup[] = useMemo(() => {
    const map = new Map<string, ModuleVersion[]>();
    for (const v of versions) {
      const list = map.get(v.module_id) ?? [];
      list.push(v);
      map.set(v.module_id, list);
    }

    // Start from catalog so every module appears even without DB entries
    const result: ModuleGroup[] = MODULE_CATALOG.map(cat => {
      const mvs = map.get(cat.module_id) ?? [];
      const sorted = [...mvs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const current = sorted.find(v => v.status === 'released') ?? null;
      return {
        module_id: cat.module_id,
        name: cat.name,
        description: cat.description,
        current,
        versions: sorted,
        totalVersions: sorted.length,
      };
    });

    // Also add any DB modules not in catalog (safety)
    for (const [moduleId, mvs] of map) {
      if (!MODULE_CATALOG.find(m => m.module_id === moduleId)) {
        const sorted = [...mvs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        result.push({
          module_id: moduleId,
          name: moduleId,
          description: '',
          current: sorted.find(v => v.status === 'released') ?? null,
          versions: sorted,
          totalVersions: sorted.length,
        });
      }
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [versions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.module_id.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q)
    );
  }, [groups, search]);

  const toggleModule = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedModules(new Set(filtered.map(g => g.module_id)));
  const collapseAll = () => setExpandedModules(new Set());

  const totalModules = groups.length;
  const releasedCount = groups.filter(g => g.current).length;

  return (
    <div className="space-y-4">
      {/* Header card with stats */}
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Versões por Módulo
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeed}
              disabled={seeding}
              className="h-7 text-xs gap-1.5"
            >
              {seeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
              {seeding ? 'Versionando...' : 'Inicializar Módulos'}
            </Button>
          </div>

          {/* Summary stats */}
          {totalModules > 0 && (
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                <span><strong className="text-foreground">{totalModules}</strong> módulos</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span><strong className="text-foreground">{releasedCount}</strong> com release ativa</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Tag className="h-3.5 w-3.5" />
                <span><strong className="text-foreground">{versions.length}</strong> versões totais</span>
              </div>
            </div>
          )}

          {/* Search + expand/collapse */}
          {totalModules > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar módulo..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs bg-muted/40 border-border/40"
                />
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground" onClick={expandAll}>
                  Expandir tudo
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground" onClick={collapseAll}>
                  Recolher
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Module cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando versões...
        </div>
      ) : filtered.length === 0 && !search ? (
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Nenhuma versão registrada.</p>
            <p className="text-xs text-muted-foreground">
              Clique em <strong>"Inicializar Módulos"</strong> para registrar as versões iniciais.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhum módulo encontrado para "<strong>{search}</strong>".</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filtered.map(group => {
            const isExpanded = expandedModules.has(group.module_id);
            const currentStatus = group.current ? STATUS_STYLE[group.current.status] : null;

            return (
              <Collapsible
                key={group.module_id}
                open={isExpanded}
                onOpenChange={() => toggleModule(group.module_id)}
              >
                <Card className={cn(
                  'border-border/50 bg-card/80 backdrop-blur transition-colors',
                  isExpanded && 'border-primary/30'
                )}>
                  <CollapsibleTrigger className="w-full text-left">
                    <div className="flex items-center gap-3 p-4">
                      {/* Status dot */}
                      <div className={cn(
                        'h-2.5 w-2.5 rounded-full shrink-0',
                        currentStatus?.dot ?? 'bg-muted-foreground/40'
                      )} />

                      {/* Module info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">{group.name}</span>
                          {group.current && (
                            <span className="font-mono text-xs text-primary font-medium">{group.current.version_tag}</span>
                          )}
                          {!group.current && (
                            <Badge variant="outline" className="text-[10px] border-muted text-muted-foreground">sem release</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{group.description}</p>
                      </div>

                      {/* Right side: count + chevron */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="text-[10px] h-5 font-mono">
                          {group.totalVersions} ver.
                        </Badge>
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-0">
                      <div className="border-t border-border/30 pt-3">
                        {/* Version timeline */}
                        <div className="relative ml-2 border-l-2 border-border/30 pl-5 space-y-3">
                          {group.versions.map((v, i) => {
                            const st = STATUS_STYLE[v.status] ?? STATUS_STYLE.draft;
                            const isCurrent = group.current?.id === v.id;
                            return (
                              <div key={v.id} className="relative">
                                {/* Timeline dot */}
                                <div className={cn(
                                  'absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2',
                                  isCurrent
                                    ? 'border-primary bg-primary'
                                    : 'border-border bg-background'
                                )} />

                                <div className={cn(
                                  'rounded-md border p-2.5 transition-colors',
                                  isCurrent
                                    ? 'border-primary/30 bg-primary/5'
                                    : 'border-border/30 bg-muted/10'
                                )}>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={cn(
                                      'font-mono text-xs font-semibold',
                                      isCurrent ? 'text-primary' : 'text-foreground'
                                    )}>
                                      {v.version_tag}
                                    </span>
                                    {isCurrent && (
                                      <Badge className="text-[9px] h-4 bg-primary/20 text-primary border-primary/30 border">
                                        atual
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className={cn('text-[9px] h-4 border', st.badge)}>
                                      {st.label}
                                    </Badge>
                                    {v.breaking_changes && (
                                      <Badge variant="outline" className="text-[9px] h-4 border border-destructive/40 text-destructive bg-destructive/10">
                                        <AlertTriangle className="h-2 w-2 mr-0.5" /> breaking
                                      </Badge>
                                    )}
                                  </div>

                                  {v.changelog_summary && (
                                    <p className="text-[11px] text-foreground/70 mt-1.5 leading-relaxed">
                                      {v.changelog_summary}
                                    </p>
                                  )}

                                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-2.5 w-2.5" />
                                      {v.released_at
                                        ? new Date(v.released_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                                        : 'Não publicado'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <User className="h-2.5 w-2.5" />
                                      {v.created_by}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
