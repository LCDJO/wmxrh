/**
 * RevenueForecastChart — Gráfico de previsão de receita com cenários.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { getRevenueIntelligenceEngine } from '@/domains/revenue-intelligence';
import type { RevenueForecast } from '@/domains/revenue-intelligence';

function formatBRL(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

export default function RevenueForecastChart() {
  const [data, setData] = useState<RevenueForecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const engine = getRevenueIntelligenceEngine();
    engine.analyzer.getForecast(12).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <Card><CardContent className="pt-5"><Skeleton className="h-[320px] w-full" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Previsão de Receita (12 meses)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">Sem dados de previsão.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip
                formatter={(v: number) => formatBRL(v)}
                contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
              />
              <Legend />
              <Area type="monotone" dataKey="confidence_low" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted)/0.3)" strokeWidth={1} name="Pessimista" strokeDasharray="4 2" />
              <Area type="monotone" dataKey="projected_mrr" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.15)" strokeWidth={2.5} name="Base" />
              <Area type="monotone" dataKey="confidence_high" stroke="hsl(142 76% 36%)" fill="hsl(142 76% 36% / 0.1)" strokeWidth={1} name="Otimista" strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
