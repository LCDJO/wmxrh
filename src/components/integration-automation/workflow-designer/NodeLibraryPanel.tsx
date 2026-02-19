/**
 * NodeLibraryPanel — Browsable library of all available triggers, actions,
 * conditions, and connectors with domain grouping, search, and expand/collapse all.
 */
import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Search, Zap, Play, GitBranch, Plug, Plus, ChevronsUpDown,
  ChevronDown, ChevronRight, Maximize2, Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EVENT_TRIGGER_REGISTRY, getRegistryDomains, getTriggersByDomain } from './event-trigger-registry';
import { CONNECTOR_DEFINITIONS } from './connector-registry';
import { ALL_NODE_TEMPLATES } from './node-catalog';
import type { WfNodeTemplate } from './types';

interface Props {
  onAddNode?: (template: WfNodeTemplate) => void;
}

export function NodeLibraryPanel({ onAddNode }: Props) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('triggers');

  // ── Collapse state per domain/category ──
  const domains = useMemo(() => getRegistryDomains(), []);
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(new Set());

  const toggleDomain = useCallback((domain: string) => {
    setCollapsedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedDomains(new Set());
  }, []);

  const collapseAll = useCallback(() => {
    // Collapse all visible domain keys based on current tab
    if (tab === 'triggers') {
      setCollapsedDomains(new Set(domains));
    } else {
      // For actions/conditions/connectors, use category keys
      setCollapsedDomains(new Set(['actions', 'conditions', 'connectors']));
    }
  }, [tab, domains]);

  const allExpanded = collapsedDomains.size === 0;

  const filteredTriggers = useMemo(() => {
    const q = search.toLowerCase();
    return EVENT_TRIGGER_REGISTRY.filter(t =>
      t.label.toLowerCase().includes(q) ||
      t.domain.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    );
  }, [search]);

  const filteredActions = useMemo(() => {
    const q = search.toLowerCase();
    return ALL_NODE_TEMPLATES.filter(n => n.category === 'action').filter(n =>
      n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)
    );
  }, [search]);

  const filteredConditions = useMemo(() => {
    const q = search.toLowerCase();
    return ALL_NODE_TEMPLATES.filter(n => n.category === 'condition').filter(n =>
      n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)
    );
  }, [search]);

  const filteredConnectors = useMemo(() => {
    const q = search.toLowerCase();
    return CONNECTOR_DEFINITIONS.filter(c =>
      c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display">Biblioteca de Nós</CardTitle>
          {/* Expand / Collapse All */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title="Expandir todos"
              onClick={expandAll}
            >
              <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title="Recolher todos"
              onClick={collapseAll}
            >
              <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar triggers, actions, connectors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <Tabs value={tab} onValueChange={v => { setTab(v); setCollapsedDomains(new Set()); }} className="h-full flex flex-col">
          <TabsList className="mx-4 mb-2 grid grid-cols-4 h-8">
            <TabsTrigger value="triggers" className="text-[10px] gap-1">
              <Zap className="h-3 w-3" /> Triggers
            </TabsTrigger>
            <TabsTrigger value="actions" className="text-[10px] gap-1">
              <Play className="h-3 w-3" /> Actions
            </TabsTrigger>
            <TabsTrigger value="conditions" className="text-[10px] gap-1">
              <GitBranch className="h-3 w-3" /> Conditions
            </TabsTrigger>
            <TabsTrigger value="connectors" className="text-[10px] gap-1">
              <Plug className="h-3 w-3" /> Connectors
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-4 pb-4">
            {/* TRIGGERS */}
            <TabsContent value="triggers" className="mt-0 space-y-3">
              {domains.map(domain => {
                const triggers = getTriggersByDomain(domain).filter(t =>
                  filteredTriggers.some(ft => ft.eventType === t.eventType)
                );
                if (triggers.length === 0) return null;
                const isCollapsed = collapsedDomains.has(domain);
                return (
                  <Collapsible key={domain} open={!isCollapsed} onOpenChange={() => toggleDomain(domain)}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center gap-2 mb-1.5 px-1 py-1 rounded-md hover:bg-muted/50 transition-colors group">
                        {isCollapsed
                          ? <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        }
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: triggers[0].domainColor }} />
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{domain}</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1 ml-auto">{triggers.length}</Badge>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="animate-accordion-down">
                      <div className="space-y-1">
                        {triggers.map(t => (
                          <button
                            key={t.eventType}
                            onClick={() => onAddNode?.({
                              key: t.eventType,
                              category: 'trigger',
                              label: t.label,
                              description: t.description,
                              icon: 'Zap',
                              configFields: Object.entries(t.payloadSchema).map(([k]) => ({
                                key: k, label: k, type: 'text' as const,
                              })),
                            })}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-left group"
                          >
                            <div className="h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                              style={{ backgroundColor: `${t.domainColor}20`, color: t.domainColor }}>
                              T
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{t.label}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{t.description}</p>
                            </div>
                            <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </button>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </TabsContent>

            {/* ACTIONS */}
            <TabsContent value="actions" className="mt-0 space-y-1">
              {filteredActions.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">Nenhuma action encontrada</div>
              ) : (
                filteredActions.map(action => (
                  <button
                    key={action.key}
                    onClick={() => onAddNode?.(action)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div className="h-6 w-6 rounded flex items-center justify-center bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                      A
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{action.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{action.description}</p>
                    </div>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))
              )}
            </TabsContent>

            {/* CONDITIONS */}
            <TabsContent value="conditions" className="mt-0 space-y-1">
              {filteredConditions.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">Nenhuma condition encontrada</div>
              ) : (
                filteredConditions.map(cond => (
                  <button
                    key={cond.key}
                    onClick={() => onAddNode?.(cond)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div className="h-6 w-6 rounded flex items-center justify-center bg-accent text-accent-foreground text-[10px] font-bold shrink-0">
                      C
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{cond.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{cond.description}</p>
                    </div>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))
              )}
            </TabsContent>

            {/* CONNECTORS */}
            <TabsContent value="connectors" className="mt-0 space-y-1">
              {filteredConnectors.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">Nenhum connector encontrado</div>
              ) : (
                filteredConnectors.map(conn => (
                  <div
                    key={conn.type}
                    className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <div className="h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: `${conn.color}20`, color: conn.color }}>
                      {conn.label.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{conn.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{conn.description}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {conn.authMethods.slice(0, 2).map(m => (
                        <Badge key={m} variant="outline" className="text-[8px] h-4 px-1">{m}</Badge>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}
