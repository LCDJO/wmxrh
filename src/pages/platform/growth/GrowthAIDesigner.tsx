/**
 * GrowthAIDesigner — Page wrapper for the AI Conversion Designer.
 */
import { Paintbrush, Sparkles, BarChart3, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const MOCK_SCORES = [
  { section: 'Hero', score: 87, suggestion: 'Adicionar CTA secundário para aumentar conversão' },
  { section: 'FAB Features', score: 72, suggestion: 'Reordenar features por impacto de CTR' },
  { section: 'Pricing', score: 91, suggestion: 'Destacar plano mais popular com animação' },
  { section: 'Testimonials', score: 65, suggestion: 'Adicionar mais 2 depoimentos com métricas' },
  { section: 'Footer CTA', score: 78, suggestion: 'Testar urgência vs benefício no copy' },
];

export default function GrowthAIDesigner() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Paintbrush className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">AI Conversion Designer</h1>
        </div>
        <p className="text-sm text-muted-foreground">Análise e otimização de conversão com inteligência artificial.</p>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-3xl font-bold text-foreground">78.6</p>
            <p className="text-xs text-muted-foreground">Conversion Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Sparkles className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-3xl font-bold text-foreground">5</p>
            <p className="text-xs text-muted-foreground">Sugestões de melhoria</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <FlaskConical className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-3xl font-bold text-foreground">2</p>
            <p className="text-xs text-muted-foreground">A/B Tests Ativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Section analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Análise por Seção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {MOCK_SCORES.map(s => (
            <div key={s.section} className="flex items-center gap-4 p-3 rounded-lg border border-border/40">
              <div className="text-center w-14 shrink-0">
                <p className="text-lg font-bold text-foreground">{s.score}</p>
                <p className="text-[9px] text-muted-foreground">score</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{s.section}</p>
                <p className="text-xs text-muted-foreground">{s.suggestion}</p>
              </div>
              <Badge variant="outline" className={s.score >= 80 ? 'text-emerald-600 border-emerald-500/30' : s.score >= 60 ? 'text-amber-600 border-amber-500/30' : 'text-red-600 border-red-500/30'}>
                {s.score >= 80 ? 'Bom' : s.score >= 60 ? 'Melhorar' : 'Crítico'}
              </Badge>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => toast.info(`Aplicando sugestão para ${s.section}...`)}>
                Aplicar
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
