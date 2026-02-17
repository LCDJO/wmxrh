/**
 * CognitiveInsightsCard — Dashboard widget showing AI-detected insights:
 * - Cargos mais utilizados
 * - Módulos mais acessados
 * - Áreas sem uso
 *
 * Uses CognitiveContextCollector event stats + local data analysis.
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformCognitive } from '@/domains/platform/use-platform-cognitive';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Brain, BarChart3, Layers, TrendingDown, TrendingUp,
  Loader2, Sparkles, Users, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Module labels ─────────────────────────────────────────────────
const MODULE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/employees': 'Funcionários',
  '/companies': 'Empresas',
  '/groups': 'Grupos',
  '/departments': 'Departamentos',
  '/positions': 'Cargos',
  '/compensation': 'Remuneração',
  '/benefits': 'Benefícios',
  '/health': 'Saúde Ocupacional',
  '/compliance': 'Rubricas',
  '/payroll-simulation': 'Simulação Folha',
  '/labor-dashboard': 'Painel Trabalhista',
  '/labor-compliance': 'Conformidade',
  '/labor-rules': 'Regras Trabalhistas',
  '/legal-dashboard': 'Dashboard Legal',
  '/audit': 'Auditoria',
  '/esocial': 'eSocial',
  '/agreements': 'Termos e Acordos',
  '/workforce-intelligence': 'Inteligência RH',
  '/strategic-intelligence': 'IA Estratégica',
  '/settings/users': 'Usuários',
  '/settings/roles': 'Cargos & Permissões',
  '/occupational-compliance': 'Compliance Ocupacional',
  '/nr-compliance': 'NR Compliance',
};

const ALL_MODULES = Object.keys(MODULE_LABELS).filter(k => k !== '/');

// ── Types ─────────────────────────────────────────────────────────
interface InsightItem {
  id: string;
  type: 'top_role' | 'top_module' | 'unused_module';
  label: string;
  detail: string;
  value?: number;
  severity: 'info' | 'warn' | 'success';
}

interface Props {
  /** Position distribution from employee data */
  positionCounts: { name: string; count: number }[];
  /** Total employees */
  totalEmployees: number;
}

