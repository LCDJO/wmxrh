import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Trophy } from 'lucide-react';
import { format } from 'date-fns';

const GRADE_COLORS: Record<string, string> = {
  A: 'text-green-500 bg-green-500/10',
  B: 'text-blue-500 bg-blue-500/10',
  C: 'text-yellow-500 bg-yellow-500/10',
  D: 'text-orange-500 bg-orange-500/10',
  E: 'text-red-500 bg-red-500/10',
};

export function DriverScoresTab({ tenantId }: { tenantId: string }) {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScores = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fleet_driver_scores')
      .select('*, employees(nome_completo)')
      .eq('tenant_id', tenantId)
      .order('overall_score', { ascending: true })
      .limit(100);
    setScores(data || []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchScores(); }, [fetchScores]);

  const exportCSV = () => {
    const headers = ['Colaborador', 'Score', 'Conceito', 'Velocidade', 'Frenagem', 'Compliance', 'Viagens', 'Infrações', 'Km'];
    const rows = scores.map(s => [
      (s.employees as any)?.nome_completo || s.employee_id,
      s.overall_score, s.grade, s.speed_score, s.braking_score,
      s.compliance_score, s.total_trips, s.total_violations, s.total_distance_km,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `scores_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Carregando scores...</div>;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Score Comportamental dos Motoristas</CardTitle>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      </CardHeader>
      <CardContent>
        {scores.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum score calculado ainda. Sincronize os dados primeiro.</p>
        ) : (
          <div className="space-y-2">
            {scores.map(s => {
              const gradeClass = GRADE_COLORS[s.grade] || GRADE_COLORS.C;
              return (
                <div key={s.id} className="border rounded-lg p-3 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-xl ${gradeClass}`}>
                    {s.grade}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm truncate">
                        {(s.employees as any)?.nome_completo || 'Colaborador'}
                      </span>
                      <span className="text-lg font-bold">{s.overall_score}</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                      <span>Velocidade: {s.speed_score}</span>
                      <span>Frenagem: {s.braking_score}</span>
                      <span>Compliance: {s.compliance_score}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground space-y-0.5">
                    <div>{s.total_trips} viagens</div>
                    <div>{s.total_distance_km} km</div>
                    <div className={s.total_violations > 0 ? 'text-destructive' : ''}>
                      {s.total_violations} infrações
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
