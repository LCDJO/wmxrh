/**
 * LandingPageRenderer — Renders a full, conversion-optimized landing page.
 *
 * Integrates with:
 *  - FABContentEngine (copy blueprint)
 *  - GTMInjectionService (5 automatic events)
 *  - ConversionTrackingService (event tracking)
 *  - ReferralTrackingService (referral attribution)
 *
 * GTM Automatic Events:
 *  1. page_view       → on mount
 *  2. cta_click       → on any CTA button click
 *  3. trial_start     → on free trial CTA click
 *  4. plan_selected   → on pricing plan selection
 *  5. referral_signup → on referral share/signup
 */
import { useEffect, useMemo, useRef } from 'react';
import type { LPCopyBlueprint, LandingPage } from '@/domains/platform-growth/types';
import { fabContentEngine } from '@/domains/platform-growth/landing-page-builder';
import { conversionTrackingService } from '@/domains/platform-growth/conversion-tracking-service';
import { gtmInjectionService } from '@/domains/platform-growth/tag-manager-integration';
import { referralTrackingService } from '@/domains/platform-growth/referral-tracking-service';
import { seoOptimizationService } from '@/domains/platform-growth/seo-optimization-service';
import { emitGrowthEvent } from '@/domains/platform-growth/growth.events';
import { useAuth } from '@/contexts/AuthContext';
import { HeroSection } from './HeroSection';
import { FABSection } from './FABSection';
import { PricingSection } from './PricingSection';
import { ReferralCTA } from './ReferralCTA';
import { TestimonialsSection } from './TestimonialsSection';
import { FAQSection } from './FAQSection';
import { FooterSection } from './FooterSection';
import { SiteNavbar } from './SiteNavbar';
import { SEOHead } from './SEOHead';
import { LazySection } from './LazySection';

interface LandingPageRendererProps {
  blueprint?: LPCopyBlueprint;
  industry?: string;
  modules?: string[];
  page?: LandingPage;
  referralCode?: string;
}

