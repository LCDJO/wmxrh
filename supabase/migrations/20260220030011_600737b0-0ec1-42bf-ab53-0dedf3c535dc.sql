
-- ═══════════════════════════════════════════════════════
-- EPI LIFECYCLE & LEGAL COMPLIANCE ENGINE
-- ═══════════════════════════════════════════════════════

-- 1. EPI Catalog (Catálogo de EPIs)
CREATE TABLE public.epi_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'geral',
  ca_numero TEXT, -- Certificado de Aprovação (MTE)
  ca_validade DATE,
  fabricante TEXT,
  modelo TEXT,
  nr_referencia INTEGER, -- NR relacionada (ex: 6)
  validade_meses INTEGER DEFAULT 12,
  requer_treinamento BOOLEAN DEFAULT false,
  nr_treinamento_codigo INTEGER, -- Link para nr_training_catalog
  foto_url TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view EPI catalog"
  ON public.epi_catalog FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage EPI catalog"
  ON public.epi_catalog FOR ALL
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- 2. EPI Deliveries (Fichas de Entrega)
CREATE TABLE public.epi_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  epi_catalog_id UUID NOT NULL REFERENCES public.epi_catalog(id),
  risk_exposure_id UUID REFERENCES public.employee_risk_exposures(id),
  quantidade INTEGER NOT NULL DEFAULT 1,
  motivo TEXT NOT NULL DEFAULT 'entrega_inicial',
  -- motivo: entrega_inicial | substituicao_desgaste | substituicao_dano | substituicao_vencimento | novo_risco
  data_entrega DATE NOT NULL DEFAULT CURRENT_DATE,
  data_validade DATE,
  data_devolucao DATE,
  motivo_devolucao TEXT,
  lote TEXT,
  ca_numero TEXT,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'entregue',
  -- status: entregue | devolvido | vencido | substituido | extraviado
  entregue_por UUID, -- user_id who delivered
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view EPI deliveries"
  ON public.epi_deliveries FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Authorized users can manage EPI deliveries"
  ON public.epi_deliveries FOR INSERT
  WITH CHECK (public.can_manage_employees(auth.uid(), tenant_id));

CREATE POLICY "Authorized users can update EPI deliveries"
  ON public.epi_deliveries FOR UPDATE
  USING (public.can_manage_employees(auth.uid(), tenant_id));

-- Employees can view their own deliveries
CREATE POLICY "Employees can view own EPI deliveries"
  ON public.epi_deliveries FOR SELECT
  USING (public.user_is_employee(auth.uid(), employee_id));

-- 3. EPI Signatures (Assinaturas Digitais — Prova Jurídica)
CREATE TABLE public.epi_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  delivery_id UUID NOT NULL REFERENCES public.epi_deliveries(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  tipo_assinatura TEXT NOT NULL DEFAULT 'digital',
  -- tipo_assinatura: digital | manuscrita_digitalizada | biometrica
  assinatura_hash TEXT, -- SHA-256 hash do conteúdo assinado
  assinatura_data JSONB, -- dados da assinatura (ex: coordenadas do canvas)
  ip_address TEXT,
  user_agent TEXT,
  termo_aceite TEXT NOT NULL DEFAULT 'Declaro ter recebido o EPI acima descrito, em perfeitas condições de uso, e comprometo-me a utilizá-lo corretamente conforme treinamento recebido.',
  assinado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  documento_url TEXT, -- PDF gerado com a ficha assinada
  is_valid BOOLEAN DEFAULT true,
  invalidado_em TIMESTAMPTZ,
  invalidado_por UUID,
  motivo_invalidacao TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view EPI signatures"
  ON public.epi_signatures FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Authorized users can create EPI signatures"
  ON public.epi_signatures FOR INSERT
  WITH CHECK (public.can_manage_employees(auth.uid(), tenant_id) OR public.user_is_employee(auth.uid(), employee_id));

CREATE POLICY "Only admins can update signatures"
  ON public.epi_signatures FOR UPDATE
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- 4. EPI Audit Log (Trilha de Auditoria Legal)
CREATE TABLE public.epi_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  delivery_id UUID REFERENCES public.epi_deliveries(id),
  employee_id UUID REFERENCES public.employees(id),
  action TEXT NOT NULL,
  -- action: entrega | assinatura | substituicao | devolucao | vencimento_detectado | extravio | invalidacao_assinatura
  executor TEXT NOT NULL DEFAULT 'system',
  executor_user_id UUID,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.epi_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view EPI audit log"
  ON public.epi_audit_log FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "System can insert EPI audit log"
  ON public.epi_audit_log FOR INSERT
  WITH CHECK (public.user_has_tenant_access(auth.uid(), tenant_id));

-- 5. EPI-Risk Mapping (Vinculação EPI ↔ Risco Ocupacional)
CREATE TABLE public.epi_risk_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  epi_catalog_id UUID NOT NULL REFERENCES public.epi_catalog(id),
  risk_agent TEXT NOT NULL, -- agente de risco (ex: ruído, poeira, químico)
  nr_aplicavel INTEGER,
  obrigatorio BOOLEAN DEFAULT true,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, epi_catalog_id, risk_agent)
);

