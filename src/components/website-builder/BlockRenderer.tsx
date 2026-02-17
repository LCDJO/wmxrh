import type { WebsiteBlock, Viewport } from '@/domains/website-builder/types';
import { resolveBreakpoint } from '@/domains/website-builder/responsive-layout-engine';
import {
  HeroPreview,
  FeatureGridPreview,
  FABBlockPreview,
  PricingTablePreview,
  CTASectionPreview,
  TestimonialSliderPreview,
  FAQAccordionPreview,
} from './block-previews';

interface Props {
  block: WebsiteBlock;
  viewport?: Viewport;
}

export function BlockRenderer({ block, viewport = 'desktop' }: Props) {
  const bp = resolveBreakpoint(block, viewport);

  if (bp.hidden) return null;

  const props = { content: block.content, viewport, breakpoint: bp };

  switch (block.type) {
    case 'hero':
      return <HeroPreview {...props} />;
    case 'feature-grid':
      return <FeatureGridPreview {...props} />;
    case 'fab-block':
      return <FABBlockPreview {...props} />;
    case 'pricing-table':
      return <PricingTablePreview {...props} />;
    case 'cta-section':
      return <CTASectionPreview {...props} />;
    case 'testimonial-slider':
      return <TestimonialSliderPreview {...props} />;
    case 'faq-accordion':
      return <FAQAccordionPreview {...props} />;
    default:
      return (
        <div className="rounded-lg border border-border/60 bg-card/60 p-6 text-center">
          <p className="text-sm text-muted-foreground">Bloco desconhecido: {block.type}</p>
        </div>
      );
  }
}
