import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search } from 'lucide-react';

interface Props {
  title?: string;
  description?: string;
  ogImage?: boolean;
  canonicalUrl?: boolean;
  structuredData?: boolean;
  headlineLength?: number;
  h1Count?: number;
  hasAltTags?: boolean;
}

export function SEOScoreWidget({
  title = '',
  description = '',
  ogImage = false,
  canonicalUrl = false,
  structuredData = false,
  headlineLength = 0,
  h1Count = 1,
  hasAltTags = false,
}: Props) {
  const { score, items } = useMemo(() => {
    const checks = [
      { label: 'Title (< 60 chars)', pass: title.length > 0 && title.length <= 60, weight: 15 },
      { label: 'Meta description (< 160)', pass: description.length > 0 && description.length <= 160, weight: 15 },
      { label: 'OG Image', pass: ogImage, weight: 10 },
      { label: 'Canonical URL', pass: canonicalUrl, weight: 10 },
      { label: 'Schema.org / JSON-LD', pass: structuredData, weight: 15 },
      { label: 'Headline adequada', pass: headlineLength >= 20 && headlineLength <= 60, weight: 10 },
      { label: 'H1 único', pass: h1Count === 1, weight: 15 },
      { label: 'Alt tags em imagens', pass: hasAltTags, weight: 10 },
    ];
    const total = checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0);
    return { score: total, items: checks };
  }, [title, description, ogImage, canonicalUrl, structuredData, headlineLength, h1Count, hasAltTags]);

  const color = score >= 80 ? 'text-accent-foreground' : score >= 50 ? 'text-warning' : 'text-destructive';
  const bg = score >= 80 ? 'bg-accent' : score >= 50 ? 'bg-warning/10' : 'bg-destructive/10';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">SEO Score</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-14 w-14 items-center justify-center rounded-xl font-bold text-xl ${bg} ${color}`}>
            {score}
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">
              {score >= 80 ? 'Excelente' : score >= 50 ? 'Melhorar' : 'Crítico'}
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
