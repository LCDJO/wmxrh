/**
 * RoleOptimizationHints — Displays actionable role optimization suggestions.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitMerge, Scissors, Trash2, ArrowRight } from 'lucide-react';
import type { GovernanceInsight } from '@/domains/governance-ai/types';
import type { RoleOptimizationHint } from '@/domains/governance-ai/role-optimization-advisor';
import { cn } from '@/lib/utils';

interface RoleOptimizationHintsProps {
  hints: RoleOptimizationHint[];
  insights: GovernanceInsight[];
}

const hintConfig = {
  merge: { icon: GitMerge, label: 'Consolidar', color: 'text-primary', bg: 'bg-primary/10' },
  split: { icon: Scissors, label: 'Dividir', color: 'text-[hsl(38_92%_50%)]', bg: 'bg-[hsl(38_92%_50%)]/10' },
  remove_redundant: { icon: Trash2, label: 'Remover', color: 'text-destructive', bg: 'bg-destructive/10' },
};

export function RoleOptimizationHints({ hints, insights }: RoleOptimizationHintsProps) {
  // Also extract redundant-perm insights
  const redundantInsights = insights.filter(i => (i.metadata as any)?.hint_type === 'remove_redundant');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GitMerge className="h-4 w-4 text-primary" />
          Otimização de Cargos
        </CardTitle>
        <CardDescription>
          Sugestões para simplificar a estrutura de cargos e permissões
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hints.length === 0 && redundantInsights.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <GitMerge className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma otimização detectada. Execute um scan.</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {/* Structured hints */}
              {hints.map((hint, idx) => {
                const config = hintConfig[hint.type];
                const Icon = config.icon;
                return (
                  <div key={`hint-${idx}`} className="border border-border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn('p-1.5 rounded-md shrink-0', config.bg)}>
                        <Icon className={cn('h-4 w-4', config.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px]">{config.label}</Badge>
                          <Badge variant={hint.severity === 'warning' ? 'secondary' : 'outline'} className="text-[10px]">
                            {hint.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground">{hint.description}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {hint.roles.map((role, i) => (
                            <span key={role.id} className="inline-flex items-center gap-1 text-xs">
                              <Badge variant="secondary" className="text-[10px] font-mono">
                                {role.label}
                                <span className="ml-1 opacity-60">({role.permissionCount}p)</span>
                              </Badge>
                              {i < hint.roles.length - 1 && hint.type === 'merge' && (
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              )}
                            </span>
                          ))}
                        </div>
                        {hint.estimated_reduction > 0 && (
                          <p className="text-xs text-primary mt-2">
                            ↓ ~{hint.estimated_reduction} permissão(ões) eliminada(s)
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Redundant permission insights */}
              {redundantInsights.map(insight => (
                <div key={insight.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('p-1.5 rounded-md shrink-0', hintConfig.remove_redundant.bg)}>
                      <Trash2 className={cn('h-4 w-4', hintConfig.remove_redundant.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">Remover</Badge>
                        <Badge variant={insight.severity === 'warning' ? 'secondary' : 'outline'} className="text-[10px]">
                          {insight.severity}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {Math.round(insight.confidence * 100)}% confiança
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{insight.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
                      {insight.recommendation && (
                        <p className="text-xs text-primary mt-1.5">{insight.recommendation}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