export function CognitiveInsightsCard({ positionCounts, totalEmployees }: Props) {
  const { ask, loading: aiLoading, response: aiResponse } = usePlatformCognitive();
  const [showAi, setShowAi] = useState(false);

  // Fetch cognitive event stats (pages visited, modules used)
  const { data: eventStats } = useQuery({
    queryKey: ['cognitive_event_stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cognitive_event_stats', { days_back: 30 });
      if (error) throw error;
      // RPC returns a JSONB object with top_pages, top_modules, etc.
      const obj = data as Record<string, any> | null;
      if (!obj) return null;
      // Normalize to flat array for downstream consumption
      const items: { event_type: string; action: string; event_count: number }[] = [];
      if (Array.isArray(obj.top_pages)) {
        obj.top_pages.forEach((p: any) => items.push({ event_type: 'page_view', action: p.page, event_count: p.visits }));
      }
      if (Array.isArray(obj.top_modules)) {
        obj.top_modules.forEach((m: any) => items.push({ event_type: 'module_use', action: m.module, event_count: m.uses }));
      }
      if (Array.isArray(obj.top_commands)) {
        obj.top_commands.forEach((c: any) => items.push({ event_type: 'command_exec', action: c.command, event_count: c.executions }));
      }
      return items;
    },
    staleTime: 5 * 60 * 1000,
  });

  const insights = useMemo(() => {
    const result: InsightItem[] = [];

    // 1. Top positions (cargos mais utilizados)
    const topPositions = [...positionCounts]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    topPositions.forEach((p, i) => {
      const pct = totalEmployees > 0 ? Math.round((p.count / totalEmployees) * 100) : 0;
      result.push({
        id: `top-pos-${i}`,
        type: 'top_role',
        label: p.name,
        detail: `${p.count} funcionários (${pct}%)`,
        value: p.count,
        severity: 'info',
      });
    });

    // 2. Top modules (módulos mais acessados) from event stats
    if (eventStats) {
      const pageViews = eventStats
        .filter(e => e.event_type === 'page_view')
        .sort((a, b) => b.event_count - a.event_count)
        .slice(0, 3);

      pageViews.forEach((pv, i) => {
        const label = MODULE_LABELS[pv.action] || pv.action;
        result.push({
          id: `top-mod-${i}`,
          type: 'top_module',
          label,
          detail: `${pv.event_count} acessos nos últimos 30 dias`,
          value: pv.event_count,
          severity: 'success',
        });
      });

      // 3. Unused modules (áreas sem uso)
      const visitedRoutes = new Set(
        eventStats.filter(e => e.event_type === 'page_view').map(e => e.action)
      );
      const unusedModules = ALL_MODULES.filter(m => !visitedRoutes.has(m));

      if (unusedModules.length > 0) {
        const listed = unusedModules
          .slice(0, 4)
          .map(m => MODULE_LABELS[m] || m)
          .join(', ');
        const extra = unusedModules.length > 4 ? ` +${unusedModules.length - 4}` : '';

        result.push({
          id: 'unused-modules',
          type: 'unused_module',
          label: `${unusedModules.length} módulos sem uso`,
          detail: `${listed}${extra}`,
          severity: 'warn',
        });
      }
    }

    return result;
  }, [positionCounts, totalEmployees, eventStats]);

  const topRoles = insights.filter(i => i.type === 'top_role');
  const topModules = insights.filter(i => i.type === 'top_module');
  const unusedModules = insights.filter(i => i.type === 'unused_module');

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-card-foreground flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Insights Cognitivos
        </CardTitle>
        <p className="text-xs text-muted-foreground">Análise automática de utilização e padrões</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Top Positions */}
        {topRoles.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cargos mais utilizados
              </p>
            </div>
            <div className="space-y-2">
              {topRoles.map(item => {
                const pct = totalEmployees > 0 ? Math.round(((item.value ?? 0) / totalEmployees) * 100) : 0;
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-card-foreground truncate">{item.label}</p>
                        <span className="text-xs text-muted-foreground font-mono shrink-0">{item.detail}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Modules */}
        {topModules.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Módulos mais acessados
              </p>
            </div>
            <div className="space-y-1.5">
              {topModules.map((item, i) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border/50 px-3 py-2"
                >
                  <div className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                    i === 0 ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground"
                  )}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-card-foreground">{item.label}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    <span className="font-mono">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unused Modules */}
        {unusedModules.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Áreas sem uso
              </p>
            </div>
            {unusedModules.map(item => (
              <div
                key={item.id}
                className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2.5"
              >
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {insights.length === 0 && (
          <div className="text-center py-6">
            <Layers className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Dados insuficientes para gerar insights.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Continue usando a plataforma para receber análises.</p>
          </div>
        )}

        {/* AI deep analysis button */}
        {insights.length > 0 && (
          <>
            {showAi && aiResponse?.suggestions && (
              <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 space-y-2">
                <p className="text-[11px] font-semibold text-primary flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Análise AI
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{aiResponse.summary}</p>
                <ScrollArea className="max-h-[150px]">
                  <div className="space-y-1.5">
                    {aiResponse.suggestions.slice(0, 5).map(s => (
                      <div key={s.id} className="flex items-start gap-2 text-xs">
                        <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">
                          {Math.round(s.confidence * 100)}%
                        </Badge>
                        <span className="text-card-foreground">{s.description}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
              disabled={aiLoading}
              onClick={() => {
                setShowAi(true);
                ask('detect-patterns', { role: 'admin', email: '' });
              }}
            >
              {aiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Brain className="h-3.5 w-3.5" />
              )}
              {aiLoading ? 'Analisando...' : 'Análise profunda com IA'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
