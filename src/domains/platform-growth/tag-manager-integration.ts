/**
 * TagManagerIntegration — Google Tag Manager bridge for landing pages.
 */
import type { TagManagerConfig, TagManagerEvent } from './types';

export class TagManagerIntegration {
  private configs: Map<string, TagManagerConfig> = new Map();

  configure(pageId: string, containerId: string): TagManagerConfig {
    const config: TagManagerConfig = {
      containerId,
      events: this.getDefaultEvents(),
      isActive: true,
    };
    this.configs.set(pageId, config);
    return config;
  }

  getConfig(pageId: string): TagManagerConfig | undefined {
    return this.configs.get(pageId);
  }

  private getDefaultEvents(): TagManagerEvent[] {
    return [
      { name: 'page_view', trigger: 'on_load', category: 'engagement' },
      { name: 'cta_click', trigger: 'on_click', category: 'conversion', label: 'primary_cta' },
      { name: 'pricing_view', trigger: 'on_scroll', category: 'engagement', label: 'pricing_section' },
      { name: 'signup_start', trigger: 'on_submit', category: 'conversion' },
      { name: 'signup_complete', trigger: 'on_redirect', category: 'conversion' },
      { name: 'referral_click', trigger: 'on_click', category: 'referral', label: 'referral_link' },
    ];
  }

  generateSnippet(containerId: string): string {
    return `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${containerId}');</script>`;
  }
}

export const tagManagerIntegration = new TagManagerIntegration();
