/**
 * AtlasImpactAnalysis — Shows the impact of changes to a specific table.
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSchemaData } from '@/domains/platform/system-atlas/use-schema-data';
import { MODULE_TABLE_MAP, getModuleForTable } from '@/domains/platform/system-atlas/module-table-mapping';
import { AlertTriangle, Search, Database, Boxes, Globe, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AtlasImpactAnalysis() {
  const { data: schema, loading } = useSchemaData();
  const [search, setSearch] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const tables = useMemo(() => {
    if (!schema) return [];
    return schema.tables
      .map(t => t.table_name)
      .filter(t => t.toLowerCase().includes(search.toLowerCase()))
      .sort();
  }, [schema, search]);

  // Impact analysis for selected table
  const impact = useMemo(() => {
    if (!selectedTable || !schema) return null;

    // Find modules that use this table
    const ownerModule = getModuleForTable(selectedTable);
    const allModules = MODULE_TABLE_MAP.filter(m => m.tables.includes(selectedTable));

    // Find FK references TO this table
    const inboundFKs = schema.foreign_keys.filter(fk => fk.target_table === selectedTable);
    const outboundFKs = schema.foreign_keys.filter(fk => fk.source_table === selectedTable);

    // Tables that depend on this table
    const dependentTables = [...new Set(inboundFKs.map(fk => fk.source_table))];
    // Tables this table depends on
    const dependsOn = [...new Set(outboundFKs.map(fk => fk.target_table))];

    // APIs from related modules
    const apis = allModules.flatMap(m => m.apis);

    // Risk score: more dependents = higher risk
    const riskScore = Math.min(100, dependentTables.length * 15 + inboundFKs.length * 5 + allModules.length * 10);

    return {
      ownerModule,
      allModules,
      inboundFKs,
      outboundFKs,
      dependentTables,
      dependsOn,
      apis,
      riskScore,
    };
  }, [selectedTable, schema]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Table selector */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tabela..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <ScrollArea className="h-[calc(100vh-340px)]">
          <div className="space-y-1 pr-2">
            {tables.map(t => (
              <div
                key={t}
                className={cn(
                  "px-3 py-2 rounded-lg cursor-pointer text-xs font-mono transition-colors",
                  selectedTable === t ? 'bg-primary/10 text-primary border border-primary/30' : 'hover:bg-muted/50 text-foreground'
                )}
                onClick={() => setSelectedTable(t)}
              >
                {t}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Impact detail */}
      <div className="lg:col-span-2 space-y-4">
        {impact && selectedTable ? (
          <>
            {/* Risk header */}
            <Card className={cn(
              "border-border/50",
              impact.riskScore > 60 ? 'bg-destructive/5 border-destructive/30' :
              impact.riskScore > 30 ? 'bg-amber-500/5 border-amber-500/30' :
              'bg-card/80'
            )}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-mono font-bold text-foreground">{selectedTable}</h3>
                    {impact.ownerModule && (
                      <p className="text-xs text-muted-foreground">Módulo: {impact.ownerModule.label}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Risco de Impacto</p>
                  <Badge variant={impact.riskScore > 60 ? 'destructive' : impact.riskScore > 30 ? 'outline' : 'secondary'} className="text-sm">
                    {impact.riskScore}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Modules */}
              <Card className="border-border/50 bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-primary" /> Módulos Impactados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {impact.allModules.length > 0 ? (
                    <div className="space-y-1.5">
                      {impact.allModules.map(m => (
                        <div key={m.key} className="flex items-center gap-2 text-xs">
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium text-foreground">{m.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhum módulo mapeado</p>
                  )}
                </CardContent>
              </Card>

              {/* APIs */}
              <Card className="border-border/50 bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" /> APIs Relacionadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {impact.apis.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {impact.apis.map(api => (
                        <Badge key={api} variant="outline" className="text-[10px] font-mono">{api}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma API mapeada</p>
                  )}
                </CardContent>
              </Card>

              {/* Dependent tables */}
              <Card className="border-border/50 bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> Tabelas Dependentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {impact.dependentTables.length > 0 ? (
                    <div className="space-y-1">
                      {impact.dependentTables.map(t => (
                        <div
                          key={t}
                          className="text-xs font-mono text-foreground cursor-pointer hover:text-primary transition-colors"
                          onClick={() => setSelectedTable(t)}
                        >
                          {t}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma tabela depende desta</p>
                  )}
                </CardContent>
              </Card>

              {/* Depends on */}
              <Card className="border-border/50 bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-400" /> Depende de
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {impact.dependsOn.length > 0 ? (
                    <div className="space-y-1">
                      {impact.dependsOn.map(t => (
                        <div
                          key={t}
                          className="text-xs font-mono text-foreground cursor-pointer hover:text-primary transition-colors"
                          onClick={() => setSelectedTable(t)}
                        >
                          {t}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Tabela independente</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <Card className="border-border/50 bg-card/80">
            <CardContent className="flex items-center justify-center h-64">
              <div className="text-center text-muted-foreground">
                <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione uma tabela para ver a análise de impacto</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
