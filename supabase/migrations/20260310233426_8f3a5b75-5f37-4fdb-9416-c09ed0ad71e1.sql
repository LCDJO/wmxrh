
-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add a PostGIS geometry column to user_sessions for spatial indexing
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS geo_point geometry(Point, 4326);

-- Create trigger to auto-populate geo_point from lat/lng
CREATE OR REPLACE FUNCTION public.user_sessions_update_geo_point()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geo_point := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  ELSE
    NEW.geo_point := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_sessions_geo_point
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.user_sessions_update_geo_point();

-- Spatial index for geo queries (radius search, clustering)
CREATE INDEX IF NOT EXISTS idx_user_sessions_geo ON public.user_sessions USING GIST(geo_point);

-- Function: find sessions within a radius (km)
CREATE OR REPLACE FUNCTION public.sessions_within_radius(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 50
)
RETURNS SETOF public.user_sessions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.user_sessions
  WHERE geo_point IS NOT NULL
    AND ST_DWithin(
      geo_point::geography,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      radius_km * 1000 -- meters
    )
  ORDER BY last_activity DESC
  LIMIT 200;
$$;

-- Function: pg_notify for session events (used by edge function)
CREATE OR REPLACE FUNCTION public.pg_notify_session_event(
  event_type TEXT,
  session_id UUID,
  user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_notify(
    'session_events',
    json_build_object(
      'event', event_type,
      'session_id', session_id,
      'user_id', user_id,
      'timestamp', now()
    )::text
  );
END;
$$;

-- Function: expire stale sessions (can be called by cron)
CREATE OR REPLACE FUNCTION public.expire_stale_sessions(stale_minutes INTEGER DEFAULT 5)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.user_sessions
  SET status = 'expired',
      updated_at = now()
  WHERE status IN ('online', 'idle')
    AND last_activity < now() - (stale_minutes || ' minutes')::interval;
  
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Backfill existing rows with geo_point
UPDATE public.user_sessions
SET geo_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND geo_point IS NULL;
