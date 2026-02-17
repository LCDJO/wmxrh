/**
 * WebsitePipelineBridge — Routes Website domain events into the
 * unified ConversionTrackingService so both Website and Landing Page
 * events flow through the same pipeline.
 *
 * Website = branding + SEO (top-of-funnel awareness)
 * Landing Page = conversion + experiments (mid/bottom-of-funnel)
 *
 * Both register events with distinct `origin` tags so downstream
 * analytics can segment by source type.
 *
 * ╔════════════════════════════════════════╗
 * ║  Website Events                        ║
 * ║   WebsitePublished → page_view         ║
 * ║   CTA clicks       → cta_click         ║
 * ║                                        ║
 * ║  Landing Page Events                   ║
 * ║   All conversion types (signup, etc.)  ║
 * ║                                        ║
 * ║       ↓ Both flow into ↓               ║
 * ║  ConversionTrackingService             ║
 * ║       ↓                                ║
 * ║  ConversionPipeline (7 stages)         ║
 * ╚════════════════════════════════════════╝
 */
import { onWebsiteEvent } from '@/domains/website-builder/website.events';
import { conversionTrackingService } from '@/domains/platform-growth/conversion-tracking-service';
import { emitGrowthEvent } from '@/domains/platform-growth/growth.events';

// ── Bridge ─────────────────────────────────────────────

let initialized = false;

export function initWebsitePipelineBridge(): () => void {
  if (initialized) return () => {};
  initialized = true;

  const unsub = onWebsiteEvent((event) => {
    switch (event.type) {
      case 'WebsitePublished': {
        // Website publication generates a page_view event in the pipeline
        conversionTrackingService.track({
          landingPageId: event.pageId,
          origin: 'website',
          type: 'page_view',
          source: 'website',
          metadata: {
            pageTitle: event.pageTitle,
            slug: event.slug,
            version: event.version,
          },
        });

        emitGrowthEvent({
          type: 'ConversionTracked',
          timestamp: Date.now(),
          pageId: event.pageId,
          conversionType: 'page_view',
          source: 'website',
        });
        break;
      }

      case 'WebsiteSubmitted': {
        // Track website submission as engagement signal
        conversionTrackingService.track({
          landingPageId: event.pageId,
          origin: 'website',
          type: 'page_view',
          source: 'website',
          metadata: {
            pageTitle: event.pageTitle,
            action: 'submitted',
            seoScore: event.seoScore,
          },
        });
        break;
      }

      default:
        break;
    }
  });

  return () => {
    unsub();
    initialized = false;
  };
}

/**
 * Track a website CTA click manually (called from website renderer).
 */
export function trackWebsiteCTAClick(
  pageId: string,
  ctaLabel: string,
  ctaTarget: string,
  source: string = 'website',
) {
  conversionTrackingService.track({
    landingPageId: pageId,
    origin: 'website',
    type: 'cta_click',
    source,
    metadata: { ctaLabel, ctaTarget },
  });

  emitGrowthEvent({
    type: 'ConversionTracked',
    timestamp: Date.now(),
    pageId,
    conversionType: 'cta_click',
    source,
  });
}

/**
 * Track a website page view (called from public website renderer).
 */
export function trackWebsitePageView(
  pageId: string,
  slug: string,
  source: string = 'organic',
) {
  conversionTrackingService.track({
    landingPageId: pageId,
    origin: 'website',
    type: 'page_view',
    source,
    metadata: { slug },
  });
}

export const websitePipelineBridge = {
  init: initWebsitePipelineBridge,
  trackCTAClick: trackWebsiteCTAClick,
  trackPageView: trackWebsitePageView,
};
