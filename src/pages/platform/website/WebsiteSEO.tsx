/**
 * /platform/website/seo — Full SEO Manager with validation, Schema.org, sitemap preview.
 */
import { useState, useMemo } from 'react';
import { Search, CheckCircle2, AlertTriangle, Globe, Code, FileText, Image, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  validateSEO,
  buildJsonLd,
  buildRobotsTxt,
  buildSitemapXml,
  defaultSEOConfig,
  type SEOConfig,
  type SitemapEntry,
} from '@/domains/website-builder/seo-manager';

const BASE_URL = 'https://plataforma.example.com';

const DEMO_PAGES: { name: string; slug: string }[] = [
  { name: 'Home', slug: '/' },
  { name: 'Funcionalidades', slug: '/funcionalidades' },
  { name: 'Preços', slug: '/precos' },
  { name: 'Contato', slug: '/contato' },
  { name: 'Blog', slug: '/blog' },
];

export default function WebsiteSEO() {
  const [selectedPage, setSelectedPage] = useState(0);
  const page = DEMO_PAGES[selectedPage];

  const [config, setConfig] = useState<SEOConfig>(() => defaultSEOConfig(page.name, page.slug, BASE_URL));

  const issues = useMemo(() => validateSEO(config), [config]);
  const score = Math.max(0, 100 - issues.length * 15);
  const jsonLd = useMemo(() => config.structured_data ? buildJsonLd(config.structured_data, BASE_URL) : null, [config.structured_data]);

  const sitemapEntries: SitemapEntry[] = DEMO_PAGES.map((p) => ({
    loc: p.slug,
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'weekly' as const,
    priority: p.slug === '/' ? 1.0 : 0.8,
  }));

  const handlePageChange = (idx: number) => {
    setSelectedPage(idx);
    const p = DEMO_PAGES[idx];
    setConfig(defaultSEOConfig(p.name, p.slug, BASE_URL));
  };

  const updateField = (field: keyof SEOConfig, value: unknown) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Search className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">SEO Manager</h1>
          <p className="text-sm text-muted-foreground">Título, meta descriptions, Schema.org, sitemap e Open Graph.</p>
        </div>
      </div>

      {/* Page Selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {DEMO_PAGES.map((p, i) => (
          <button
            key={p.slug}
            onClick={() => handlePageChange(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedPage === i
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="meta" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="meta" className="text-xs"><FileText className="h-3.5 w-3.5 mr-1" />Meta</TabsTrigger>
              <TabsTrigger value="schema" className="text-xs"><Code className="h-3.5 w-3.5 mr-1" />Schema</TabsTrigger>
              <TabsTrigger value="sitemap" className="text-xs"><Globe className="h-3.5 w-3.5 mr-1" />Sitemap</TabsTrigger>
              <TabsTrigger value="social" className="text-xs"><Image className="h-3.5 w-3.5 mr-1" />Social</TabsTrigger>
            </TabsList>

            {/* META TAB */}
            <TabsContent value="meta" className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-card/60 p-5 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Título da Página</Label>
                  <Input
                    value={config.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    maxLength={60}
                    className="text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">{config.title.length}/60 caracteres</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Meta Description</Label>
                  <Textarea
                    value={config.meta_description}
                    onChange={(e) => updateField('meta_description', e.target.value)}
                    maxLength={160}
                    rows={3}
                    className="text-sm resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground">{config.meta_description.length}/160 caracteres</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">URL Canônica</Label>
                  <Input
                    value={config.canonical_url ?? ''}
                    onChange={(e) => updateField('canonical_url', e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Indexar no Google</Label>
                  <Switch
                    checked={config.robots?.index ?? true}
                    onCheckedChange={(v) => updateField('robots', { ...config.robots, index: v })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Seguir links</Label>
                  <Switch
                    checked={config.robots?.follow ?? true}
                    onCheckedChange={(v) => updateField('robots', { ...config.robots, follow: v })}
                  />
                </div>

                {/* SERP Preview */}
                <div className="rounded-lg border border-border/40 bg-background p-4 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Pré-visualização no Google</p>
                  <p className="text-sm font-medium text-primary truncate">{config.title || 'Título da página'}</p>
                  <p className="text-xs text-accent truncate">{config.canonical_url || BASE_URL + page.slug}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{config.meta_description || 'Descrição da página...'}</p>
                </div>
              </div>
            </TabsContent>

            {/* SCHEMA TAB */}
            <TabsContent value="schema">
              <div className="rounded-lg border border-border/60 bg-card/60 p-5 space-y-4">
                <p className="text-xs text-muted-foreground">Structured data JSON-LD (Schema.org) gerado automaticamente:</p>
                <ScrollArea className="max-h-80">
                  <pre className="text-[11px] font-mono p-4 rounded-lg bg-background border border-border/40 overflow-x-auto whitespace-pre-wrap text-foreground">
                    {jsonLd ? JSON.stringify(jsonLd, null, 2) : '// Nenhum schema configurado'}
                  </pre>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* SITEMAP TAB */}
            <TabsContent value="sitemap">
              <div className="rounded-lg border border-border/60 bg-card/60 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Sitemap XML com {sitemapEntries.length} páginas</p>
                  <Badge variant="secondary" className="text-[10px]">sitemap.xml</Badge>
                </div>
                <ScrollArea className="max-h-80">
                  <pre className="text-[11px] font-mono p-4 rounded-lg bg-background border border-border/40 overflow-x-auto whitespace-pre-wrap text-foreground">
                    {buildSitemapXml(sitemapEntries, BASE_URL)}
                  </pre>
                </ScrollArea>

                <div className="pt-2 border-t border-border/40">
                  <p className="text-xs text-muted-foreground mb-2">robots.txt</p>
                  <pre className="text-[11px] font-mono p-4 rounded-lg bg-background border border-border/40 whitespace-pre-wrap text-foreground">
                    {buildRobotsTxt(BASE_URL)}
                  </pre>
                </div>
              </div>
            </TabsContent>

            {/* SOCIAL TAB */}
            <TabsContent value="social">
              <div className="rounded-lg border border-border/60 bg-card/60 p-5 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Imagem Open Graph (og:image)</Label>
                  <Input
                    value={config.og_image ?? ''}
                    onChange={(e) => updateField('og_image', e.target.value)}
                    placeholder="https://example.com/og-image.png"
                    className="text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Recomendado: 1200×630px</p>
                </div>

                {config.og_image && (
                  <div className="rounded-lg border border-border/40 bg-background p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Preview Social</p>
                    <div className="rounded-lg border border-border/40 overflow-hidden">
                      <div className="h-40 bg-muted flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-muted-foreground truncate">{BASE_URL}</p>
                        <p className="text-sm font-semibold text-foreground truncate">{config.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{config.meta_description}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Keywords (separadas por vírgula)</Label>
                  <Input
                    value={(config.keywords ?? []).join(', ')}
                    onChange={(e) => updateField('keywords', e.target.value.split(',').map((k: string) => k.trim()).filter(Boolean))}
                    placeholder="rh, gestão de pessoas, folha de pagamento"
                    className="text-sm"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Score & Issues Sidebar */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-card/60 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-14 w-14 items-center justify-center rounded-xl font-bold text-xl ${
                score >= 80 ? 'bg-accent/10 text-accent' : score >= 50 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
              }`}>
                {score}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">SEO Score</p>
                <p className="text-[10px] text-muted-foreground">{page.name} — {page.slug}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-3">
            <p className="text-xs font-bold text-foreground">Checklist</p>
            {issues.length === 0 ? (
              <div className="flex items-center gap-2 text-accent">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">Tudo otimizado!</span>
              </div>
            ) : (
              issues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground">{issue}</p>
                </div>
              ))
            )}
          </div>

          <div className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-2">
            <p className="text-xs font-bold text-foreground">Links Úteis</p>
            {[
              { label: 'Google Search Console', url: '#' },
              { label: 'Teste de Rich Results', url: '#' },
              { label: 'PageSpeed Insights', url: '#' },
            ].map(({ label, url }) => (
              <a key={label} href={url} className="flex items-center gap-1.5 text-[11px] text-primary hover:underline">
                <ExternalLink className="h-3 w-3" />{label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
