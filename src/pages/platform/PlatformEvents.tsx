/**
 * PlatformEvents — Dashboard listing all domain events across modules.
 */
import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Search, Zap, RefreshCw, Activity, Layers, Eye, Box,
  Shield, Wallet, HeartPulse, AlertTriangle, Wrench, Brain,
  UserPlus, Calculator, Users, GraduationCap, Cpu, TrendingUp,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { EVENT_CATALOG, ALL_DOMAINS, type EventCatalogEntry } from './event-catalog-data';

// ── Domain visual metadata ─────────────────────────────────────

const DOMAIN_META: Record<string, { icon: typeof Shield; label?: string }> = {
  'IAM':                  { icon: Shield },
  'Billing':              { icon: Wallet },
  'Observability':        { icon: HeartPulse },
  'Security':             { icon: AlertTriangle },
  'Self-Healing':         { icon: Wrench },
  'Governance AI':        { icon: Brain },
  'Onboarding':           { icon: UserPlus },
  'Payroll':              { icon: Calculator },
  'Workforce':            { icon: Users },
  'NR Training':          { icon: GraduationCap },
  'Platform OS':          { icon: Cpu },
  'Revenue Intelligence': { icon: TrendingUp },
};

const DEFAULT_DOMAIN_META = { icon: Zap };

// ── Component ──────────────────────────────────────────────────

export default function PlatformEvents() {
  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setRefreshKey(k => k + 1);
      setIsRefreshing(false);
      toast.success(`Catálogo atualizado — ${EVENT_CATALOG.length} eventos carregados`);
    }, 400);
  }, []);

  const toggleDomain = (domain: string) => {
    setSelectedDomain(prev => prev === domain ? null : domain);
    setExpandedDomain(domain);
  };

  const filtered = useMemo(() => {
    void refreshKey;
    return EVENT_CATALOG.filter(e => {
      const matchesDomain = !selectedDomain || e.domain === selectedDomain;
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

  // Count events per domain (unfiltered)
  const domainCounts = useMemo(() => {
    const map = new Map<string, number>();
    EVENT_CATALOG.forEach(e => map.set(e.domain, (map.get(e.domain) ?? 0) + 1));
    return map;
  }, []);

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
                <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ backgroundColor: `${accent}15` }}>
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

      {/* ── Domain Selector Cards ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Selecionar Domínio</p>
        <div className="flex flex-wrap gap-2">
          {ALL_DOMAINS.map(domain => {
            const meta = DOMAIN_META[domain] ?? DEFAULT_DOMAIN_META;
            const Icon = meta.icon;
            const count = domainCounts.get(domain) ?? 0;
            const isActive = selectedDomain === domain;
            const color = EVENT_CATALOG.find(e => e.domain === domain)?.domainColor ?? 'hsl(0 0% 50%)';

            return (
              <button
                key={domain}
                type="button"
                onClick={() => toggleDomain(domain)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all duration-200',
                  isActive
                    ? 'border-transparent shadow-md scale-[1.02]'
                    : 'border-border/60 hover:border-border hover:shadow-sm bg-card',
                )}
                style={isActive ? { backgroundColor: `${color}15`, borderColor: color, boxShadow: `0 2px 12px ${color}20` } : {}}
              >
                <div
                  className={cn('flex h-7 w-7 items-center justify-center rounded-md transition-colors')}
                  style={{ backgroundColor: isActive ? `${color}20` : `${color}10` }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                </div>
                <div className="min-w-0">
                  <p className={cn('text-xs font-semibold truncate', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                    {domain}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 rounded-full ml-1 tabular-nums"
                  style={isActive ? { backgroundColor: `${color}20`, color } : {}}
                >
                  {count}
                </Badge>
              </button>
            );
          })}

          {selectedDomain && (
            <button
              type="button"
              onClick={() => setSelectedDomain(null)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              Limpar filtro
            </button>
          )}
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar evento, domínio ou descrição..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-10 border-border/60 focus-visible:ring-platform focus-visible:border-platform transition-colors"
        />
      </div>

      {/* ── Domain Groups (expandable like Access Graph) ── */}
      <ScrollArea className="h-[calc(100vh-520px)]">
        <div className="space-y-2">
          {[...groupedByDomain.entries()].map(([domain, events]) => {
            const color = events[0]?.domainColor ?? 'hsl(0 0% 50%)';
            const meta = DOMAIN_META[domain] ?? DEFAULT_DOMAIN_META;
            const DomainIcon = meta.icon;
            const isExpanded = expandedDomain === domain;

            return (
              <div
                key={domain}
                className={cn(
                  'rounded-lg border transition-all duration-200 overflow-hidden',
                  isExpanded ? 'shadow-sm' : 'border-border/60',
                )}
                style={isExpanded ? { borderColor: `${color}40` } : {}}
              >
                {/* Clickable header */}
                <button
                  type="button"
                  onClick={() => setExpandedDomain(isExpanded ? null : domain)}
                  className={cn(
                    'flex items-center gap-3 w-full px-4 py-3 text-left transition-colors',
                    isExpanded ? 'bg-card' : 'bg-card hover:bg-muted/30',
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}

                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                    style={{ backgroundColor: `${color}12` }}
                  >
                    <DomainIcon className="h-4 w-4" style={{ color }} />
                  </div>

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
                </button>

                {/* Expanded event rows */}
                {isExpanded && (
                  <div className="border-t" style={{ borderColor: `${color}15` }}>
                    <div className="divide-y divide-border/30">
                      {events.map((ev, i) => (
                        <div
                          key={ev.eventName}
                          className="group/row flex items-center gap-4 px-4 py-2.5 hover:bg-muted/20 transition-colors duration-150"
                        >
                          <div className="w-5 text-center">
                            <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                          </div>
                          <div
                            className="flex items-center justify-center w-7 h-7 rounded-md shrink-0 transition-transform duration-200 group-hover/row:scale-110"
                            style={{ backgroundColor: `${color}08` }}
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
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
