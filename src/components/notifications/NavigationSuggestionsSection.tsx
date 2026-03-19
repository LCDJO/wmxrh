/**
 * NavigationSuggestionsSection — Inline section for the NotificationFlyout.
 * Shows AI-powered navigation suggestions (pin shortcuts) inside the bell popover.
 */
import { useState, useMemo } from 'react';
import { usePlatformCognitive } from '@/domains/platform/use-platform-cognitive';
import { useNavigationPins, type PinnedItem } from '@/hooks/platform/use-navigation-pins';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Pin, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface LocalSuggestion {
  id: string;
  route: string;
  label: string;
  message: string;
  visits: number;
}

function buildLocalSuggestions(
  behavior: { top_routes: { route: string; visits: number }[] } | null,
  pins: PinnedItem[],
): LocalSuggestion[] {
  if (!behavior?.top_routes) return [];
  const pinnedSet = new Set(pins.map(p => p.to));
  return behavior.top_routes
    .filter(r => !pinnedSet.has(r.route) && r.visits >= 3 && ROUTE_LABELS[r.route])
    .slice(0, 3)
    .map(r => ({
      id: `pin-${r.route}`,
      route: r.route,
      label: ROUTE_LABELS[r.route],
      message: `Fixar "${ROUTE_LABELS[r.route]}" na sidebar?`,
      visits: r.visits,
    }));
}

export function NavigationSuggestionsSection() {
  const { getBehavior } = usePlatformCognitive();
  const { pins, addPin } = useNavigationPins();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const behavior = useMemo(() => getBehavior(), [getBehavior]);
  const suggestions = useMemo(
    () => buildLocalSuggestions(behavior, pins).filter(s => !dismissed.has(s.id)),
    [behavior, pins, dismissed],
  );

  if (suggestions.length === 0) return null;

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-1.5 px-4 py-2 bg-muted/30">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Sugestões
        </span>
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 ml-auto">
          {suggestions.length}
        </Badge>
      </div>
      <div className="divide-y divide-border/50">
        {suggestions.map(s => (
          <div
            key={s.id}
            className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 transition-colors group"
          >
            <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground leading-tight truncate">
                {s.message}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Visitado {s.visits}x recentemente
              </p>
            </div>
            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  addPin({ to: s.route, label: s.label });
                  setDismissed(prev => new Set(prev).add(s.id));
                }}
                className="h-6 w-6 rounded flex items-center justify-center bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                title="Fixar"
              >
                <Pin className="h-3 w-3" />
              </button>
              <button
                onClick={() => setDismissed(prev => new Set(prev).add(s.id))}
                className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Dispensar"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
