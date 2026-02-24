
-- 1. Add new enum values to offboarding_type
ALTER TYPE offboarding_type ADD VALUE IF NOT EXISTS 'termino_contrato';

-- 2. Add new enum values to offboarding_status
ALTER TYPE offboarding_status ADD VALUE IF NOT EXISTS 'validation';
ALTER TYPE offboarding_status ADD VALUE IF NOT EXISTS 'documents_pending';
ALTER TYPE offboarding_status ADD VALUE IF NOT EXISTS 'esocial_pending';
ALTER TYPE offboarding_status ADD VALUE IF NOT EXISTS 'archived';

-- 3. Add 'motivo' column
ALTER TABLE public.offboarding_workflows ADD COLUMN IF NOT EXISTS motivo text;

-- 4. Rename date fields
ALTER TABLE public.offboarding_workflows RENAME COLUMN notification_date TO data_aviso_previo;
ALTER TABLE public.offboarding_workflows RENAME COLUMN effective_date TO data_desligamento;

-- 5. Migrate existing data
UPDATE public.offboarding_workflows SET motivo = justa_causa_motivo WHERE justa_causa_motivo IS NOT NULL AND motivo IS NULL;
