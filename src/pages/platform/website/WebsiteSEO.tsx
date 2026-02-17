/**
 * /platform/website/seo — SEO management for website pages.
 */
import { Search } from 'lucide-react';

export default function WebsiteSEO() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Search className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">SEO Manager</h1>
          <p className="text-sm text-muted-foreground">Título, meta descriptions, Schema.org, sitemap e Open Graph para cada página.</p>
        </div>
      </div>
      <div className="rounded-lg border border-border/60 bg-card/60 p-8 text-center">
        <p className="text-sm text-muted-foreground">SEO Manager em desenvolvimento.</p>
      </div>
    </div>
  );
}
