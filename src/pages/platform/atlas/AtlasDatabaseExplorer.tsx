/**
 * AtlasDatabaseExplorer — Visual database table and column browser.
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useSchemaData, type SchemaTable } from '@/domains/platform/system-atlas/use-schema-data';
import { Database, Search, Table2, Key, Link2, Hash, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function typeColor(udt: string): string {
  if (['uuid', 'text', 'varchar', 'char', 'name'].includes(udt)) return 'text-blue-400';
  if (['int4', 'int8', 'int2', 'float4', 'float8', 'numeric'].includes(udt)) return 'text-emerald-400';
  if (['bool'].includes(udt)) return 'text-amber-400';
  if (['timestamptz', 'timestamp', 'date', 'time'].includes(udt)) return 'text-purple-400';
  if (['jsonb', 'json'].includes(udt)) return 'text-orange-400';
  return 'text-muted-foreground';
}

export default function AtlasDatabaseExplorer() {
  const { data: schema, loading, error, refresh } = useSchemaData();
  const [search, setSearch] = useState('');
  const [selectedTable, setSelectedTable] = useState<SchemaTable | null>(null);

  const filteredTables = useMemo(() => {
    if (!schema) return [];
    return schema.tables
      .filter(t => t.table_name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.table_name.localeCompare(b.table_name));
  }, [schema, search]);

  const pkColumns = useMemo(() => {
    if (!schema || !selectedTable) return new Set<string>();
    return new Set(
      schema.primary_keys
        .filter(pk => pk.table_name === selectedTable.table_name)
        .map(pk => pk.column_name)
    );
  }, [schema, selectedTable]);

  const fkColumns = useMemo(() => {
    if (!schema || !selectedTable) return new Map<string, string>();
    const map = new Map<string, string>();
    schema.foreign_keys
      .filter(fk => fk.source_table === selectedTable.table_name)
      .forEach(fk => map.set(fk.source_column, `→ ${fk.target_table}.${fk.target_column}`));
    return map;
  }, [schema, selectedTable]);

  const indexedColumns = useMemo(() => {
    if (!schema || !selectedTable) return new Set<string>();
    return new Set(
      schema.indexes
        .filter(idx => idx.table_name === selectedTable.table_name)
        .map(idx => idx.column_name)
    );
  }, [schema, selectedTable]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando schema...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={refresh} className="mt-2 text-xs text-primary underline">Tentar novamente</button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Table list */}
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            {schema?.tables.length ?? 0} tabelas
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filtrar tabelas..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <ScrollArea className="h-[calc(100vh-360px)]">
          <div className="space-y-1 pr-2">
            {filteredTables.map(t => (
              <div
                key={t.table_name}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs font-mono transition-colors",
                  selectedTable?.table_name === t.table_name
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'hover:bg-muted/50 text-foreground'
                )}
                onClick={() => setSelectedTable(t)}
              >
                <Table2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t.table_name}</span>
                <Badge variant="outline" className="text-[9px] ml-auto shrink-0">{t.columns.length}</Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Column detail */}
      <div className="lg:col-span-2">
        {selectedTable ? (
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 font-mono">
                <Database className="h-4 w-4 text-primary" />
                {selectedTable.table_name}
                <Badge variant="secondary" className="text-[10px] ml-2">{selectedTable.columns.length} colunas</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-400px)]">
                <div className="space-y-1">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                    <div className="col-span-1"></div>
                    <div className="col-span-3">Coluna</div>
                    <div className="col-span-2">Tipo</div>
                    <div className="col-span-2">Nullable</div>
                    <div className="col-span-4">Referência / Default</div>
                  </div>
                  {selectedTable.columns.map(col => {
                    const isPk = pkColumns.has(col.column_name);
                    const fkRef = fkColumns.get(col.column_name);
                    const isIndexed = indexedColumns.has(col.column_name);
                    return (
                      <div
                        key={col.column_name}
                        className={cn(
                          "grid grid-cols-12 gap-2 px-3 py-2 text-xs rounded-md",
                          isPk && 'bg-primary/5',
                          fkRef && !isPk && 'bg-accent/5'
                        )}
                      >
                        <div className="col-span-1 flex gap-1">
                          {isPk && <Key className="h-3 w-3 text-amber-400" title="Primary Key" />}
                          {fkRef && <Link2 className="h-3 w-3 text-blue-400" title="Foreign Key" />}
                          {isIndexed && !isPk && <Hash className="h-3 w-3 text-muted-foreground" title="Index" />}
                        </div>
                        <div className="col-span-3 font-mono font-medium text-foreground truncate">{col.column_name}</div>
                        <div className={cn("col-span-2 font-mono", typeColor(col.udt_name))}>{col.udt_name}</div>
                        <div className="col-span-2">
                          <Badge variant={col.is_nullable === 'YES' ? 'outline' : 'secondary'} className="text-[9px]">
                            {col.is_nullable === 'YES' ? 'nullable' : 'required'}
                          </Badge>
                        </div>
                        <div className="col-span-4 text-muted-foreground truncate">
                          {fkRef ? (
                            <span className="text-blue-400 font-mono">{fkRef}</span>
                          ) : col.column_default ? (
                            <span className="font-mono text-[10px]">{col.column_default.slice(0, 40)}</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardContent className="flex items-center justify-center h-64">
              <div className="text-center text-muted-foreground">
                <Database className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione uma tabela para explorar suas colunas</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
