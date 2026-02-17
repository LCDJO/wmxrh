import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BookOpen, Search, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { WikiService } from '@/domains/support/wiki-service';
import type { WikiArticle } from '@/domains/support/types';

export default function SupportWiki() {
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<WikiArticle | null>(null);

  useEffect(() => {
    WikiService.listPublished()
      .then(setArticles)
      .catch(() => toast.error('Erro ao carregar artigos'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = articles.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.tags ?? []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  if (selectedArticle) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedArticle(null)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>{selectedArticle.title}</CardTitle>
            {selectedArticle.support_wiki_categories && (
              <Badge variant="secondary" className="w-fit">{selectedArticle.support_wiki_categories.name}</Badge>
            )}
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: selectedArticle.content_html }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Base de Conhecimento</h1>
          <p className="text-sm text-muted-foreground">Encontre respostas para suas dúvidas</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar artigo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum artigo encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(article => (
            <Card
              key={article.id}
              className="cursor-pointer hover:shadow-sm transition-shadow"
              onClick={() => {
                setSelectedArticle(article);
                WikiService.incrementViewCount(article.id).catch(() => {});
              }}
            >
              <CardContent className="py-4 px-4">
                <p className="text-sm font-medium text-foreground">{article.title}</p>
                {article.support_wiki_categories && (
                  <p className="text-xs text-muted-foreground mt-1">{article.support_wiki_categories.name}</p>
                )}
                {article.tags && article.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {article.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
