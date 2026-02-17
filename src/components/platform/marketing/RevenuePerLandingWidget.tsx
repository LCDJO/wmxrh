/**
 * RevenuePerLandingWidget — Revenue metrics per landing page with sparkline-style bars.
 */
import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import type { PageRanking } from '@/domains/platform-growth/autonomous-marketing';

export default function RevenuePerLandingWidget() {
  const [data, setData] = useState<PageRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ revenue: 0, visitors: 0, rpv: 0 });

  useEffect(() => {
    (async () => {
      try {
        const { data: result, error } = await supabase.functions.invoke('top-conversions', {
          method: 'GET',
          body: null,
        });
        if (!error && result?.top_by_revenue) {
          setData(result.top_by_revenue);
          const rev = result.top_by_revenue.reduce((s: number, p: PageRanking) => s + p.total_revenue, 0);
          const vis = result.top_by_revenue.reduce((s: number, p: PageRanking) => s + p.unique_visitors, 0);
          setTotals({ revenue: rev, visitors: vis, rpv: vis > 0 ? rev / vis : 0 });
        }
      } catch (e) {
        console.error('Revenue widget error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const maxRevenue = Math.max(...data.map(p => p.total_revenue), 1);

  if (loading) {
    return (
      <Card className="border-border/60 bg-card/80 backdrop-blur">
        <CardHeader className="pb-3"><Skeleton className="h-5 w-44" /></CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4 text-primary" />
          Revenue por Landing Page
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Receita Total', value: `R$ ${totals.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
            { label: 'Visitantes', value: totals.visitors.toLocaleString() },
            { label: 'RPV Médio', value: `R$ ${totals.rpv.toFixed(2)}` },
          ].map(k => (
            <div key={k.label} className="text-center p-2 rounded-lg bg-muted/40">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-sm font-bold text-foreground">{k.value}</p>
            </div>
          ))}
        </div>

        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum dado de receita.</p>
        ) : (
          <div className="space-y-2">
            {data.map(page => (
              <div key={page.landing_page_id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground truncate max-w-[60%]">{page.page_name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">RPV R$ {page.revenue_per_visitor}</span>
                    <span className="text-xs font-bold text-primary">
                      R$ {page.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/70 rounded-full transition-all duration-700"
                    style={{ width: `${(page.total_revenue / maxRevenue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
