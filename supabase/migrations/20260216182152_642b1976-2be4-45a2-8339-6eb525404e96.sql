
-- NR Training Catalog
CREATE TABLE public.nr_training_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nr_codigo INTEGER NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  obrigatoria_para_grau_risco INTEGER[] NOT NULL DEFAULT '{1,2,3,4}',
  periodicidade TEXT NOT NULL DEFAULT 'admissional',
  carga_horaria INTEGER NOT NULL DEFAULT 2,
  validade_meses INTEGER,
  base_legal TEXT,
  target_cbos TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, nr_codigo, nome)
);

CREATE INDEX idx_nr_training_catalog_tenant ON public.nr_training_catalog(tenant_id);
CREATE INDEX idx_nr_training_catalog_nr ON public.nr_training_catalog(nr_codigo);

ALTER TABLE public.nr_training_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view NR training catalog"
  ON public.nr_training_catalog FOR SELECT
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert NR training catalog"
  ON public.nr_training_catalog FOR INSERT
  WITH CHECK (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can update NR training catalog"
  ON public.nr_training_catalog FOR UPDATE
  USING (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can delete NR training catalog"
  ON public.nr_training_catalog FOR DELETE
  USING (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_nr_training_catalog_updated_at
  BEFORE UPDATE ON public.nr_training_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Training Requirements (company + CBO specific)
CREATE TABLE public.training_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_group_id UUID REFERENCES public.company_groups(id),
  catalog_item_id UUID NOT NULL REFERENCES public.nr_training_catalog(id) ON DELETE CASCADE,
  cbo_codigo TEXT NOT NULL,
  nr_codigo INTEGER NOT NULL,
  obrigatorio BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'engine',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(tenant_id, company_id, cbo_codigo, catalog_item_id)
);

CREATE INDEX idx_training_requirements_tenant ON public.training_requirements(tenant_id);
CREATE INDEX idx_training_requirements_company ON public.training_requirements(company_id);
CREATE INDEX idx_training_requirements_cbo ON public.training_requirements(cbo_codigo);

ALTER TABLE public.training_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view training requirements"
  ON public.training_requirements FOR SELECT
  USING (user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert training requirements"
  ON public.training_requirements FOR INSERT
  WITH CHECK (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can update training requirements"
  ON public.training_requirements FOR UPDATE
  USING (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can delete training requirements"
  ON public.training_requirements FOR DELETE
  USING (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_training_requirements_updated_at
  BEFORE UPDATE ON public.training_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default NR training catalog per tenant
CREATE OR REPLACE FUNCTION public.seed_nr_training_catalog(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.nr_training_catalog (tenant_id, nr_codigo, nome, descricao, obrigatoria_para_grau_risco, periodicidade, carga_horaria, validade_meses, base_legal, target_cbos, is_system)
  VALUES
    (_tenant_id, 1,  'Treinamento sobre GRO/PGR',               'Programa de Gerenciamento de Riscos', '{1,2,3,4}', 'admissional', 2,  NULL, 'NR-1, item 1.7.1', '{}', true),
    (_tenant_id, 5,  'Treinamento de CIPA',                     'Comissão Interna de Prevenção de Acidentes', '{1,2,3,4}', 'periodico', 20, 12, 'NR-5, item 5.7.1', '{}', true),
    (_tenant_id, 6,  'Uso correto de EPI',                      'Equipamento de Proteção Individual', '{2,3,4}', 'admissional', 2,  NULL, 'NR-6, item 6.6.1', '{}', true),
    (_tenant_id, 7,  'PCMSO — Saúde Ocupacional',               'Programa de Controle Médico', '{1,2,3,4}', 'admissional', 2, NULL, 'NR-7', '{}', true),
    (_tenant_id, 10, 'NR-10 Básico — Segurança em Eletricidade','Serviços em eletricidade', '{2,3,4}', 'periodico', 40, 24, 'NR-10, item 10.8.8', '{7241-10,7321-05}', true),
    (_tenant_id, 10, 'NR-10 Complementar (SEP)',                'Sistema Elétrico de Potência', '{3,4}', 'periodico', 40, 24, 'NR-10, item 10.8.8.2', '{7241-10}', true),
    (_tenant_id, 11, 'Operação de Empilhadeira',                'Movimentação mecanizada de cargas', '{2,3,4}', 'periodico', 16, 12, 'NR-11, item 11.1.5', '{8610-10}', true),
    (_tenant_id, 12, 'Segurança em Máquinas e Equipamentos',    'Proteção em máquinas industriais', '{3,4}', 'admissional', 8,  NULL, 'NR-12, item 12.16.1', '{7210-05}', true),
    (_tenant_id, 17, 'Ergonomia no Trabalho',                   'Adaptação das condições de trabalho', '{1,2,3,4}', 'admissional', 2, NULL, 'NR-17', '{}', true),
    (_tenant_id, 23, 'Prevenção e Combate a Incêndio',          'Brigada de emergência e evacuação', '{1,2,3,4}', 'periodico', 8, 12, 'NR-23', '{}', true),
    (_tenant_id, 33, 'Trabalhador Autorizado — Espaço Confinado','Entrada em espaços confinados', '{3,4}', 'periodico', 16, 12, 'NR-33, item 33.3.5.4', '{}', true),
    (_tenant_id, 35, 'Trabalho em Altura',                      'Atividades acima de 2 metros', '{3,4}', 'periodico', 8,  24, 'NR-35, item 35.3.2', '{7170-20,7241-10}', true)
  ON CONFLICT (tenant_id, nr_codigo, nome) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_seed_nr_training_catalog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.seed_nr_training_catalog(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_seed_nr_training_catalog
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.auto_seed_nr_training_catalog();
