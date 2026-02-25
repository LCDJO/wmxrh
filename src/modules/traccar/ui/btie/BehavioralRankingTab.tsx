/**
 * BehavioralRankingTab — Displays drivers ranked by score with detailed breakdown.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, Trophy, TrendingUp, TrendingDown, Minus, Shield, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const GRADE_STYLES: Record<string, { bg: string; text: string }> = {
  A: { bg: 'bg-green-500/10', text: 'text-green-600' },
  B: { bg: 'bg-blue-500/10', text: 'text-blue-600' },
  C: { bg: 'bg-yellow-500/10', text: 'text-yellow-600' },
  D: { bg: 'bg-orange-500/10', text: 'text-orange-600' },
  E: { bg: 'bg-red-500/10', text: 'text-red-600' },
};

const RISK_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  low: { label: 'Baixo', variant: 'secondary' },
  medium: { label: 'Médio', variant: 'default' },
  high: { label: 'Alto', variant: 'destructive' },
  critical: { label: 'Crítico', variant: 'destructive' },
};

export function BehavioralRankingTab({ tenantId }: { tenantId: string }) {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScores = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fleet_driver_scores')
      .select('*, employees(nome_completo)')
      .eq('tenant_id', tenantId)
      .order('overall_score', { ascending: false })
      .limit(50);
    setScores(data || []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchScores(); }, [fetchScores]);

  const exportCSV = () => {
    const headers = ['Rank', 'Colaborador', 'Score', 'Conceito', 'Risco', 'Velocidade', 'Frenagem', 'Ociosidade', 'Compliance', 'Viagens', 'Infrações', 'Km'];
    const rows = scores.map((s, i) => [
      i + 1,
      (s.employees as any)?.nome_completo || s.employee_id,
      s.overall_score, s.grade,
      s.risk_level || '-',
      s.speed_score, s.braking_score, s.idle_score || '-', s.compliance_score,
      s.total_trips, s.total_violations, s.total_distance_km,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ranking_comportamental_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Carregando ranking...</div>;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4" /> Ranking Comportamental
        </CardTitle>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      </CardHeader>
      <CardContent>
        {scores.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum score calculado. Sincronize os dados primeiro.
          </p>
        ) : (
          <div className="space-y-3">
            {scores.map((s, rank) => {
              const g = GRADE_STYLES[s.grade] || GRADE_STYLES.C;
              const risk = RISK_BADGE[s.risk_level] || RISK_BADGE.medium;
              const name = (s.employees as any)?.nome_completo || 'Colaborador';

              return (
                <div key={s.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="text-lg font-bold text-muted-foreground w-8 text-center">
                      #{rank + 1}
                    </div>

                    {/* Grade badge */}
                    <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center ${g.bg}`}>
                      <span className={`text-2xl font-black ${g.text}`}>{s.grade}</span>
                      <span className={`text-[10px] font-medium ${g.text}`}>{s.overall_score}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-semibold text-sm truncate">{name}</span>
                        <Badge variant={risk.variant} className="text-[10px]">{risk.label}</Badge>
                      </div>

                      {/* Score bars */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1.5">
                        <ScoreBar label="Velocidade" value={s.speed_score} />
                        <ScoreBar label="Frenagem" value={s.braking_score} />
                        <ScoreBar label="Ociosidade" value={s.idle_score ?? 100} />
                        <ScoreBar label="Compliance" value={s.compliance_score} />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right text-xs text-muted-foreground space-y-0.5 shrink-0">
                      <div>{s.total_trips} viagens</div>
                      <div>{s.total_distance_km} km</div>
                      <div className={s.total_violations > 0 ? 'text-destructive font-medium' : ''}>
                        {s.total_violations} infrações
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : value >= 40 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-medium">{value}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
