
-- ══════════════════════════════════════════════════════════
-- DisplayBoard — Adjust live_displays to match new schema
-- ══════════════════════════════════════════════════════════

-- Drop old enum
DROP TYPE IF EXISTS public.display_layout CASCADE;

-- Create new tipo enum
CREATE TYPE public.display_board_tipo AS ENUM ('fleet', 'sst', 'compliance', 'executivo');

-- Alter table to match DisplayBoard spec
ALTER TABLE public.live_displays
  RENAME COLUMN name TO nome;

ALTER TABLE public.live_displays
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS layout,
  ADD COLUMN IF NOT EXISTS tipo public.display_board_tipo NOT NULL DEFAULT 'executivo',
  ADD COLUMN IF NOT EXISTS layout_config JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rotacao_automatica BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intervalo_rotacao INTEGER NOT NULL DEFAULT 30;

-- Rename refresh_interval_seconds to be replaced by intervalo_rotacao (drop old)
ALTER TABLE public.live_displays
  DROP COLUMN IF EXISTS refresh_interval_seconds;
