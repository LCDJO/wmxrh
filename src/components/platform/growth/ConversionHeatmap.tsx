/**
 * ConversionHeatmap — Visual heatmap of conversion events across time slots.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const HOURS = ['06h', '09h', '12h', '15h', '18h', '21h'];

function generateMockData() {
  return DAYS.map(day =>
    HOURS.map(hour => ({
      day,
      hour,
      value: Math.floor(Math.random() * 100),
    }))
  ).flat();
}

function getHeatColor(value: number): string {
  if (value >= 80) return 'bg-primary text-primary-foreground';
  if (value >= 60) return 'bg-primary/70 text-primary-foreground';
  if (value >= 40) return 'bg-primary/40 text-primary-foreground';
  if (value >= 20) return 'bg-primary/20 text-foreground';
  return 'bg-muted text-muted-foreground';
}

export function ConversionHeatmap() {
  const data = generateMockData();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Heatmap de Conversões</CardTitle>
          <Badge variant="outline" className="text-[10px]">Últimos 7 dias</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="grid gap-1" style={{ gridTemplateColumns: `60px repeat(${HOURS.length}, 1fr)` }}>
            {/* Header row */}
            <div />
            {HOURS.map(h => (
              <div key={h} className="text-[10px] text-muted-foreground text-center font-medium">{h}</div>
            ))}

            {/* Data rows */}
            {DAYS.map(day => (
              <>
                <div key={`label-${day}`} className="text-xs text-muted-foreground font-medium flex items-center">{day}</div>
                {HOURS.map(hour => {
                  const cell = data.find(d => d.day === day && d.hour === hour);
                  const val = cell?.value ?? 0;
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className={cn(
                        'rounded-md flex items-center justify-center text-[10px] font-bold h-8 transition-colors',
                        getHeatColor(val)
                      )}
                      title={`${day} ${hour}: ${val} conversões`}
                    >
                      {val}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-4 justify-end">
          <span className="text-[10px] text-muted-foreground">Baixo</span>
          {[0, 20, 40, 60, 80].map(v => (
            <div key={v} className={cn('h-3 w-6 rounded', getHeatColor(v))} />
          ))}
          <span className="text-[10px] text-muted-foreground">Alto</span>
        </div>
      </CardContent>
    </Card>
  );
}
