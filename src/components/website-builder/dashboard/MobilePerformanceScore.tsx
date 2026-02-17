import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone } from 'lucide-react';

interface Props {
  /** Number of blocks on the page */
  blockCount?: number;
  /** Max columns in any grid block */
  maxColumns?: number;
  /** Longest CTA text length */
  longestCtaLength?: number;
  /** Whether responsive overrides are configured */
  hasResponsiveOverrides?: boolean;
  /** Number of heavy assets (large images, videos) */
  heavyAssetCount?: number;
  /** Whether lazy loading is enabled */
  lazyLoadEnabled?: boolean;
}

export function MobilePerformanceScore({
  blockCount = 0,
  maxColumns = 1,
  longestCtaLength = 0,
  hasResponsiveOverrides = false,
  heavyAssetCount = 0,
  lazyLoadEnabled = false,
}: Props) {
  const { score, items } = useMemo(() => {
    const checks = [
      { label: 'Seções ≤ 8', pass: blockCount <= 8, weight: 15 },
      { label: 'Grid ≤ 3 colunas', pass: maxColumns <= 3, weight: 15 },
      { label: 'CTA ≤ 25 chars', pass: longestCtaLength <= 25, weight: 15 },
      { label: 'Overrides responsivos', pass: hasResponsiveOverrides, weight: 20 },
      { label: 'Assets leves (≤ 3)', pass: heavyAssetCount <= 3, weight: 15 },
      { label: 'Lazy loading ativo', pass: lazyLoadEnabled, weight: 20 },
    ];
    const total = checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0);
    return { score: total, items: checks };
  }, [blockCount, maxColumns, longestCtaLength, hasResponsiveOverrides, heavyAssetCount, lazyLoadEnabled]);

  const color = score >= 80 ? 'text-accent-foreground' : score >= 50 ? 'text-warning' : 'text-destructive';
  const bg = score >= 80 ? 'bg-accent' : score >= 50 ? 'bg-warning/10' : 'bg-destructive/10';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Mobile Performance</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-14 w-14 items-center justify-center rounded-xl font-bold text-xl ${bg} ${color}`}>
            {score}
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">
              {score >= 80 ? 'Otimizado' : score >= 50 ? 'Aceitável' : 'Lento'}
            </p>
            <p className="text-[10px] text-muted-foreground">{items.filter(i => i.pass).length}/{items.length} checks</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-[11px]">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${item.pass ? 'bg-accent-foreground' : 'bg-destructive'}`} />
              <span className={item.pass ? 'text-muted-foreground' : 'text-foreground font-medium'}>{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
