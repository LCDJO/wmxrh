/**
 * ModuleVersionTimeline — Real DB-backed timeline of module version history.
 * Includes "Seed All Modules" button for first-time initialization.
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { GitBranch, AlertTriangle, Filter, X, Loader2, Rocket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getAdvancedVersioningEngine } from '@/domains/platform-versioning';
import { seedAllModuleVersions } from '@/domains/platform-versioning/module-version-seeder';
import { MODULE_CATALOG } from '@/domains/platform-versioning/module-catalog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { ModuleVersion } from '@/domains/platform-versioning/types';

const STATUS_STYLE: Record<string, string> = {
  released: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  draft: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  deprecated: 'bg-muted text-muted-foreground border-muted',
};

const ALL = '__all__';

export function ModuleVersionTimeline() {
  const { user } = useAuth();
  const [versions, setVersions] = useState<ModuleVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const [moduleFilter, setModuleFilter] = useState<string>(ALL);
  const [versionFilter, setVersionFilter] = useState<string>(ALL);
  const [userFilter, setUserFilter] = useState<string>(ALL);

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
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
      if (result.seeded.length > 0) {
        toast.success(`${result.seeded.length} módulos versionados com sucesso.`);
      }
      if (result.skipped.length > 0) {
        toast.info(`${result.skipped.length} módulos já possuíam versão.`);
      }
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} erros ao versionar módulos.`);
      }
      await fetchVersions();
    } catch {
      toast.error('Erro ao inicializar versões dos módulos.');
    } finally {
      setSeeding(false);
    }
  };

  const moduleKeys = useMemo(() => [...new Set(versions.map(v => v.module_id))].sort(), [versions]);
  const users = useMemo(() => [...new Set(versions.map(v => v.created_by))].sort(), [versions]);

  const filtered = useMemo(() => {
    let list = versions;
    if (moduleFilter !== ALL) list = list.filter(v => v.module_id === moduleFilter);
    if (versionFilter !== ALL) list = list.filter(v => v.version_tag === versionFilter);
    if (userFilter !== ALL) list = list.filter(v => v.created_by === userFilter);
    return list;
  }, [versions, moduleFilter, versionFilter, userFilter]);

  const versionKeys = useMemo(() => {
    const base = moduleFilter !== ALL ? versions.filter(v => v.module_id === moduleFilter) : versions;
    return [...new Set(base.map(v => v.version_tag))].sort().reverse();
  }, [versions, moduleFilter]);

  const hasFilters = moduleFilter !== ALL || versionFilter !== ALL || userFilter !== ALL;

  const clearAll = () => {
    setModuleFilter(ALL);
    setVersionFilter(ALL);
    setUserFilter(ALL);
  };

  const getModuleName = (moduleId: string) => {
    return MODULE_CATALOG.find(m => m.module_id === moduleId)?.name ?? moduleId;
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            Changelog / Timeline
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <button onClick={clearAll} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3 w-3" /> Limpar filtros
              </button>
            )}
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
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

          <Select value={moduleFilter} onValueChange={v => { setModuleFilter(v); setVersionFilter(ALL); }}>
            <SelectTrigger className="h-7 w-[160px] text-xs bg-muted/40 border-border/40">
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos módulos</SelectItem>
              {moduleKeys.map(k => <SelectItem key={k} value={k}>{getModuleName(k)}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={versionFilter} onValueChange={setVersionFilter}>
            <SelectTrigger className="h-7 w-[120px] text-xs bg-muted/40 border-border/40">
              <SelectValue placeholder="Versão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas versões</SelectItem>
              {versionKeys.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="h-7 w-[120px] text-xs bg-muted/40 border-border/40">
              <SelectValue placeholder="Usuário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos usuários</SelectItem>
              {users.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Badge variant="secondary" className="text-[10px] h-5">
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando versões...
          </div>
        ) : (
          <ScrollArea className="h-[420px] pr-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <p className="text-sm text-muted-foreground">Nenhuma versão registrada.</p>
                <p className="text-xs text-muted-foreground">
                  Clique em <strong>"Inicializar Módulos"</strong> para registrar v1.0.0 de todos os módulos.
                </p>
              </div>
            ) : (
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
                        <p className="text-xs text-muted-foreground mt-0.5">{getModuleName(v.module_id)}</p>
                        <p className="text-sm text-foreground/80 mt-1">{v.changelog_summary}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {v.released_at ? new Date(v.released_at).toLocaleDateString('pt-BR') : 'Não publicado'} · {v.created_by}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
