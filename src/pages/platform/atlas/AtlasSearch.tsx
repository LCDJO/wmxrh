/**
 * AtlasSearch — Global search for fields/columns across the entire database.
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSchemaData } from '@/domains/platform/system-atlas/use-schema-data';
import { getModuleForTable } from '@/domains/platform/system-atlas/module-table-mapping';
import { Search, Database, Table2, Loader2 } from 'lucide-react';

interface SearchResult {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  module_label?: string;
}

export default function AtlasSearch() {
  const { data: schema, loading } = useSchemaData();
  const [query, setQuery] = useState('');

  const results = useMemo<SearchResult[]>(() => {
    if (!schema || query.length < 2) return [];
    const q = query.toLowerCase();
    const matches: SearchResult[] = [];
    for (const table of schema.tables) {
      for (const col of table.columns) {
        if (col.column_name.toLowerCase().includes(q) || table.table_name.toLowerCase().includes(q)) {
          const mod = getModuleForTable(table.table_name);
          matches.push({
            table_name: table.table_name,
            column_name: col.column_name,
            data_type: col.data_type,
            udt_name: col.udt_name,
            module_label: mod?.label,
          });
        }
      }
    }
    // Sort: exact column match first, then table match
    return matches
      .sort((a, b) => {
        const aExact = a.column_name.toLowerCase().includes(q) ? 0 : 1;
        const bExact = b.column_name.toLowerCase().includes(q) ? 0 : 1;
        return aExact - bExact || a.table_name.localeCompare(b.table_name);
      })
      .slice(0, 200);
  }, [schema, query]);

  // Group by table
  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const arr = map.get(r.table_name) ?? [];
      arr.push(r);
      map.set(r.table_name, arr);
    }
    return Array.from(map.entries());
  }, [results]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Pesquisa Global de Dados
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pesquise por nome de coluna ou tabela para encontrar onde cada campo aparece no banco de dados.
          </p>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ex: cpf, tenant_id, email, employee..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-9 text-sm"
              autoFocus
            />
          </div>
        </CardContent>
      </Card>

      {query.length >= 2 && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {results.length} resultado{results.length !== 1 ? 's' : ''} em {grouped.length} tabela{grouped.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      )}

      <ScrollArea className="h-[calc(100vh-400px)]">
        <div className="space-y-3">
          {grouped.map(([tableName, cols]) => (
            <Card key={tableName} className="border-border/50 bg-card/80">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-primary" />
                  <span className="font-mono font-semibold text-sm text-foreground">{tableName}</span>
                  {cols[0].module_label && (
                    <Badge variant="secondary" className="text-[9px] ml-2">{cols[0].module_label}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="space-y-1">
                  {cols.map(col => (
                    <div key={col.column_name} className="flex items-center gap-3 text-xs">
                      <Database className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-mono text-foreground font-medium">{col.column_name}</span>
                      <Badge variant="outline" className="text-[9px] ml-auto">{col.udt_name}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {query.length >= 2 && results.length === 0 && (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground">Nenhum resultado encontrado para "{query}"</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
