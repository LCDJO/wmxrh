/**
 * SEOHead — Injects dynamic meta tags, JSON-LD, and preload hints into <head>.
 * Cleans up on unmount so SPA navigation doesn't leave stale tags.
 */
import { useEffect } from 'react';
import type { MetaTags } from '@/domains/platform-growth/seo-optimization-service';

interface SEOHeadProps {
  metaTags: MetaTags;
  jsonLd: Record<string, unknown>;
  /** Preconnect origins for CDN-ready performance */
  preconnectOrigins?: string[];
}

const TAG_MARKER = 'data-seo-head';

export function SEOHead({ metaTags, jsonLd, preconnectOrigins = [] }: SEOHeadProps) {
  useEffect(() => {
    const created: HTMLElement[] = [];

    const set = (tag: string, attrs: Record<string, string>) => {
      const el = document.createElement(tag);
      el.setAttribute(TAG_MARKER, 'true');
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.head.appendChild(el);
      created.push(el);
    };

    // Clean previous injections
    document.querySelectorAll(`[${TAG_MARKER}]`).forEach(el => el.remove());

    // Title
    document.title = metaTags.title;

    // Standard meta
    set('meta', { name: 'description', content: metaTags.description });
    set('meta', { name: 'robots', content: metaTags.robots });
    set('link', { rel: 'canonical', href: metaTags.canonical });

    // Open Graph
    set('meta', { property: 'og:title', content: metaTags.ogTitle });
    set('meta', { property: 'og:description', content: metaTags.ogDescription });
    set('meta', { property: 'og:image', content: metaTags.ogImage });
    set('meta', { property: 'og:type', content: metaTags.ogType });
    set('meta', { property: 'og:url', content: metaTags.canonical });

    // Twitter Card
    set('meta', { name: 'twitter:card', content: metaTags.twitterCard });
    set('meta', { name: 'twitter:title', content: metaTags.ogTitle });
    set('meta', { name: 'twitter:description', content: metaTags.ogDescription });
    set('meta', { name: 'twitter:image', content: metaTags.ogImage });

    // JSON-LD
    const script = document.createElement('script');
    script.setAttribute(TAG_MARKER, 'true');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    created.push(script);

    // Preconnect hints (CDN-ready)
    preconnectOrigins.forEach(origin => {
      set('link', { rel: 'preconnect', href: origin, crossorigin: '' });
      set('link', { rel: 'dns-prefetch', href: origin });
    });

    return () => {
      created.forEach(el => el.remove());
    };
  }, [metaTags, jsonLd, preconnectOrigins]);

  return null;
}
