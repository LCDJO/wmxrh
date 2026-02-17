import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye } from 'lucide-react';

interface Props {
  /** All images have alt text */
  allImagesHaveAlt?: boolean;
  /** Semantic HTML used (header, main, section, footer) */
  usesSemanticHtml?: boolean;
  /** Sufficient color contrast */
  hasGoodContrast?: boolean;
  /** Focusable interactive elements */
  focusableElements?: boolean;
  /** ARIA labels on icons/buttons */
  hasAriaLabels?: boolean;
  /** Text is legible (min 14px) */
  minFontSize?: boolean;
  /** Links have descriptive text (not "click here") */
  descriptiveLinks?: boolean;
}

export function AccessibilityScore({
  allImagesHaveAlt = false,
  usesSemanticHtml = false,
  hasGoodContrast = false,
  focusableElements = false,
  hasAriaLabels = false,
  minFontSize = false,
  descriptiveLinks = false,
}: Props) {
  const { score, items } = useMemo(() => {
    const checks = [
      { label: 'Alt text em imagens', pass: allImagesHaveAlt, weight: 20 },
      { label: 'HTML semântico', pass: usesSemanticHtml, weight: 15 },
      { label: 'Contraste de cores', pass: hasGoodContrast, weight: 15 },
      { label: 'Elementos focáveis', pass: focusableElements, weight: 15 },
      { label: 'ARIA labels', pass: hasAriaLabels, weight: 15 },
      { label: 'Font size ≥ 14px', pass: minFontSize, weight: 10 },
      { label: 'Links descritivos', pass: descriptiveLinks, weight: 10 },
    ];
    const total = checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0);
    return { score: total, items: checks };
  }, [allImagesHaveAlt, usesSemanticHtml, hasGoodContrast, focusableElements, hasAriaLabels, minFontSize, descriptiveLinks]);

  const color = score >= 80 ? 'text-accent-foreground' : score >= 50 ? 'text-warning' : 'text-destructive';
  const bg = score >= 80 ? 'bg-accent' : score >= 50 ? 'bg-warning/10' : 'bg-destructive/10';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Acessibilidade</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-14 w-14 items-center justify-center rounded-xl font-bold text-xl ${bg} ${color}`}>
            {score}
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">
              {score >= 80 ? 'Acessível' : score >= 50 ? 'Parcial' : 'Inacessível'}
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
