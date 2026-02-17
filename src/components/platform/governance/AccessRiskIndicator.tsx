/**
 * AccessRiskIndicator — Per-user risk breakdown with dimension bars.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { UserCheck, ShieldAlert, Globe, Users } from 'lucide-react';
import type { AccessRiskProfile, AccessRiskDimension } from '@/domains/governance-ai/access-risk-analyzer';
import { cn } from '@/lib/utils';

interface AccessRiskIndicatorProps {
  profiles: AccessRiskProfile[];
}

const levelConfig = {
  critical: { label: 'Crítico', variant: 'destructive' as const, color: 'text-destructive' },
  high: { label: 'Alto', variant: 'secondary' as const, color: 'text-[hsl(25_95%_53%)]' },
  medium: { label: 'Médio', variant: 'outline' as const, color: 'text-[hsl(38_92%_50%)]' },
  low: { label: 'Baixo', variant: 'outline' as const, color: 'text-emerald-600' },
};

const dimConfig: Record<AccessRiskDimension['dimension'], { icon: typeof ShieldAlert; label: string; color: string }> = {
  critical_permissions: { icon: ShieldAlert, label: 'Permissões Críticas', color: 'text-destructive' },
  cross_domain_access: { icon: Globe, label: 'Acesso Cross-Domain', color: 'text-[hsl(38_92%_50%)]' },
  impersonation_abuse: { icon: Users, label: 'Impersonation', color: 'text-primary' },
};

export function AccessRiskIndicator({ profiles }: AccessRiskIndicatorProps) {
  const sorted = [...profiles].sort((a, b) => b.composite_score - a.composite_score);
  const displayed = sorted.slice(0, 20);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          Access Risk por Usuário
        </CardTitle>
        <CardDescription>
          Score composto (0–100) com breakdown por dimensão de risco
        </CardDescription>
      </CardHeader>
      <CardContent>
        {displayed.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum perfil de risco calculado. Execute um scan.</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {displayed.map(profile => {
                const config = levelConfig[profile.level];
                return (
                  <div key={profile.userId} className="border border-border rounded-lg p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">{profile.userLabel}</span>
                        <Badge variant={config.variant} className="text-[10px] shrink-0">
                          {config.label}
                        </Badge>
                      </div>
                      <span className={cn('text-lg font-bold tabular-nums', config.color)}>
                        {profile.composite_score}
                      </span>
                    </div>

                    {/* Dimension bars */}
                    <div className="space-y-2">
                      {profile.dimensions.map(dim => {
                        const dc = dimConfig[dim.dimension];
                        const Icon = dc.icon;
                        const maxWeight = dim.dimension === 'critical_permissions' ? 40 : 30;
                        const pct = Math.round((dim.weighted_score / maxWeight) * 100);

                        return (
                          <div key={dim.dimension} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <Icon className={cn('h-3 w-3', dc.color)} />
                                {dc.label}
                              </span>
                              <span className="text-foreground font-mono text-[11px]">
                                {dim.weighted_score}/{maxWeight}
                              </span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                            <p className="text-[10px] text-muted-foreground">{dim.detail}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
