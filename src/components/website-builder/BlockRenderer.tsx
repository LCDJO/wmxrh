import type { WebsiteBlock } from '@/domains/website-builder/types';
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
}

export function BlockRenderer({ block }: Props) {
  switch (block.type) {
    case 'hero':
      return <HeroPreview content={block.content} />;
    case 'feature-grid':
      return <FeatureGridPreview content={block.content} />;
    case 'fab-block':
      return <FABBlockPreview content={block.content} />;
    case 'pricing-table':
      return <PricingTablePreview content={block.content} />;
    case 'cta-section':
      return <CTASectionPreview content={block.content} />;
    case 'testimonial-slider':
      return <TestimonialSliderPreview content={block.content} />;
    case 'faq-accordion':
      return <FAQAccordionPreview content={block.content} />;
    default:
      return (
        <div className="rounded-lg border border-border/60 bg-card/60 p-6 text-center">
          <p className="text-sm text-muted-foreground">Bloco desconhecido: {block.type}</p>
        </div>
      );
  }
}