export function LandingPageRenderer({
  blueprint: externalBlueprint,
  industry = 'default',
  modules = [],
  page,
  referralCode,
}: LandingPageRendererProps) {
  const { user } = useAuth();
  const viewTracked = useRef(false);

  // ── Generate or use provided blueprint ──
  const blueprint = useMemo(() => {
    if (externalBlueprint) return externalBlueprint;
    return fabContentEngine.generateBlueprint(industry, modules);
  }, [externalBlueprint, industry, modules]);

  // ── Resolve referral code ──
  const resolvedRef = referralCode ?? referralTrackingService.extractCodeFromURL() ?? undefined;

  // ── GTM Injection + page_view on mount ──
  useEffect(() => {
    if (viewTracked.current) return;
    viewTracked.current = true;

    // 1. Inject GTM script if container ID configured
    if (page?.gtm_container_id) {
      gtmInjectionService.inject(page.gtm_container_id);
      emitGrowthEvent({
        type: 'GTMInjected',
        timestamp: Date.now(),
        pageId: page.id,
        pageSlug: page.slug,
        containerId: page.gtm_container_id,
        eventsCount: 5,
        injectedBy: 'renderer',
      });
    }

    // 2. GTM: page_view
    gtmInjectionService.trackPageView({
      page_id: page?.id,
      slug: page?.slug,
      industry,
      referral_code: resolvedRef,
    });

    // 3. Referral attribution
    if (resolvedRef && page) {
      referralTrackingService.trackReferralEvent(page.id, resolvedRef, 'referral_click');
    }

    // 4. Conversion tracking: page_view
    if (page) {
      conversionTrackingService.track({
        landingPageId: page.id,
        type: 'signup',
        source: detectSource(),
        referralCode: resolvedRef ?? page.referral_program_id ?? undefined,
        metadata: { event: 'page_view', url: window.location.href },
      });
    }
  }, [page, resolvedRef, industry]);

  // ── GTM: cta_click handler ──
  const handleCTAClick = (section: string, ctaText?: string) => {
    gtmInjectionService.trackCTAClick({
      page_id: page?.id,
      section,
      cta_text: ctaText,
    });

    if (page) {
      conversionTrackingService.track({
        landingPageId: page.id,
        type: 'signup',
        source: detectSource(),
        referralCode: resolvedRef,
        metadata: { event: 'cta_click', section },
      });
    }
  };

  // ── GTM: trial_start handler ──
  const handleTrialStart = (planName?: string) => {
    gtmInjectionService.trackTrialStart({
      page_id: page?.id,
      plan_name: planName,
      source: detectSource(),
    });

    if (page) {
      conversionTrackingService.track({
        landingPageId: page.id,
        type: 'trial_start',
        source: detectSource(),
        referralCode: resolvedRef,
        metadata: { event: 'trial_start', plan: planName },
      });
    }
  };

  // ── GTM: plan_selected handler ──
  const handlePlanSelected = (planName: string, planPrice?: string) => {
    gtmInjectionService.trackPlanSelected({
      page_id: page?.id,
      plan_name: planName,
      plan_price: planPrice,
    });

    if (page) {
      conversionTrackingService.track({
        landingPageId: page.id,
        type: 'plan_selected',
        source: detectSource(),
        referralCode: resolvedRef,
        metadata: { event: 'plan_selected', plan: planName, price: planPrice },
      });
    }
  };

  // ── GTM: referral_signup handler ──
  const handleReferralAction = (action: 'share' | 'signup' | 'click') => {
    gtmInjectionService.trackReferralSignup({
      page_id: page?.id,
      referral_code: resolvedRef,
      action,
    });

    if (page) {
      conversionTrackingService.track({
        landingPageId: page.id,
        type: 'referral_click',
        source: detectSource(),
        referralCode: resolvedRef,
        metadata: { event: 'referral_signup', action },
      });
    }
  };

  // ── SEO meta + JSON-LD ──
  const baseUrl = window.location.origin;
  const seoMeta = useMemo(() => {
    if (!page) return null;
    const metaTags = seoOptimizationService.generateMetaTags(page, blueprint, baseUrl);
    const jsonLd = seoOptimizationService.generateJsonLd(page, blueprint, baseUrl);
    return { metaTags, jsonLd };
  }, [page, blueprint, baseUrl]);

  return (
    <div className="min-h-screen bg-background text-foreground" onClick={captureCtaClicks(handleCTAClick)}>
      {/* Dynamic SEO head injection */}
      {seoMeta && (
        <SEOHead
          metaTags={seoMeta.metaTags}
          jsonLd={seoMeta.jsonLd}
          preconnectOrigins={['https://fonts.googleapis.com', 'https://fonts.gstatic.com']}
        />
      )}

      <SiteNavbar domain={page?.slug ?? 'default'} />

      {/* 1. Hero — always eager (above the fold) */}
      <HeroSection
        data={blueprint.hero}
        onCTAClick={() => handleTrialStart()}
      />

      {/* 2. FAB — lazy */}
      <LazySection minHeight="400px">
        <FABSection
          features={blueprint.features}
          advantages={blueprint.advantages}
          benefits={blueprint.benefits}
        />
      </LazySection>

      {/* 3. Pricing — lazy */}
      <LazySection minHeight="350px">
        <PricingSection
          onPlanSelect={handlePlanSelected}
          onTrialStart={handleTrialStart}
        />
      </LazySection>

      {/* 4. Referral CTA — lazy */}
      <LazySection minHeight="200px">
        <ReferralCTA
          referralCode={resolvedRef}
          onReferralAction={handleReferralAction}
        />
      </LazySection>

      {/* 5. Testimonials — lazy */}
      <LazySection minHeight="300px">
        <TestimonialsSection data={blueprint.proof} />
      </LazySection>

      {/* 6. FAQ — lazy */}
      <LazySection minHeight="300px">
        <FAQSection />
      </LazySection>

      {/* 7. Footer */}
      <FooterSection cta={blueprint.cta} />
    </div>
  );
}

// ── Utilities ────────────────────────────────────────────────

function detectSource(): string {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  if (utmSource) return utmSource;
  if (document.referrer) {
    try { return new URL(document.referrer).hostname; } catch { return 'direct'; }
  }
  return 'direct';
}

function captureCtaClicks(handler: (section: string, ctaText?: string) => void) {
  return (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('button, a');
    if (!target) return;
    const section = target.closest('section, footer');
    if (section) {
      const heading = section.querySelector('h1, h2');
      handler(heading?.textContent ?? 'unknown', target.textContent?.trim());
    }
  };
}
