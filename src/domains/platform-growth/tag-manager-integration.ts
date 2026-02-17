/**
 * GTMInjectionService (TagManagerIntegration) — Google Tag Manager bridge.
 *
 * Responsibilities:
 *  1. Inject GTM <script> in <head> (once per container)
 *  2. Expose pushEvent() for automatic event tracking
 *  3. Register 5 automatic events:
 *     - page_view       → on page load
 *     - cta_click       → on CTA button clicks
 *     - trial_start     → on free trial signup
 *     - plan_selected   → on pricing plan selection
 *     - referral_signup → on referral link share / signup
 *
 * Usage:
 *   gtmInjectionService.inject('GTM-XXXXXX');
 *   gtmInjectionService.pushEvent('cta_click', { section: 'hero' });
 */
import type { TagManagerConfig, TagManagerEvent } from './types';

// ── DataLayer global declaration ─────────────────────────────
declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

// ── Automatic Event Definitions ──────────────────────────────

export type GTMAutoEvent =
  | 'page_view'
  | 'cta_click'
  | 'trial_start'
  | 'plan_selected'
  | 'referral_signup';

const AUTO_EVENTS: TagManagerEvent[] = [
  { name: 'page_view',       trigger: 'on_load',   category: 'engagement',  label: 'landing_page' },
  { name: 'cta_click',       trigger: 'on_click',  category: 'conversion',  label: 'primary_cta' },
  { name: 'trial_start',     trigger: 'on_submit', category: 'conversion',  label: 'free_trial' },
  { name: 'plan_selected',   trigger: 'on_click',  category: 'conversion',  label: 'pricing_plan' },
  { name: 'referral_signup', trigger: 'on_click',  category: 'acquisition', label: 'referral_program' },
];

// ── Service ──────────────────────────────────────────────────

export class TagManagerIntegration {
  private configs: Map<string, TagManagerConfig> = new Map();
  private injectedContainers: Set<string> = new Set();

  /** Configure GTM for a specific page */
  configure(pageId: string, containerId: string): TagManagerConfig {
    const config: TagManagerConfig = {
      containerId,
      events: AUTO_EVENTS,
      isActive: true,
    };
    this.configs.set(pageId, config);
    return config;
  }

  /** Get config for a page */
  getConfig(pageId: string): TagManagerConfig | undefined {
    return this.configs.get(pageId);
  }

  /** Get the 5 automatic event definitions */
  getAutoEvents(): TagManagerEvent[] {
    return AUTO_EVENTS;
  }

  // ── Injection ─────────────────────────────────────────────

  /**
   * Inject the GTM script tag into <head>. Idempotent per container ID.
   * Also injects the noscript iframe into <body>.
   */
  inject(containerId: string): void {
    if (!containerId || this.injectedContainers.has(containerId)) return;
    if (typeof document === 'undefined') return;

    // Already in DOM check
    if (document.querySelector(`script[data-gtm="${containerId}"]`)) {
      this.injectedContainers.add(containerId);
      return;
    }

    // Main script
    const script = document.createElement('script');
    script.setAttribute('data-gtm', containerId);
    script.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${containerId}');`;
    document.head.appendChild(script);

    // noscript fallback
    const noscript = document.createElement('noscript');
    noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${containerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    document.body.insertBefore(noscript, document.body.firstChild);

    this.injectedContainers.add(containerId);
    console.info(`[GTM] Injected container: ${containerId}`);
  }

  // ── Event Pushing ─────────────────────────────────────────

  /**
   * Push a custom event to the GTM dataLayer.
   * Automatically initializes dataLayer if needed.
   */
  pushEvent(event: GTMAutoEvent | string, params: Record<string, unknown> = {}): void {
    if (typeof window === 'undefined') return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...params });
  }

  /**
   * Push page_view event with standard params.
   */
  trackPageView(params: {
    page_id?: string;
    slug?: string;
    industry?: string;
    referral_code?: string;
    url?: string;
  }): void {
    this.pushEvent('page_view', {
      page_id: params.page_id,
      page_slug: params.slug,
      page_industry: params.industry,
      referral_code: params.referral_code,
      page_url: params.url ?? (typeof window !== 'undefined' ? window.location.href : ''),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Push cta_click event.
   */
  trackCTAClick(params: {
    page_id?: string;
    section: string;
    cta_text?: string;
  }): void {
    this.pushEvent('cta_click', {
      page_id: params.page_id,
      section: params.section,
      cta_text: params.cta_text,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Push trial_start event.
   */
  trackTrialStart(params: {
    page_id?: string;
    plan_name?: string;
    source?: string;
  }): void {
    this.pushEvent('trial_start', {
      page_id: params.page_id,
      plan_name: params.plan_name,
      source: params.source,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Push plan_selected event.
   */
  trackPlanSelected(params: {
    page_id?: string;
    plan_name: string;
    plan_price?: string;
    billing_period?: string;
  }): void {
    this.pushEvent('plan_selected', {
      page_id: params.page_id,
      plan_name: params.plan_name,
      plan_price: params.plan_price,
      billing_period: params.billing_period,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Push referral_signup event.
   */
  trackReferralSignup(params: {
    page_id?: string;
    referral_code?: string;
    action: 'share' | 'signup' | 'click';
  }): void {
    this.pushEvent('referral_signup', {
      page_id: params.page_id,
      referral_code: params.referral_code,
      referral_action: params.action,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Legacy: generate raw snippet string ───────────────────

  generateSnippet(containerId: string): string {
    return `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${containerId}');</script>
<!-- End Google Tag Manager -->

<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${containerId}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;
  }
}

export const tagManagerIntegration = new TagManagerIntegration();

/** Convenience alias */
export const gtmInjectionService = tagManagerIntegration;
