
-- ══════════════════════════════════════════════════════════════
-- Customer Support Module — Database Schema
-- ══════════════════════════════════════════════════════════════

-- Enums
CREATE TYPE public.support_ticket_status AS ENUM (
  'open', 'awaiting_agent', 'awaiting_customer', 'in_progress', 'resolved', 'closed', 'cancelled'
);

CREATE TYPE public.support_ticket_priority AS ENUM (
  'low', 'medium', 'high', 'urgent'
);

CREATE TYPE public.support_ticket_category AS ENUM (
  'billing', 'technical', 'feature_request', 'bug_report', 'account', 'general'
);

CREATE TYPE public.support_sender_type AS ENUM ('tenant_user', 'platform_agent', 'system');

-- ── Support Tickets ──────────────────────────────────────────
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_by UUID NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority support_ticket_priority NOT NULL DEFAULT 'medium',
  status support_ticket_status NOT NULL DEFAULT 'open',
  category support_ticket_category NOT NULL DEFAULT 'general',
  assigned_to UUID REFERENCES public.platform_users(id),
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Tenant users see their own tenant's tickets
CREATE POLICY "Tenant members can view their tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

-- Tenant users can create tickets
CREATE POLICY "Tenant members can create tickets"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_member(auth.uid(), tenant_id)
    AND created_by = auth.uid()
  );

-- Tenant users can update their own tickets (e.g. close)
CREATE POLICY "Tenant members can update their tickets"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

-- Platform users can see all tickets
CREATE POLICY "Platform users can view all tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (public.is_active_platform_user(auth.uid()));

-- Platform users can update any ticket
CREATE POLICY "Platform users can update all tickets"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.is_active_platform_user(auth.uid()));

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Ticket Messages ──────────────────────────────────────────
CREATE TABLE public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type support_sender_type NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Tenant users see non-internal messages of their tickets
CREATE POLICY "Tenant members can view ticket messages"
  ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND public.is_tenant_member(auth.uid(), t.tenant_id)
    )
  );

-- Tenant users can send messages
CREATE POLICY "Tenant members can send messages"
  ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_type = 'tenant_user'
    AND is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND public.is_tenant_member(auth.uid(), t.tenant_id)
    )
  );

-- Platform users see all messages (including internal)
CREATE POLICY "Platform users can view all messages"
  ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (public.is_active_platform_user(auth.uid()));

-- Platform users can send messages
CREATE POLICY "Platform users can send messages"
  ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_platform_user(auth.uid())
    AND sender_id = auth.uid()
  );

-- ── Support Wiki Categories ─────────────────────────────────
CREATE TABLE public.support_wiki_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'BookOpen',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_wiki_categories ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read wiki categories
CREATE POLICY "Anyone can view wiki categories"
  ON public.support_wiki_categories FOR SELECT TO authenticated
  USING (is_active = true);

-- Only platform users can manage
CREATE POLICY "Platform users can manage wiki categories"
  ON public.support_wiki_categories FOR ALL TO authenticated
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));

CREATE TRIGGER update_wiki_categories_updated_at
  BEFORE UPDATE ON public.support_wiki_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Support Wiki Articles ───────────────────────────────────
CREATE TABLE public.support_wiki_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.support_wiki_categories(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content_html TEXT NOT NULL DEFAULT '',
  content_plain TEXT,
  tags TEXT[] DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  view_count INT NOT NULL DEFAULT 0,
  helpful_count INT NOT NULL DEFAULT 0,
  not_helpful_count INT NOT NULL DEFAULT 0,
  author_id UUID,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_wiki_articles ENABLE ROW LEVEL SECURITY;

-- Anyone can read published articles
CREATE POLICY "Anyone can view published wiki articles"
  ON public.support_wiki_articles FOR SELECT TO authenticated
  USING (is_published = true);

-- Platform users can see all (including drafts)
CREATE POLICY "Platform users can view all articles"
  ON public.support_wiki_articles FOR SELECT TO authenticated
  USING (public.is_active_platform_user(auth.uid()));

-- Platform users can manage articles
CREATE POLICY "Platform users can manage wiki articles"
  ON public.support_wiki_articles FOR INSERT TO authenticated
  WITH CHECK (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can update wiki articles"
  ON public.support_wiki_articles FOR UPDATE TO authenticated
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can delete wiki articles"
  ON public.support_wiki_articles FOR DELETE TO authenticated
  USING (public.is_active_platform_user(auth.uid()));

CREATE TRIGGER update_wiki_articles_updated_at
  BEFORE UPDATE ON public.support_wiki_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Support Evaluations (Agent Rating) ──────────────────────
CREATE TABLE public.support_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE UNIQUE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  evaluator_id UUID NOT NULL,
  agent_id UUID REFERENCES public.platform_users(id),
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can create evaluations"
  ON public.support_evaluations FOR INSERT TO authenticated
  WITH CHECK (
    evaluator_id = auth.uid()
    AND public.is_tenant_member(auth.uid(), tenant_id)
  );

CREATE POLICY "Tenant members can view their evaluations"
  ON public.support_evaluations FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Platform users can view all evaluations"
  ON public.support_evaluations FOR SELECT TO authenticated
  USING (public.is_active_platform_user(auth.uid()));

-- ── System Satisfaction Surveys ─────────────────────────────
CREATE TABLE public.support_system_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_system_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create system ratings"
  ON public.support_system_ratings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Users can view their own ratings"
  ON public.support_system_ratings FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Platform users can view all ratings"
  ON public.support_system_ratings FOR SELECT TO authenticated
  USING (public.is_active_platform_user(auth.uid()));

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_support_tickets_tenant ON public.support_tickets(tenant_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_assigned ON public.support_tickets(assigned_to);
CREATE INDEX idx_support_tickets_created ON public.support_tickets(created_at DESC);
CREATE INDEX idx_ticket_messages_ticket ON public.support_ticket_messages(ticket_id);
CREATE INDEX idx_wiki_articles_category ON public.support_wiki_articles(category_id);
CREATE INDEX idx_wiki_articles_slug ON public.support_wiki_articles(slug);
CREATE INDEX idx_support_evaluations_agent ON public.support_evaluations(agent_id);
CREATE INDEX idx_system_ratings_tenant ON public.support_system_ratings(tenant_id);

-- ── Enable Realtime for ticket messages ─────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
