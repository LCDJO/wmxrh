/**
 * RoleRecommendationPanel — Shows AI-detected role recommendations
 * based on behavioral analysis (BehaviorAnalyzer fingerprints).
 *
 * Usage:
 *   <RoleRecommendationPanel onSelectRole={(role) => console.log(role)} />
 */
import { useState } from 'react';
import { usePlatformCognitive } from '@/domains/platform/use-platform-cognitive';
import type { BehaviorProfile, RoleSuggestionMatch } from '@/domains/platform-cognitive/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, Loader2, Sparkles, UserCheck, ChevronRight, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Pre-fetched matches (skip internal analysis). */
  matches?: RoleSuggestionMatch[];
  /** Called when user picks a role recommendation. */
  onSelectRole?: (role: string) => void;
  className?: string;
}

function confidenceTier(c: number) {
  if (c >= 0.75) return { cls: 'bg-success/15 text-success border-success/30' };
  if (c >= 0.45) return { cls: 'bg-warning/15 text-warning border-warning/30' };
  return { cls: 'bg-muted text-muted-foreground border-border' };
}

export function RoleRecommendationPanel({ matches: externalMatches, onSelectRole, className }: Props) {
  const { getBehavior } = usePlatformCognitive();
  const [analyzing, setAnalyzing] = useState(false);
  const [localMatches, setLocalMatches] = useState<RoleSuggestionMatch[] | null>(null);

  const matches = externalMatches ?? localMatches;

  const handleAnalyze = () => {
    setAnalyzing(true);
    try {
      const profile: BehaviorProfile = getBehavior();
      // Build role suggestions from behavior profile locally
      // In production this would call the RoleSuggestionEngine via edge function
      const suggestions: RoleSuggestionMatch[] = [];

      const routes = profile.top_routes ?? [];
      const features = profile.most_used_features ?? [];

      // Heuristic matching based on navigation patterns
      const patterns: { role: string; label: string; description: string; signals: string[]; keywords: string[] }[] = [
        {
          role: 'rh_manager',
          label: 'Gestor de RH',
          description: 'Acesso completo a funcionários, remuneração e benefícios',
          signals: ['Navega frequentemente em módulos de RH'],
          keywords: ['/employees', '/compensation', '/benefits', '/departments'],
        },
        {
          role: 'compliance_officer',
          label: 'Compliance Officer',
          description: 'Foco em conformidade, saúde ocupacional e eSocial',
          signals: ['Acessa módulos de compliance e saúde'],
          keywords: ['/compliance', '/health', '/esocial', '/labor-compliance', '/nr-compliance'],
        },
        {
          role: 'financial_analyst',
          label: 'Analista Financeiro',
          description: 'Simulação de folha, custos e inteligência estratégica',
          signals: ['Usa simulação de folha e dashboards financeiros'],
          keywords: ['/payroll-simulation', '/strategic-intelligence', '/workforce-intelligence'],
        },
        {
          role: 'admin',
          label: 'Administrador',
          description: 'Gestão de usuários, permissões e auditoria',
          signals: ['Configura usuários e monitora auditoria'],
          keywords: ['/settings/users', '/settings/roles', '/audit', '/iam'],
        },
      ];

      const routeSet = new Set(routes.map(r => r.route));
      const featureSet = new Set(features);

      patterns.forEach(p => {
        const matchCount = p.keywords.filter(k => routeSet.has(k) || featureSet.has(k)).length;
        if (matchCount > 0) {
          const confidence = Math.min(0.95, matchCount / p.keywords.length + 0.15);
          suggestions.push({
            role: p.role,
            label: p.label,
            description: p.description,
            confidence,
            matched_signals: p.signals,
            event_count: routes.reduce((sum, r) => sum + r.visits, 0),
          });
        }
      });

      suggestions.sort((a, b) => b.confidence - a.confidence);
      setLocalMatches(suggestions.length > 0 ? suggestions : []);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card className={cn('border-border/60 overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-card-foreground flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" />
          Recomendação de Cargo
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Baseado em padrões de navegação e uso da plataforma
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Results */}
        {matches && matches.length > 0 && (
          <ScrollArea className="max-h-[280px]">
            <div className="space-y-2">
              {matches.map((m) => {
                const tier = confidenceTier(m.confidence);
                return (
                  <div
                    key={m.role}
                    className="rounded-lg border border-border/50 p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <UserCheck className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-card-foreground">{m.label}</p>
                          <Badge variant="outline" className={cn('text-[9px]', tier.cls)}>
                            {Math.round(m.confidence * 100)}%
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {m.description}
                        </p>
                        {m.matched_signals.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {m.matched_signals.map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-[9px] font-normal">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {onSelectRole && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1.5 text-primary mt-2"
                        onClick={() => onSelectRole(m.role)}
                      >
                        Aplicar cargo <ChevronRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {matches && matches.length === 0 && (
          <div className="text-center py-5">
            <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Dados insuficientes para recomendações.
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              Continue navegando para gerar padrões.
            </p>
          </div>
        )}

        {!matches && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            disabled={analyzing}
            onClick={handleAnalyze}
          >
            {analyzing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Brain className="h-3.5 w-3.5" />
            )}
            {analyzing ? 'Analisando comportamento...' : 'Analisar e recomendar cargo'}
          </Button>
        )}

        {/* Cognitive badge */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          <Sparkles className="h-2.5 w-2.5 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground">
            Powered by Cognitive Layer
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
