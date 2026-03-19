/**
 * NavigationSuggestionsPanel — AI-powered navigation suggestions
 * Shows contextual suggestions like "Fixar Funcionários na sidebar?"
 * and "Criar atalho para Ajustes Salariais?" based on usage patterns.
 */
import { useState, useEffect, useMemo } from 'react';
import { usePlatformCognitive } from '@/domains/platform/use-platform-cognitive';
import { useNavigationPins, type PinnedItem } from '@/hooks/platform/use-navigation-pins';
import type { CognitiveSuggestion } from '@/domains/platform-cognitive/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles, Loader2, Pin, PinOff, Zap, ArrowRight,
  ChevronUp, ChevronDown, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Route label map (for suggestion display) ────────────────────────
const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/employees': 'Funcionários',
  '/companies': 'Empresas',
  '/groups': 'Grupos Econômicos',
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

// ── Local suggestions from behavior (no AI call needed) ─────────────
function buildLocalSuggestions(
  behavior: { top_routes: { route: string; visits: number }[] } | null,
  pins: PinnedItem[],
): LocalSuggestion[] {
  if (!behavior?.top_routes) return [];

  const pinnedSet = new Set(pins.map(p => p.to));
  const suggestions: LocalSuggestion[] = [];

  // Suggest pinning frequently visited unpinned routes
  behavior.top_routes
    .filter(r => !pinnedSet.has(r.route) && r.visits >= 3 && ROUTE_LABELS[r.route])
    .slice(0, 3)
    .forEach(r => {
      suggestions.push({
        id: `pin-${r.route}`,
        type: 'pin',
        route: r.route,
        label: ROUTE_LABELS[r.route],
        message: `Fixar "${ROUTE_LABELS[r.route]}" na sidebar?`,
        visits: r.visits,
      });
    });

  return suggestions;
}

interface LocalSuggestion {
  id: string;
  type: 'pin' | 'shortcut';
  route: string;
  label: string;
  message: string;
  visits: number;
}

interface Props {
  collapsed?: boolean;
}

export function NavigationSuggestionsPanel({ collapsed }: Props) {
  const { getBehavior, ask, loading, response } = usePlatformCognitive();
  const { pins, addPin, removePin, isPinned } = useNavigationPins();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [aiFetched, setAiFetched] = useState(false);

  const behavior = useMemo(() => getBehavior(), [getBehavior]);
  const localSuggestions = useMemo(
    () => buildLocalSuggestions(behavior, pins).filter(s => !dismissed.has(s.id)),
    [behavior, pins, dismissed],
  );

  // AI suggestions (shortcuts from the NavigationAdvisor)
  const aiSuggestions: CognitiveSuggestion[] = useMemo(
    () => (response?.suggestions ?? []).filter(s => s.type === 'shortcut' || s.type === 'dashboard'),
    [response],
  );

  const totalCount = localSuggestions.length + aiSuggestions.length;

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  const handlePin = (suggestion: LocalSuggestion) => {
    addPin({ to: suggestion.route, label: suggestion.label });
    handleDismiss(suggestion.id);
  };

  if (collapsed) {
    if (totalCount === 0) return null;
    return (
      <div className="px-3 pb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors mx-auto relative"
        >
          <Sparkles className="h-4 w-4 text-sidebar-primary" />
          {totalCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
              {totalCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  if (totalCount === 0 && !aiFetched) return null;

  return (
    <div className="px-3 pb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors",
          expanded
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        )}
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-sidebar-primary" />
        <span className="flex-1 text-left font-medium">Sugestões de Navegação</span>
        {totalCount > 0 && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-primary/15 text-primary border-0">
            {totalCount}
          </Badge>
        )}
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 animate-fade-in">
          {/* Local (behavior-based) suggestions */}
          {localSuggestions.map(s => (
            <div
              key={s.id}
              className="flex items-start gap-2 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/30 p-2.5 group"
            >
              <Pin className="h-3.5 w-3.5 text-sidebar-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-sidebar-foreground leading-tight">
                  {s.message}
                </p>
                <p className="text-[10px] text-sidebar-foreground/50 mt-0.5">
                  Visitado {s.visits}x recentemente
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => handlePin(s)}
                  className="h-6 w-6 rounded flex items-center justify-center bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                  title="Fixar"
                >
                  <Pin className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleDismiss(s.id)}
                  className="h-6 w-6 rounded flex items-center justify-center hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
                  title="Dispensar"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}

          {/* AI suggestions */}
          {aiSuggestions.map(s => (
            <div
              key={s.id}
              className="flex items-start gap-2 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/30 p-2.5"
            >
              <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-sidebar-foreground leading-tight">{s.title}</p>
                <p className="text-[10px] text-sidebar-foreground/50 mt-0.5 line-clamp-2">{s.description}</p>
              </div>
              {s.action_label && s.metadata?.route !== undefined && (
                <button
                  onClick={() => addPin({ to: s.metadata!.route as string, label: s.title })}
                  className="h-6 w-6 rounded flex items-center justify-center bg-primary/10 hover:bg-primary/20 text-primary transition-colors shrink-0"
                  title="Fixar atalho"
                >
                  <Pin className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}

          {/* Fetch AI suggestions button */}
          {!aiFetched && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-2 text-[11px] text-sidebar-foreground/60 hover:text-sidebar-foreground h-7"
              disabled={loading}
              onClick={() => {
                setAiFetched(true);
                ask('suggest-shortcuts', { role: 'user', email: '' });
              }}
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Obter sugestões inteligentes
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
