/**
 * AtlasModuleView — Visual overview of all system modules with their tables and dependencies.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { MODULE_TABLE_MAP, type ModuleMapping } from '@/domains/platform/system-atlas/module-table-mapping';
import { useSchemaData } from '@/domains/platform/system-atlas/use-schema-data';
import { Boxes, Database, Globe, GitBranch, ChevronRight, Search, Table2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AtlasModuleView() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ModuleMapping | null>(null);
  const { data: schema } = useSchemaData();

  const filtered = MODULE_TABLE_MAP.filter(m =>
    m.label.toLowerCase().includes(search.toLowerCase()) ||
    m.key.toLowerCase().includes(search.toLowerCase())
  );

  const getTableCount = (mod: ModuleMapping) => {
    if (!schema) return mod.tables.length;
    return mod.tables.filter(t => schema.tables.some(st => st.table_name === t)).length;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Module List */}
      <div className="lg:col-span-1 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar módulo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-2 pr-2">
            {filtered.map(mod => (
              <Card
                key={mod.key}
                className={cn(
                  'cursor-pointer transition-all hover:border-primary/40',
                  selected?.key === mod.key && 'border-primary bg-primary/5'
                )}
                onClick={() => setSelected(mod)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Boxes className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm text-foreground">{mod.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{mod.description}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px]">
                      <Database className="h-3 w-3 mr-1" />
                      {getTableCount(mod)} tabelas
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      <Globe className="h-3 w-3 mr-1" />
                      {mod.apis.length} APIs
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Module Detail */}
      <div className="lg:col-span-2">
        {selected ? (
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Boxes className="h-5 w-5 text-primary" />
                {selected.label}
                <Badge variant="secondary" className="text-xs ml-2">{selected.key}</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">{selected.description}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tables */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-primary" /> Tabelas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selected.tables.map(t => {
                    const exists = schema?.tables.some(st => st.table_name === t);
                    const colCount = schema?.tables.find(st => st.table_name === t)?.columns.length ?? 0;
                    return (
                      <div key={t} className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono",
                        exists !== false ? 'border-primary/20 bg-primary/5 text-foreground' : 'border-destructive/20 bg-destructive/5 text-muted-foreground'
                      )}>
                        <Database className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">{t}</span>
                        {colCount > 0 && (
                          <Badge variant="outline" className="text-[9px] ml-auto shrink-0">{colCount} cols</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* APIs */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" /> APIs / Endpoints
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selected.apis.map(api => (
                    <Badge key={api} variant="outline" className="text-xs font-mono">
                      {api}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Dependencies */}
              {selected.dependencies.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-primary" /> Dependências
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.dependencies.map(dep => {
                      const depMod = MODULE_TABLE_MAP.find(m => m.key === dep);
                      return (
                        <div
                          key={dep}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/30 bg-accent/5 text-xs font-medium cursor-pointer hover:border-primary/40 transition-colors"
                          onClick={() => depMod && setSelected(depMod)}
                        >
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          {depMod?.label ?? dep}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dependents */}
              {(() => {
                const dependents = MODULE_TABLE_MAP.filter(m => m.dependencies.includes(selected.key));
                if (dependents.length === 0) return null;
                return (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-amber-500" /> Dependentes (quem depende deste módulo)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {dependents.map(dep => (
                        <div
                          key={dep.key}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs font-medium cursor-pointer hover:border-primary/40 transition-colors"
                          onClick={() => setSelected(dep)}
                        >
                          {dep.label}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardContent className="flex items-center justify-center h-64">
              <div className="text-center text-muted-foreground">
                <Boxes className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione um módulo para ver detalhes</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
