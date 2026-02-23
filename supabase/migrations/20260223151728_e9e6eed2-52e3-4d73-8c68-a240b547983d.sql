
-- ══════════════════════════════════════════════════════════
-- Extend employee_contracts with missing contract data fields
-- ══════════════════════════════════════════════════════════

-- Enum: tipo_salario
CREATE TYPE public.tipo_salario AS ENUM ('mensalista', 'horista');

-- Enum: forma_pagamento
CREATE TYPE public.forma_pagamento AS ENUM ('deposito_bancario', 'pix', 'cheque', 'dinheiro');

-- Enum: jornada_tipo
CREATE TYPE public.jornada_tipo AS ENUM ('integral', 'parcial', 'escala', '12x36', 'flexivel');

ALTER TABLE public.employee_contracts
  ADD COLUMN departamento TEXT,
  ADD COLUMN salario_base NUMERIC(12,2),
  ADD COLUMN tipo_salario public.tipo_salario DEFAULT 'mensalista',
  ADD COLUMN forma_pagamento public.forma_pagamento DEFAULT 'deposito_bancario',
  ADD COLUMN jornada_tipo public.jornada_tipo DEFAULT 'integral',
  ADD COLUMN indicativo_inss BOOLEAN NOT NULL DEFAULT true;
