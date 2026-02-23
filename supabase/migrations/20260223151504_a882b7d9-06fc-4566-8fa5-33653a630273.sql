
-- ══════════════════════════════════════════════════════════
-- Add document fields to employee_personal_data
-- RG, CNH, Passaporte, RNE/RNM
-- ══════════════════════════════════════════════════════════

ALTER TABLE public.employee_personal_data
  ADD COLUMN rg_numero TEXT,
  ADD COLUMN rg_orgao_emissor TEXT,
  ADD COLUMN rg_uf TEXT,
  ADD COLUMN rg_data_emissao DATE,
  ADD COLUMN cnh_numero TEXT,
  ADD COLUMN cnh_categoria TEXT,
  ADD COLUMN cnh_validade DATE,
  ADD COLUMN passaporte TEXT,
  ADD COLUMN rne_rnm TEXT;
