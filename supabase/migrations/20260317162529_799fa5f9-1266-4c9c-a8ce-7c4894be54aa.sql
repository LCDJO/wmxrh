
-- Fix #4: Rename misleading column to remove false sense of encryption
ALTER TABLE public.telegram_bot_configs
  RENAME COLUMN bot_token_encrypted TO bot_token;

-- Fix #6: Set search_path on user_sessions_update_geo_point
CREATE OR REPLACE FUNCTION public.user_sessions_update_geo_point()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geo_point := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  END IF;
  RETURN NEW;
END;
$$;
