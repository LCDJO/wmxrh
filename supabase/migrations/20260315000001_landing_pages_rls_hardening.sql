-- ══════════════════════════════════════════════════════════════
-- Landing Pages — RLS Hardening
--
-- Problema: as políticas anteriores permitiam que QUALQUER usuário
-- autenticado (inclusive tenants) criasse, editasse e deletasse
-- landing pages. Isso expõe dados e abre brecha para manipulação
-- de páginas por usuários sem papel de plataforma.
--
-- Solução:
--   SELECT → páginas publicadas são públicas (leitura anon OK)
--            plataforma pode ver todas
--   INSERT → apenas platform users (is_active_platform_user)
--   UPDATE → apenas platform users
--   DELETE → apenas platform users
-- ══════════════════════════════════════════════════════════════

-- Remover políticas permissivas anteriores
DROP POLICY IF EXISTS "Authenticated users can view landing pages"   ON public.landing_pages;
DROP POLICY IF EXISTS "Authenticated users can create landing pages"  ON public.landing_pages;
DROP POLICY IF EXISTS "Authenticated users can update landing pages"  ON public.landing_pages;
DROP POLICY IF EXISTS "Authenticated users can delete landing pages"  ON public.landing_pages;

-- ── SELECT ────────────────────────────────────────────────────────
-- Qualquer pessoa (inclusive anon) pode ler páginas publicadas.
-- Isso é necessário pois Landing.tsx (página pública /) busca
-- a home pelo slug sem autenticação de plataforma.
CREATE POLICY "landing_pages_select_public_or_platform"
  ON public.landing_pages FOR SELECT
  USING (
    status = 'published'
    OR public.is_active_platform_user(auth.uid())
  );

-- ── INSERT ────────────────────────────────────────────────────────
CREATE POLICY "landing_pages_insert_platform_only"
  ON public.landing_pages FOR INSERT
  WITH CHECK (
    public.is_active_platform_user(auth.uid())
  );

-- ── UPDATE ────────────────────────────────────────────────────────
CREATE POLICY "landing_pages_update_platform_only"
  ON public.landing_pages FOR UPDATE
  USING (
    public.is_active_platform_user(auth.uid())
  );

-- ── DELETE ────────────────────────────────────────────────────────
CREATE POLICY "landing_pages_delete_platform_only"
  ON public.landing_pages FOR DELETE
  USING (
    public.is_active_platform_user(auth.uid())
  );
