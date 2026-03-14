/**
 * DeviceAnalyticsPanel — Breakdown by browser, OS, device type, login method.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';
import type { SessionRecord } from '../hooks/useActiveSessions';

interface Props { sessions: SessionRecord[] }

function countBy(items: string[]): Array<{ label: string; count: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item, (map.get(item) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function MiniBar({ data, title }: { data: Array<{ label: string; count: number }>; title: string }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div>
      <div className="text-xs font-medium text-foreground mb-1.5">{title}</div>
      <div className="space-y-1">
        {data.slice(0, 6).map(d => (
          <div key={d.label} className="flex items-center gap-2 text-[10px]">
            <span className="w-20 truncate text-muted-foreground">{d.label}</span>
            <div className="flex-1 h-3 bg-muted/30 rounded overflow-hidden">
              <div
                className="h-full bg-primary/60 rounded"
                style={{ width: `${(d.count / max) * 100}%` }}
              />
            </div>
            <Badge variant="outline" className="text-[8px] h-4 px-1 shrink-0">{d.count}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DeviceAnalyticsPanel({ sessions }: Props) {
  const browsers = useMemo(() => countBy(sessions.map(s => s.browser ?? 'Unknown')), [sessions]);
  const oses = useMemo(() => countBy(sessions.map(s => s.os ?? 'Unknown')), [sessions]);
  const devices = useMemo(() => countBy(sessions.map(s => s.device_type ?? 'unknown')), [sessions]);
  const methods = useMemo(() => countBy(sessions.map(s => s.login_method ?? 'password')), [sessions]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> Análise de Dispositivos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <MiniBar data={browsers} title="Navegadores" />
          <MiniBar data={oses} title="Sistemas Operacionais" />
          <MiniBar data={devices} title="Tipo de Dispositivo" />
          <MiniBar data={methods} title="Método de Login" />
        </div>
      </CardContent>
    </Card>
  );
}
