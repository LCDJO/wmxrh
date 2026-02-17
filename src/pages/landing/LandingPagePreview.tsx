/**
 * LandingPagePreview — Route to preview/render a landing page by slug or industry.
 * URL: /lp/:slug  or  /lp/preview?industry=tech&modules=folha,compliance
 */
import { useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LandingPageRenderer } from '@/components/landing/LandingPageRenderer';
import { landingPageBuilder } from '@/domains/platform-growth/landing-page-builder';
import type { LandingPage } from '@/domains/platform-growth/types';

export default function LandingPagePreview() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState<LandingPage | null>(null);

  const industry = searchParams.get('industry') ?? 'default';
  const modules = searchParams.get('modules')?.split(',').filter(Boolean) ?? [];
  const referralCode = searchParams.get('ref') ?? undefined;

  useEffect(() => {
    if (slug && slug !== 'preview') {
      landingPageBuilder.getAll().then(pages => {
        const found = pages.find(p => p.slug === slug);
        setPage(found ?? null);
      });
    }
  }, [slug]);

  return (
    <LandingPageRenderer
      page={page ?? undefined}
      industry={industry}
      modules={modules}
      referralCode={referralCode}
    />
  );
}
