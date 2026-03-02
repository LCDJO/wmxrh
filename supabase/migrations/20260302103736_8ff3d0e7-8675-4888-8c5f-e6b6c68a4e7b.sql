
-- Add tolerance_meters to worktime_geofences
ALTER TABLE public.worktime_geofences
  ADD COLUMN IF NOT EXISTS tolerance_meters integer NOT NULL DEFAULT 50;

-- Add enforcement_mode: 'block' rejects entry, 'flag' marks as flagged
ALTER TABLE public.worktime_geofences
  ADD COLUMN IF NOT EXISTS enforcement_mode text NOT NULL DEFAULT 'flag'
  CONSTRAINT chk_enforcement_mode CHECK (enforcement_mode IN ('block', 'flag'));
