/**
 * PlatformEvents — Dashboard listing all domain events across modules.
 */
import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Zap, Filter, RefreshCw, Activity, Layers, Eye, Box } from 'lucide-react';
import { toast } from 'sonner';
import { EVENT_CATALOG, ALL_DOMAINS, type EventCatalogEntry } from './event-catalog-data';

export default function PlatformEvents() {
  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setRefreshKey(k => k + 1);
      setIsRefreshing(false);
      toast.success(`Catálogo atualizado — ${EVENT_CATALOG.length} eventos carregados`);
    }, 400);
  }, []);

  const filtered = useMemo(() => {
    void refreshKey;
    return EVENT_CATALOG.filter(e => {
      const matchesDomain = selectedDomain === 'all' || e.domain === selectedDomain;
      const matchesSearch =
        !search ||
        e.eventName.toLowerCase().includes(search.toLowerCase()) ||
        e.description.toLowerCase().includes(search.toLowerCase()) ||
        e.domain.toLowerCase().includes(search.toLowerCase());
      return matchesDomain && matchesSearch;
    });
  }, [search, selectedDomain, refreshKey]);

  const groupedByDomain = useMemo(() => {
    const map = new Map<string, EventCatalogEntry[]>();
    for (const entry of filtered) {
      const list = map.get(entry.domain) ?? [];
      list.push(entry);
      map.set(entry.domain, list);
    }
    return map;
  }, [filtered]);

  const statCards = [
    { label: 'Total de Eventos', value: EVENT_CATALOG.length, icon: Zap, accent: 'hsl(265 80% 55%)' },
    { label: 'Domínios', value: ALL_DOMAINS.length, icon: Layers, accent: 'hsl(280 75% 60%)' },
    { label: 'Filtrados', value: filtered.length, icon: Eye, accent: 'hsl(250 70% 58%)' },
    { label: 'Domínios Visíveis', value: groupedByDomain.size, icon: Box, accent: 'hsl(290 65% 55%)' },
  ];

  return (
    <div className="space-y-8">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-xl gradient-platform-surface border border-platform p-6 md:p-8">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, hsl(265 80% 55%), transparent 70%)' }} />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, hsl(280 75% 60%), transparent 70%)' }} />
        
        <div className="relative flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-platform-accent shadow-platform">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  Catálogo de Eventos
                </h1>
                <p className="text-sm text-muted-foreground">
                  Eventos de domínio emitidos pelo sistema, organizados por módulo.
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="shrink-0 border-platform hover:bg-accent/50 transition-all duration-200"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, accent }) => (
          <Card key={label} className="group relative overflow-hidden border-border/60 hover:border-platform transition-all duration-300 hover:shadow-platform">
            <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-2">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg"
                  style={{ backgroundColor: `${accent}15` }}
                >
                  <Icon className="h-4 w-4" style={{ color: accent }} />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {value}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar evento, domínio ou descrição..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 border-border/60 focus-visible:ring-platform focus-visible:border-platform transition-colors"
          />
        </div>
        <Select value={selectedDomain} onValueChange={setSelectedDomain}>
          <SelectTrigger className="w-full sm:w-[220px] h-10 border-border/60">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filtrar domínio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Domínios</SelectItem>
            {ALL_DOMAINS.map(d => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Domain Groups ── */}
      <ScrollArea className="h-[calc(100vh-440px)]">
        <div className="space-y-5">
          {[...groupedByDomain.entries()].map(([domain, events]) => {
            const color = events[0]?.domainColor ?? 'hsl(0 0% 50%)';
            return (
              <Card key={domain} className="overflow-hidden border-border/60 shadow-card hover:shadow-card-hover transition-shadow duration-300">
                {/* Domain header bar */}
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/40" style={{ background: `linear-gradient(135deg, ${color}08, transparent)` }}>
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color, boxShadow: `0 0 0 3px ${color}30` }}
                  />
                  <span className="text-sm font-semibold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                    {domain}
                  </span>
                  <Badge
                    variant="secondary"
                    className="ml-auto text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${color}12`, color }}
                  >
                    {events.length} evento{events.length > 1 ? 's' : ''}
                  </Badge>
                </div>

                {/* Event rows */}
                <CardContent className="p-0">
                  <div className="divide-y divide-border/40">
                    {events.map((ev, i) => (
                      <div
                        key={ev.eventName}
                        className="group/row flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors duration-150"
                      >
                        <div
                          className="flex items-center justify-center w-7 h-7 rounded-md shrink-0 transition-transform duration-200 group-hover/row:scale-110"
                          style={{ backgroundColor: `${color}10` }}
                        >
                          <Zap className="h-3.5 w-3.5" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <code className="text-[13px] font-semibold text-foreground tracking-tight">
                            {ev.eventName}
                          </code>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {ev.description}
                          </p>
                        </div>
                        <span className="hidden sm:inline-flex text-[10px] text-muted-foreground/60 font-mono tabular-nums shrink-0">
                          #{String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {groupedByDomain.size === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted/50 mb-4">
                <Search className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhum evento encontrado</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Tente ajustar os filtros aplicados.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
