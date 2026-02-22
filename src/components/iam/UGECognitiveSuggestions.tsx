/**
 * UGECognitiveSuggestions — AI-powered suggestions panel for the UGE.
 *
 * READ-ONLY: The CognitiveLayer analyses UGE data and returns suggestions.
 * All suggestions are NON-DESTRUCTIVE and require explicit user confirmation.
 * No permissions, roles, or access rules are modified by this component.
 *
 * Features:
 *   - "Simplificar Cargos" → role consolidation suggestions
 *   - "Permissões Redundantes" → redundant permission detection
 *   - Confidence indicators
 *   - Expandable detail cards
 */
import { useState } from 'react';
import { Brain, Sparkles, Merge, Trash2, Loader2, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUGECognitive } from '@/domains/platform-cognitive/use-uge-cognitive';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import type { CognitiveSuggestion } from '@/domains/platform-cognitive/types';

// ════════════════════════════════════
// PROPS
// ════════════════════════════════════

export interface UGECognitiveSuggestionsProps {
  className?: string;
  maxHeight?: number;
}

// ════════════════════════════════════
// COMPONENT
// ════════════════════════════════════

export function UGECognitiveSuggestions({ className, maxHeight = 520 }: UGECognitiveSuggestionsProps) {
  const { suggestRoleSimplification, suggestRedundantPermissions, loading, response, graphData } = useUGECognitive();
  const { identity } = usePlatformIdentity();
  const [activeTab, setActiveTab] = useState<'roles' | 'permissions'>('roles');

  const caller = {
    role: identity?.role ?? 'viewer',
    email: identity?.email ?? '',
  };

  const handleAnalyze = () => {
    if (activeTab === 'roles') {
      suggestRoleSimplification(caller);
    } else {
      suggestRedundantPermissions(caller);
    }
  };

  const roleSuggestions = response?.suggestions.filter(s => s.type === 'role-simplification') ?? [];
  const permSuggestions = response?.suggestions.filter(s => s.type === 'redundant-permission') ?? [];
  const activeSuggestions = activeTab === 'roles' ? roleSuggestions : permSuggestions;
  const allSuggestions = [...roleSuggestions, ...permSuggestions];
  const displaySuggestions = allSuggestions.length > 0 ? (activeTab === 'roles' ? roleSuggestions : permSuggestions) : [];

  return (
    <Card className={`border-border/50 ${className ?? ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Brain className="h-4 w-4 text-primary" />
            Cognitive Layer — UGE
          </CardTitle>
          <Badge variant="outline" className="text-[9px] bg-primary/5 text-primary border-primary/20">
            READ-ONLY
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Sugestões de IA baseadas na análise do grafo unificado.
          {graphData.analysisStats.totalNodes > 0 && (
            <span className="ml-1 text-muted-foreground">
              ({graphData.analysisStats.totalRoles} cargos · {graphData.analysisStats.totalPermissions} perms · {graphData.analysisStats.totalUsers} users)
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Tab selector */}
        <div className="flex gap-1">
          <Button
            variant={activeTab === 'roles' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setActiveTab('roles')}
          >
            <Merge className="h-3 w-3" />
            Simplificar Cargos
          </Button>
          <Button
            variant={activeTab === 'permissions' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setActiveTab('permissions')}
          >
            <Trash2 className="h-3 w-3" />
            Permissões Redundantes
          </Button>
        </div>

        {/* Context chips */}
        {graphData.roleOverlaps.length > 0 && activeTab === 'roles' && (
          <div className="flex flex-wrap gap-1">
            {graphData.roleOverlaps.slice(0, 3).map((o, i) => (
              <Badge key={i} variant="outline" className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                {o.roleA} ↔ {o.roleB}: {Math.round(o.overlapRatio * 100)}%
              </Badge>
            ))}
            {graphData.roleOverlaps.length > 3 && (
              <Badge variant="outline" className="text-[9px]">+{graphData.roleOverlaps.length - 3}</Badge>
            )}
          </div>
        )}

        {/* Analyze button */}
        <Button
          onClick={handleAnalyze}
          disabled={loading}
          size="sm"
          className="w-full gap-1.5 h-8"
          variant="outline"
        >
          {loading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Analisando grafo...
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" />
              Analisar {activeTab === 'roles' ? 'Cargos' : 'Permissões'}
            </>
          )}
        </Button>

        {/* Results */}
        {response && (
          <ScrollArea style={{ maxHeight }}>
            <div className="space-y-2">
              {/* Summary */}
              {response.summary && (
                <p className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-2 py-1">
                  {response.summary}
                </p>
              )}

              {/* Suggestion cards */}
              {displaySuggestions.length > 0 ? (
                displaySuggestions.map(suggestion => (
                  <SuggestionCard key={suggestion.id} suggestion={suggestion} />
                ))
              ) : (
                // Show all suggestions if none match active tab
                allSuggestions.length > 0 ? (
                  allSuggestions.map(suggestion => (
                    <SuggestionCard key={suggestion.id} suggestion={suggestion} />
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Nenhuma sugestão gerada. O grafo pode estar limpo.
                  </p>
                )
              )}
            </div>
          </ScrollArea>
        )}

        {/* Empty state */}
        {!response && !loading && (
          <div className="text-center py-4 text-xs text-muted-foreground space-y-1">
            <Brain className="h-8 w-8 mx-auto opacity-20" />
            <p>Clique em "Analisar" para obter sugestões baseadas no UGE.</p>
            <p className="text-[10px]">As sugestões são não-destrutivas e requerem confirmação.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════
// SUGGESTION CARD
// ════════════════════════════════════

function SuggestionCard({ suggestion }: { suggestion: CognitiveSuggestion }) {
  const [open, setOpen] = useState(false);

  const isRoleSimp = suggestion.type === 'role-simplification';
  const Icon = isRoleSimp ? Merge : Trash2;
  const iconColor = isRoleSimp ? 'text-blue-400' : 'text-amber-400';

  const confidence = suggestion.confidence ?? 0;
  const confidenceLabel = confidence >= 0.8 ? 'Alta' : confidence >= 0.5 ? 'Média' : 'Baixa';
  const confidenceClass = confidence >= 0.8
    ? 'bg-green-500/10 text-green-400 border-green-500/30'
    : confidence >= 0.5
      ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
      : 'bg-muted/30 text-muted-foreground border-border/50';

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border/50 bg-card/50">
        <CollapsibleTrigger className="flex items-start gap-2 w-full p-2.5 text-left hover:bg-muted/20 transition-colors rounded-lg">
          {open ? <ChevronDown className="h-3 w-3 mt-0.5 shrink-0" /> : <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />}
          <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${iconColor}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-foreground">{suggestion.title}</span>
              <Badge variant="outline" className={`text-[8px] px-1 py-0 ${confidenceClass}`}>
                {confidenceLabel} ({Math.round(confidence * 100)}%)
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{suggestion.description}</p>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-2.5 pb-2.5 pt-0 space-y-2">
            <p className="text-[11px] text-muted-foreground">{suggestion.description}</p>

            {/* Metadata */}
            {suggestion.metadata && (
              <div className="space-y-1">
                {isRoleSimp && Array.isArray(suggestion.metadata.merge_candidates) && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] text-muted-foreground">Merge:</span>
                    {(suggestion.metadata.merge_candidates as string[]).map((c: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[9px] px-1 py-0 bg-blue-500/10 text-blue-400 border-blue-500/30">
                        {String(c)}
                      </Badge>
                    ))}
                  </div>
                )}
                {!isRoleSimp && typeof suggestion.metadata.permission_code === 'string' && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">Permissão:</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                      {String(suggestion.metadata.permission_code)}
                    </Badge>
                    {typeof suggestion.metadata.reason === 'string' && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-400 border-amber-500/30">
                        {String(suggestion.metadata.reason)}
                      </Badge>
                    )}
                  </div>
                )}
                {Array.isArray(suggestion.metadata.granted_by_roles) && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] text-muted-foreground">Via:</span>
                    {(suggestion.metadata.granted_by_roles as string[]).map((r, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] px-1 py-0">
                        {r}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {suggestion.action_label && (
              <p className="text-[10px] text-primary font-medium">
                💡 {suggestion.action_label}
              </p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
