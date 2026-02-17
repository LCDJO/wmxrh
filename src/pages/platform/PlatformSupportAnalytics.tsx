import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, Loader2, Trophy, Users, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { EvaluationService } from '@/domains/support/evaluation-service';
import type { SupportEvaluation, SystemRating } from '@/domains/support/types';

interface AgentStats {
  agentId: string;
  name: string;
  avgScore: number;
  totalEvals: number;
  positiveCount: number;
}

export default function PlatformSupportAnalytics() {
  const [evaluations, setEvaluations] = useState<SupportEvaluation[]>([]);
  const [systemRatings, setSystemRatings] = useState<SystemRating[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [evals, sysRatings] = await Promise.all([
          EvaluationService.listAll(),
          EvaluationService.listSystemRatings(),
        ]);

        setEvaluations(evals);
        setSystemRatings(sysRatings);

        // Group by agent_id
        const agentMap = new Map<string, { scores: number[]; id: string }>();
        evals.forEach(ev => {
          if (!ev.agent_id || ev.agent_score == null) return;
          const entry = agentMap.get(ev.agent_id) ?? { scores: [], id: ev.agent_id };
          entry.scores.push(ev.agent_score);
          agentMap.set(ev.agent_id, entry);
        });

        // Fetch agent names
        const agentIds = [...agentMap.keys()];
        let nameMap = new Map<string, string>();
        if (agentIds.length > 0) {
          const { data: agents } = await supabase
            .from('platform_users')
            .select('id, display_name, email')
            .in('id', agentIds);
          nameMap = new Map((agents ?? []).map(a => [a.id, a.display_name || a.email]));
        }

        const stats: AgentStats[] = [...agentMap.entries()]
          .map(([id, { scores }]) => ({
            agentId: id,
            name: nameMap.get(id) ?? id.slice(0, 8),
            avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
            totalEvals: scores.length,
            positiveCount: scores.filter(s => s >= 4).length,
          }))
          .sort((a, b) => b.avgScore - a.avgScore);

        setAgentStats(stats);
      } catch {
        toast.error('Erro ao carregar analytics');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const globalAgentAvg = evaluations.length > 0
    ? evaluations.reduce((s, e) => s + (e.agent_score ?? 0), 0) / evaluations.filter(e => e.agent_score != null).length
    : 0;

  const globalSystemAvg = systemRatings.length > 0
    ? systemRatings.reduce((s, r) => s + r.rating, 0) / systemRatings.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics de Suporte</h1>
          <p className="text-sm text-muted-foreground">Avaliações de atendentes e do sistema</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <div className="flex justify-center gap-0.5 mb-1">
              {[1, 2, 3, 4, 5].map(n => (
                <Star key={n} className="h-4 w-4" fill={globalAgentAvg >= n ? 'hsl(45 90% 55%)' : 'transparent'} stroke="hsl(45 90% 55%)" />
              ))}
            </div>
            <p className="text-3xl font-bold text-foreground">{globalAgentAvg > 0 ? globalAgentAvg.toFixed(1) : '—'}</p>
            <p className="text-xs text-muted-foreground">Nota Média Atendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <div className="flex justify-center gap-0.5 mb-1">
              {[1, 2, 3, 4, 5].map(n => (
                <Star key={n} className="h-4 w-4" fill={globalSystemAvg >= n ? 'hsl(200 70% 50%)' : 'transparent'} stroke="hsl(200 70% 50%)" />
              ))}
            </div>
            <p className="text-3xl font-bold text-foreground">{globalSystemAvg > 0 ? globalSystemAvg.toFixed(1) : '—'}</p>
            <p className="text-xs text-muted-foreground">Nota Média Sistema</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <p className="text-3xl font-bold text-foreground">{evaluations.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Avaliações</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <p className="text-3xl font-bold text-foreground">{agentStats.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              <Users className="h-3 w-3 inline mr-1" />Atendentes Avaliados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> Ranking de Atendimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agentStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma avaliação registrada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Atendente</TableHead>
                  <TableHead>Nota Média</TableHead>
                  <TableHead className="text-center">Avaliações</TableHead>
                  <TableHead className="text-center">Positivas (≥4★)</TableHead>
                  <TableHead className="text-right">Satisfação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentStats.map((agent, i) => {
                  const satisfaction = agent.totalEvals > 0 ? Math.round((agent.positiveCount / agent.totalEvals) * 100) : 0;
                  return (
                    <TableRow key={agent.agentId}>
                      <TableCell>
                        {i === 0 ? (
                          <span className="text-lg">🥇</span>
                        ) : i === 1 ? (
                          <span className="text-lg">🥈</span>
                        ) : i === 2 ? (
                          <span className="text-lg">🥉</span>
                        ) : (
                          <span className="text-sm text-muted-foreground font-mono">{i + 1}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{agent.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(n => (
                              <Star
                                key={n}
                                className="h-3 w-3"
                                fill={agent.avgScore >= n ? 'hsl(45 90% 55%)' : 'transparent'}
                                stroke={agent.avgScore >= n ? 'hsl(45 90% 55%)' : 'hsl(var(--muted-foreground))'}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-semibold text-foreground">{agent.avgScore.toFixed(1)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">{agent.totalEvals}</TableCell>
                      <TableCell className="text-center text-sm">{agent.positiveCount}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="secondary"
                          className="text-xs"
                          style={{
                            backgroundColor: satisfaction >= 80 ? 'hsl(145 60% 42% / 0.1)' : satisfaction >= 50 ? 'hsl(45 90% 55% / 0.1)' : 'hsl(0 70% 55% / 0.1)',
                            color: satisfaction >= 80 ? 'hsl(145 60% 42%)' : satisfaction >= 50 ? 'hsl(45 90% 55%)' : 'hsl(0 70% 55%)',
                          }}
                        >
                          {satisfaction}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
