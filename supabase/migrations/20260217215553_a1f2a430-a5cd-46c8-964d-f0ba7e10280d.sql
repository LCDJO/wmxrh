-- Add module_reference column to support_wiki_articles
ALTER TABLE public.support_wiki_articles 
ADD COLUMN module_reference text DEFAULT null;

-- Create index for module filtering
CREATE INDEX idx_wiki_articles_module ON public.support_wiki_articles (module_reference) WHERE module_reference IS NOT NULL;