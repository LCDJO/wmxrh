/**
 * LandingPageRenderer — Renders a full, conversion-optimized landing page.
 *
 * Integrates with:
 *  - FABContentEngine (copy blueprint)
 *  - ConversionTrackingService (event tracking)
 *  - NavigationIntelligence (route registration)
 *  - Design System (automatic token application)
 *
 * Mandatory section order:
 *   1. HeroSection
 *   2. FABSection (Features + Advantages + Benefits)
 *   3. PricingSection
 *   4. ReferralCTA
 *   5. TestimonialsSection
 *   6. FAQSection
 *   7. FooterSection
 */
import { useEffect, useMemo, useRef } from 'react';
import type { LPCopyBlueprint, LandingPage } from '@/domains/platform-growth/types';
import { fabContentEngine } from '@/domains/platform-growth/landing-page-builder';
import { conversionTrackingService } from '@/domains/platform-growth/conversion-tracking-service';
import { HeroSection } from './HeroSection';
import { FABSection } from './FABSection';
import { PricingSection } from './PricingSection';
import { ReferralCTA } from './ReferralCTA';
import { TestimonialsSection } from './TestimonialsSection';
import { FAQSection } from './FAQSection';
import { FooterSection } from './FooterSection';

interface LandingPageRendererProps {
  /** Pre-built blueprint (takes precedence) */
  blueprint?: LPCopyBlueprint;
  /** Or auto-generate from industry + modules */
  industry?: string;
  modules?: string[];
  /** Landing page entity for tracking */
  page?: LandingPage;
  /** Referral code to display */
  referralCode?: string;
}

export function LandingPageRenderer({
  blueprint: externalBlueprint,
  industry = 'default',
  modules = [],
  page,
  referralCode,
}: LandingPageRendererProps) {
  const viewTracked = useRef(false);

  // ── Generate or use provided blueprint ──
  const blueprint = useMemo(() => {
    if (externalBlueprint) return externalBlueprint;
    return fabContentEngine.generateBlueprint(industry, modules);
  }, [externalBlueprint, industry, modules]);

  // ── Track page view on mount ──
  useEffect(() => {
    if (page && !viewTracked.current) {
      viewTracked.current = true;
      conversionTrackingService.track({
        landingPageId: page.id,
        type: 'signup',
        source: detectSource(),
        referralCode: referralCode ?? page.referral_program_id ?? undefined,
        metadata: { event: 'page_view', url: window.location.href },
      });
    }
  }, [page, referralCode]);

  // ── Track CTA clicks ──
  const handleCTAClick = (section: string) => {
    if (!page) return;
    conversionTrackingService.track({
      landingPageId: page.id,
      type: 'signup',
      source: detectSource(),
      referralCode: referralCode ?? undefined,
      metadata: { event: 'cta_click', section },
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground" onClick={captureCtaClicks(handleCTAClick)}>
      {/* 1. Hero */}
      <HeroSection data={blueprint.hero} />

      {/* 2. FAB (Features + Advantages + Benefits) */}
      <FABSection
        features={blueprint.features}
        advantages={blueprint.advantages}
        benefits={blueprint.benefits}
      />

      {/* 3. Pricing */}
      <PricingSection />

      {/* 4. Referral CTA */}
      <ReferralCTA referralCode={referralCode} />

      {/* 5. Testimonials + Proof */}
      <TestimonialsSection data={blueprint.proof} />

      {/* 6. FAQ */}
      <FAQSection />

      {/* 7. Footer (with final CTA) */}
      <FooterSection cta={blueprint.cta} />
    </div>
  );
}

// ── Utilities ────────────────────────────────────────────────

/** Detect traffic source from URL params or referrer */
function detectSource(): string {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  if (utmSource) return utmSource;
  if (document.referrer) {
    try {
      return new URL(document.referrer).hostname;
    } catch {
      return 'direct';
    }
  }
  return 'direct';
}

/** Delegate click handler for CTA buttons (data-cta attribute) */
function captureCtaClicks(handler: (section: string) => void) {
  return (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('button, a');
    if (!target) return;
    // Identify section by closest <section> or <footer>
    const section = target.closest('section, footer');
    if (section) {
      const heading = section.querySelector('h1, h2');
      handler(heading?.textContent ?? 'unknown');
    }
  };
}
