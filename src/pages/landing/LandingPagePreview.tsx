/**
 * LandingPagePreview — Public route to render a landing page by slug.
 * URL: /lp/:slug  or  /lp/preview?industry=tech&modules=folha,compliance
 *
 * SECURITY: This page runs through the PublicAPI Gateway.
 * It NEVER accesses platform APIs directly.
 */
import { useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LandingPageRenderer } from '@/components/landing/LandingPageRenderer';
import { publicAPIGateway } from '@/domains/platform-growth/public-api-gateway';
import type { LandingPage } from '@/domains/platform-growth/types';

/** Generate a simple browser fingerprint for rate limiting */
function getFingerprint(): string {
  const nav = navigator;
  const raw = `${nav.userAgent}|${nav.language}|${screen.width}x${screen.height}|${new Date().getTimezoneOffset()}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `fp-${Math.abs(hash).toString(36)}`;
}

export default function LandingPagePreview() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState<LandingPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const industry = searchParams.get('industry') ?? 'default';
  const modules = searchParams.get('modules')?.split(',').filter(Boolean) ?? [];
  const referralCode = searchParams.get('ref') ?? undefined;

  useEffect(() => {
    if (!slug || slug === 'preview') return;

    const fingerprint = getFingerprint();

    publicAPIGateway.process<{
      id: string;
      name: string;
      slug: string;
      blocks: LandingPage['blocks'];
      gtm_container_id?: string;
      published_at?: string;
    }>({
      endpoint: 'landing-page',
      method: 'GET',
      params: { slug },
      fingerprint,
    }).then(response => {
      if (response.success && response.data) {
        // Map public API response to LandingPage shape (minimal, safe)
        setPage({
          id: response.data.id,
          name: response.data.name,
          slug: response.data.slug,
          status: 'published',
          blocks: response.data.blocks,
          gtm_container_id: response.data.gtm_container_id ?? null,
          analytics: { views: 0, uniqueVisitors: 0, conversions: 0, conversionRate: 0, avgTimeOnPage: 0, bounceRate: 0, topSources: [] },
          created_at: '',
          updated_at: '',
          published_at: response.data.published_at ?? null,
        });
      } else {
        setError(response.error?.message ?? 'Página não encontrada.');
      }
    });
  }, [slug]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Página não encontrada</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <LandingPageRenderer
      page={page ?? undefined}
      industry={industry}
      modules={modules}
      referralCode={referralCode}
    />
  );
}
