import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BookOpen, Search, ArrowLeft, Loader2, LayoutGrid, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { WikiService } from '@/domains/support/wiki-service';
import type { WikiArticle } from '@/domains/support/types';

const MODULE_LABELS: Record<string, string> = {
  funcionarios: 'Funcionários',
  remuneracao: 'Remuneração',
  beneficios: 'Benefícios',
  saude: 'Saúde',
  trabalhista: 'Trabalhista',
  termos: 'Termos',
  compliance: 'Compliance',
  billing: 'Faturamento',
  iam: 'IAM',
  seguranca: 'Segurança',
  geral: 'Geral',
};

export default function SupportWiki() {
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<WikiArticle | null>(null);

  useEffect(() => {
    WikiService.listPublished()
      .then(setArticles)
      .catch(() => toast.error('Erro ao carregar artigos'))
      .finally(() => setLoading(false));
  }, []);

  // Extract unique modules from articles
  const modules = useMemo(() => {
    const set = new Set<string>();
    articles.forEach(a => {
      if (a.module_reference) set.add(a.module_reference);
    });
    return Array.from(set).sort();
  }, [articles]);

  const filtered = useMemo(() => {
    let result = articles;
    if (selectedModule) {
      result = result.filter(a => a.module_reference === selectedModule);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.content_plain ?? '').toLowerCase().includes(q) ||
        (a.tags ?? []).some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [articles, selectedModule, search]);

  // ── Article detail view ──
  if (selectedArticle) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedArticle(null)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedArticle.module_reference && (
                <Badge variant="outline" className="text-xs">
                  {MODULE_LABELS[selectedArticle.module_reference] ?? selectedArticle.module_reference}
                </Badge>
              )}
              {selectedArticle.support_wiki_categories && (
                <Badge variant="secondary" className="text-xs">{selectedArticle.support_wiki_categories.name}</Badge>
              )}
            </div>
            <CardTitle className="mt-2">{selectedArticle.title}</CardTitle>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3" />
              Atualizado em {new Date(selectedArticle.updated_at).toLocaleDateString('pt-BR')}
            </p>
          </CardHeader>
          <CardContent>
            <SafeHtml
              html={selectedArticle.content_html}
              className="prose prose-sm dark:prose-invert max-w-none"
            />
            {selectedArticle.tags && selectedArticle.tags.length > 0 && (
              <div className="flex gap-1.5 mt-6 flex-wrap border-t pt-4">
                {selectedArticle.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Base de Conhecimento</h1>
          <p className="text-sm text-muted-foreground">Encontre respostas para suas dúvidas</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar artigos por título, conteúdo ou tag..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Module filter pills */}
      {modules.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          <Button
            variant={selectedModule === null ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedModule(null)}
          >
            Todos
          </Button>
          {modules.map(mod => (
            <Button
              key={mod}
              variant={selectedModule === mod ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedModule(mod)}
            >
              {MODULE_LABELS[mod] ?? mod}
            </Button>
          ))}
        </div>
      )}

      {/* Articles */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>{search || selectedModule ? 'Nenhum artigo encontrado para o filtro selecionado.' : 'Nenhum artigo publicado ainda.'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(article => (
            <Card
              key={article.id}
              className="cursor-pointer hover:shadow-sm transition-shadow group"
              onClick={() => {
                setSelectedArticle(article);
                WikiService.incrementViewCount(article.id).catch(() => {});
              }}
            >
              <CardContent className="py-4 px-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {article.title}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {article.module_reference && (
                    <Badge variant="outline" className="text-[10px]">
                      {MODULE_LABELS[article.module_reference] ?? article.module_reference}
                    </Badge>
                  )}
                  {article.support_wiki_categories && (
                    <Badge variant="secondary" className="text-[10px]">{article.support_wiki_categories.name}</Badge>
                  )}
                </div>
                {article.content_plain && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{article.content_plain}</p>
                )}
                <p className="text-[10px] text-muted-foreground/60">
                  {new Date(article.updated_at).toLocaleDateString('pt-BR')}
                  {article.view_count > 0 && ` · ${article.view_count} visualizações`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
