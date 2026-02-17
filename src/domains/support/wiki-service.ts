import { supabase } from '@/integrations/supabase/client';
import type { WikiArticle, WikiCategory } from './types';

export const WikiService = {
  // Categories
  async listCategories(): Promise<WikiCategory[]> {
    const { data, error } = await supabase
      .from('support_wiki_categories')
      .select('*')
      .order('sort_order');
    if (error) throw error;
    return (data ?? []) as unknown as WikiCategory[];
  },

  async createCategory(cat: Pick<WikiCategory, 'name' | 'slug' | 'description' | 'icon'>): Promise<WikiCategory> {
    const { data, error } = await supabase
      .from('support_wiki_categories')
      .insert(cat)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as WikiCategory;
  },

  // Articles
  async listPublished(): Promise<WikiArticle[]> {
    const { data, error } = await supabase
      .from('support_wiki_articles')
      .select('*, support_wiki_categories(*)')
      .eq('is_published', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as WikiArticle[];
  },

  async listAll(): Promise<WikiArticle[]> {
    const { data, error } = await supabase
      .from('support_wiki_articles')
      .select('*, support_wiki_categories(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as WikiArticle[];
  },

  async getBySlug(slug: string): Promise<WikiArticle | null> {
    const { data, error } = await supabase
      .from('support_wiki_articles')
      .select('*, support_wiki_categories(*)')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as WikiArticle | null;
  },

  async create(article: Partial<WikiArticle> & { title: string; slug: string }): Promise<WikiArticle> {
    const { data, error } = await supabase
      .from('support_wiki_articles')
      .insert(article)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as WikiArticle;
  },

  async update(id: string, updates: Partial<WikiArticle>): Promise<void> {
    const { error } = await supabase
      .from('support_wiki_articles')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  },

  async incrementViewCount(id: string): Promise<void> {
    // Use RPC or raw update
    const { error } = await supabase.rpc('increment_article_views' as never, { article_id: id } as never);
    if (error) {
      // fallback: direct update (less atomic)
      const { data } = await supabase.from('support_wiki_articles').select('view_count').eq('id', id).single();
      if (data) {
        await supabase.from('support_wiki_articles').update({ view_count: ((data as any).view_count ?? 0) + 1 }).eq('id', id);
      }
    }
  },
};
