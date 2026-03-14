/**
 * LoginHeatmapPanel — Charts showing login distribution by country, city, tenant, and hour.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';
import type { SessionRecord } from '../hooks/useActiveSessions';

interface Props { sessions: SessionRecord[] }

function countBy(items: string[]): Array<{ label: string; count: number }> {
  const map = new Map<string, number>();
  for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function HorizontalBar({ data, title, maxItems = 8 }: { data: Array<{ label: string; count: number }>; title: string; maxItems?: number }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-foreground">{title}</div>
        <Badge variant="outline" className="text-[9px]">{total} total</Badge>
      </div>
      <div className="space-y-1">
        {data.slice(0, maxItems).map(d => (
          <div key={d.label} className="flex items-center gap-2 text-[10px]">
            <span className="w-24 truncate text-muted-foreground">{d.label}</span>
            <div className="flex-1 h-4 bg-muted/30 rounded overflow-hidden relative">
              <div
                className="h-full bg-primary/50 rounded transition-all"
                style={{ width: `${(d.count / max) * 100}%` }}
              />
              <span className="absolute right-1 top-0 h-full flex items-center text-[9px] text-foreground font-medium">
                {d.count}
              </span>
            </div>
            <span className="text-[9px] text-muted-foreground w-8 text-right">
              {total > 0 ? Math.round((d.count / total) * 100) : 0}%
            </span>
          </div>
        ))}
        {data.length === 0 && (
          <div className="text-[10px] text-muted-foreground text-center py-4">Sem dados</div>
        )}
      </div>
    </div>
  );
}

function HourlyHeatmap({ sessions }: { sessions: SessionRecord[] }) {
  const hourData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    for (const s of sessions) {
      const h = new Date(s.login_at).getHours();
      hours[h].count++;
    }
    return hours;
  }, [sessions]);

  const max = Math.max(...hourData.map(h => h.count), 1);

  return (
    <div>
      <div className="text-xs font-medium text-foreground mb-2">Logins por Hora</div>
      <div className="flex gap-0.5 items-end h-20">
        {hourData.map(h => (
          <div
            key={h.hour}
            className="flex-1 rounded-t transition-all group relative"
            style={{
              height: `${Math.max((h.count / max) * 100, 4)}%`,
              backgroundColor: h.count === 0
                ? 'hsl(var(--muted) / 0.3)'
                : `hsl(var(--primary) / ${0.3 + (h.count / max) * 0.7})`,
            }}
          >
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:block text-[8px] bg-popover text-popover-foreground px-1 rounded border border-border whitespace-nowrap z-10">
              {h.hour}h: {h.count}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[8px] text-muted-foreground mt-1">
        <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
      </div>
    </div>
  );
}

export function LoginHeatmapPanel({ sessions }: Props) {
  const byCountry = useMemo(() => countBy(sessions.filter(s => s.country).map(s => s.country!)), [sessions]);
  const byCity = useMemo(() => countBy(sessions.filter(s => s.city).map(s => s.city!)), [sessions]);
  const byTenant = useMemo(() => countBy(sessions.filter(s => s.tenant_name).map(s => s.tenant_name!)), [sessions]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> Heatmap de Logins
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <HourlyHeatmap sessions={sessions} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <HorizontalBar data={byCountry} title="Por País" />
          <HorizontalBar data={byCity} title="Por Cidade" />
          <HorizontalBar data={byTenant} title="Por Tenant" />
        </div>
      </CardContent>
    </Card>
  );
}