ALTER TABLE public.epi_risk_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view EPI risk mappings"
  ON public.epi_risk_mappings FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage EPI risk mappings"
  ON public.epi_risk_mappings FOR ALL
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- 6. Indexes
CREATE INDEX idx_epi_catalog_tenant ON public.epi_catalog(tenant_id);
CREATE INDEX idx_epi_deliveries_tenant ON public.epi_deliveries(tenant_id);
CREATE INDEX idx_epi_deliveries_employee ON public.epi_deliveries(employee_id);
CREATE INDEX idx_epi_deliveries_status ON public.epi_deliveries(status);
CREATE INDEX idx_epi_deliveries_validade ON public.epi_deliveries(data_validade);
CREATE INDEX idx_epi_signatures_delivery ON public.epi_signatures(delivery_id);
CREATE INDEX idx_epi_signatures_employee ON public.epi_signatures(employee_id);
CREATE INDEX idx_epi_audit_tenant ON public.epi_audit_log(tenant_id);
CREATE INDEX idx_epi_risk_mappings_catalog ON public.epi_risk_mappings(epi_catalog_id);

-- 7. Triggers for updated_at
CREATE TRIGGER update_epi_catalog_updated_at BEFORE UPDATE ON public.epi_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_epi_deliveries_updated_at BEFORE UPDATE ON public.epi_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Audit trigger on deliveries
CREATE OR REPLACE FUNCTION public.fn_epi_delivery_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.epi_audit_log (tenant_id, delivery_id, employee_id, action, executor_user_id, details)
    VALUES (NEW.tenant_id, NEW.id, NEW.employee_id, 'entrega', auth.uid(), 'EPI entregue ao colaborador');
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.epi_audit_log (tenant_id, delivery_id, employee_id, action, executor_user_id, details, metadata)
      VALUES (NEW.tenant_id, NEW.id, NEW.employee_id, NEW.status, auth.uid(),
        'Status alterado de ' || OLD.status || ' para ' || NEW.status,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE TRIGGER trg_epi_delivery_audit
  AFTER INSERT OR UPDATE ON public.epi_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.fn_epi_delivery_audit();

-- 9. Audit trigger on signatures
CREATE OR REPLACE FUNCTION public.fn_epi_signature_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.epi_audit_log (tenant_id, delivery_id, employee_id, action, executor_user_id, details, metadata)
  VALUES (NEW.tenant_id, NEW.delivery_id, NEW.employee_id, 'assinatura', auth.uid(),
    'Assinatura digital registrada para entrega de EPI',
    jsonb_build_object('signature_id', NEW.id, 'tipo', NEW.tipo_assinatura, 'hash', NEW.assinatura_hash));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_epi_signature_audit
  AFTER INSERT ON public.epi_signatures
  FOR EACH ROW EXECUTE FUNCTION public.fn_epi_signature_audit();

-- 10. Function to detect expired EPIs
CREATE OR REPLACE FUNCTION public.scan_expired_epis(_tenant_id UUID)
RETURNS TABLE(delivery_id UUID, employee_id UUID, employee_name TEXT, epi_nome TEXT, data_validade DATE, dias_vencido INTEGER)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id AS delivery_id,
    d.employee_id,
    e.name AS employee_name,
    c.nome AS epi_nome,
    d.data_validade,
    (CURRENT_DATE - d.data_validade)::integer AS dias_vencido
  FROM public.epi_deliveries d
  JOIN public.employees e ON e.id = d.employee_id
  JOIN public.epi_catalog c ON c.id = d.epi_catalog_id
  WHERE d.tenant_id = _tenant_id
    AND d.status = 'entregue'
    AND d.data_validade IS NOT NULL
    AND d.data_validade < CURRENT_DATE
  ORDER BY d.data_validade ASC;
END;
$$;
