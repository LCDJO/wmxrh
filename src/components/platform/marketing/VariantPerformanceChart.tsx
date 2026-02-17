/**
 * VariantPerformanceChart — Bar chart comparing variant KPIs across experiments.
 */
import { useState, useEffect } from 'react';
import { FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { abTestingManager } from '@/domains/platform-growth/autonomous-marketing/ab-testing-manager';

export default function VariantPerformanceChart() {
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const running = abTestingManager.listByStatus('running');
      const completed = abTestingManager.listByStatus('completed');
      const experiments = [...running, ...completed].slice(0, 5);

      const data = experiments.flatMap(exp =>
        exp.variants.map(v => ({
          name: `${exp.name.slice(0, 12)}… / ${v.name}`,
          experiment: exp.name,
          variant: v.name,
          conversionRate: v.metrics.conversionRate,
          bounceRate: v.metrics.bounceRate,
          revenue: v.metrics.revenue,
          impressions: v.metrics.impressions,
          isControl: v.isControl,
        }))
      );

      setChartData(data);
    } catch (e) {
      console.error('VariantPerformanceChart error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <Card className="border-border/60 bg-card/80 backdrop-blur">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-52" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-primary" />
          Variant Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FlaskConical className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum experimento ativo ou concluído.</p>
            <p className="text-xs text-muted-foreground mt-1">Crie um A/B test para ver os dados aqui.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                className="fill-muted-foreground"
                angle={-25}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="conversionRate" name="Conv. Rate %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="bounceRate" name="Bounce %" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
