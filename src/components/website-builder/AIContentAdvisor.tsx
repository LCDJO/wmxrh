/**
 * AIContentAdvisor — Sidebar panel for the Website Editor.
 * Powered by GrowthAISupportLayer, provides real-time suggestions for:
 *  - SEO headline optimization
 *  - FAB structure completeness
 *  - CTA recommendations
 */
import { useMemo, useState } from 'react';
import {
  Sparkles,
  Type,
  Layers,
  MousePointerClick,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { growthAISupportLayer } from '@/domains/platform-growth/growth-ai-support-layer';
import type { WebsiteBlock } from '@/domains/website-builder/types';

interface AIContentAdvisorProps {
  blocks: WebsiteBlock[];
}

export function AIContentAdvisor({ blocks }: AIContentAdvisorProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('seo');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggle = (section: string) =>
    setExpandedSection(prev => (prev === section ? null : section));

  // ── SEO Headlines ──
  const heroBlock = blocks.find(b => b.type === 'hero');
  const currentHeadline = (heroBlock?.content?.headline as string) ?? 'Sua plataforma completa de gestão';

  const headlineSuggestions = useMemo(
    () => growthAISupportLayer.suggestHeadline(currentHeadline, { pageType: 'website' }),
    [currentHeadline],
  );

  // ── FAB Structure ──
  const fabAnalysis = useMemo(() => {
    const mockPage = {
      id: 'website-editor',
      name: 'Website',
      slug: 'website',
      status: 'draft' as const,
      blocks: blocks.map((b, i) => ({
        id: b.id,
        type: b.type as any,
        order: i,
        content: b.content ?? {},
        fab: {
          feature: b.content?.feature ?? '',
          advantage: b.content?.advantage ?? '',
          benefit: b.content?.benefit ?? '',
        },
      })),
      analytics: { views: 0, conversions: 0, conversionRate: 0, bounceRate: 0, avgTimeOnPage: 0, topSources: [] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return growthAISupportLayer.suggestFABStructure(mockPage as any);
  }, [blocks]);

  // ── CTA Recommendations ──
  const ctaBlocks = blocks.filter(b => b.type === 'cta-section');
  const ctaSuggestions = useMemo(() => {
    const suggestions: Array<{ id: string; text: string; rationale: string }> = [];

    if (ctaBlocks.length === 0) {
      suggestions.push({
        id: 'cta-missing',
        text: 'Adicionar bloco CTA',
        rationale: 'Páginas sem CTA explícito têm 40% menos conversões. Adicione ao menos um CTA após a seção de benefícios.',
      });
    }

    const hasUrgency = ctaBlocks.some(b => b.content?.urgency);
    if (ctaBlocks.length > 0 && !hasUrgency) {
      suggestions.push({
        id: 'cta-urgency',
        text: 'Adicionar urgência ao CTA',
        rationale: 'Elementos de escassez ("vagas limitadas", "oferta por tempo limitado") aumentam cliques em até 20%.',
      });
    }

    suggestions.push(
      {
        id: 'cta-text-1',
        text: 'Começar agora — é grátis',
        rationale: 'CTAs com benefício imediato ("é grátis") convertem 18% melhor que genéricos ("Saiba mais").',
      },
      {
        id: 'cta-text-2',
        text: 'Agendar demo personalizada',
        rationale: 'Para B2B, CTAs de demo qualificam leads 3x melhor que "Cadastre-se".',
      },
    );

    return suggestions;
  }, [ctaBlocks]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copiado!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="w-72 shrink-0 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">AI Content Advisor</p>
          <p className="text-[10px] text-muted-foreground">Growth AI Support</p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {/* ── SEO Headlines ── */}
          <AdvisorSection
            icon={<Type className="h-3.5 w-3.5" />}
            title="SEO Headlines"
            badge={`${headlineSuggestions.length}`}
            expanded={expandedSection === 'seo'}
            onToggle={() => toggle('seo')}
          >
            <p className="text-[10px] text-muted-foreground mb-2">
              Headline atual: <span className="font-medium text-foreground">"{currentHeadline}"</span>
            </p>
            <div className="space-y-2">
              {headlineSuggestions.map(s => (
                <div
                  key={s.id}
                  className="rounded-lg border border-border/50 bg-background/60 p-2.5 space-y-1"
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs font-medium text-foreground leading-snug">
                      "{s.variant}"
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleCopy(s.variant, s.id)}
                    >
                      {copiedId === s.id ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{s.rationale}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                      +{s.expectedLiftPct}% lift
                    </Badge>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                      {s.confidence}% confiança
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </AdvisorSection>

          {/* ── FAB Structure ── */}
          <AdvisorSection
            icon={<Layers className="h-3.5 w-3.5" />}
            title="Organização FAB"
            badge={fabAnalysis.expectedImpact}
            badgeVariant={fabAnalysis.expectedImpact === 'high' ? 'destructive' : 'secondary'}
            expanded={expandedSection === 'fab'}
            onToggle={() => toggle('fab')}
          >
            <p className="text-[10px] text-muted-foreground mb-2">{fabAnalysis.rationale}</p>

            {fabAnalysis.missingElements.length > 0 && (
              <div className="space-y-1 mb-2">
                <p className="text-[10px] font-semibold text-destructive">Elementos ausentes:</p>
                {fabAnalysis.missingElements.map((el, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="h-1 w-1 rounded-full bg-destructive shrink-0" />
                    {el}
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-[10px] font-semibold text-foreground mb-1">Ordem ideal:</p>
              <div className="flex flex-wrap gap-1">
                {fabAnalysis.suggestedOrder.map((item, i) => (
                  <Badge key={i} variant="outline" className="text-[9px] capitalize">
                    {i + 1}. {item}
                  </Badge>
                ))}
              </div>
            </div>
          </AdvisorSection>

          {/* ── CTA Recommendations ── */}
          <AdvisorSection
            icon={<MousePointerClick className="h-3.5 w-3.5" />}
            title="CTA Recomendado"
            badge={`${ctaSuggestions.length}`}
            expanded={expandedSection === 'cta'}
            onToggle={() => toggle('cta')}
          >
            <div className="space-y-2">
              {ctaSuggestions.map(s => (
                <div
                  key={s.id}
                  className="rounded-lg border border-border/50 bg-background/60 p-2.5 space-y-1"
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs font-semibold text-foreground">{s.text}</p>
                    {!s.id.startsWith('cta-missing') && !s.id.startsWith('cta-urgency') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => handleCopy(s.text, s.id)}
                      >
                        {copiedId === s.id ? (
                          <Check className="h-3 w-3 text-success" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{s.rationale}</p>
                </div>
              ))}
            </div>
          </AdvisorSection>
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Collapsible Section ──

function AdvisorSection({
  icon,
  title,
  badge,
  badgeVariant = 'secondary',
  expanded,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  badgeVariant?: 'secondary' | 'destructive';
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/50">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
      >
        <span className="text-primary">{icon}</span>
        <span className="text-xs font-semibold text-foreground flex-1">{title}</span>
        {badge && (
          <Badge variant={badgeVariant} className="text-[9px] px-1.5 py-0">
            {badge}
          </Badge>
        )}
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
      {expanded && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
