
-- Risk heatmap grid aggregation function
-- Divides a bounding box into grid cells and computes risk intensity per cell
CREATE OR REPLACE FUNCTION public.compute_risk_heatmap(
  p_tenant_id uuid,
  p_lat_min double precision DEFAULT -90,
  p_lat_max double precision DEFAULT 90,
  p_lng_min double precision DEFAULT -180,
  p_lng_max double precision DEFAULT 180,
  p_grid_size integer DEFAULT 20,
  p_days_back integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  lat_step double precision;
  lng_step double precision;
  cutoff timestamptz;
BEGIN
  lat_step := (p_lat_max - p_lat_min) / p_grid_size;
  lng_step := (p_lng_max - p_lng_min) / p_grid_size;
  cutoff := NOW() - (p_days_back || ' days')::interval;

  WITH tracking_grid AS (
    -- Raw tracking events with speed data
    SELECT
      FLOOR((latitude - p_lat_min) / NULLIF(lat_step, 0))::int AS row_idx,
      FLOOR((longitude - p_lng_min) / NULLIF(lng_step, 0))::int AS col_idx,
      COUNT(*) AS event_count,
      AVG(speed) AS avg_speed,
      MAX(speed) AS max_speed,
      AVG(latitude) AS center_lat,
      AVG(longitude) AS center_lng
    FROM raw_tracking_events
    WHERE tenant_id = p_tenant_id
      AND event_timestamp >= cutoff
      AND latitude BETWEEN p_lat_min AND p_lat_max
      AND longitude BETWEEN p_lng_min AND p_lng_max
    GROUP BY row_idx, col_idx
  ),
  behavior_grid AS (
    -- Behavior events with severity scoring
    SELECT
      be.device_id,
      be.severity,
      be.event_type,
      rt.latitude,
      rt.longitude,
      FLOOR((rt.latitude - p_lat_min) / NULLIF(lat_step, 0))::int AS row_idx,
      FLOOR((rt.longitude - p_lng_min) / NULLIF(lng_step, 0))::int AS col_idx
    FROM fleet_behavior_events be
    JOIN raw_tracking_events rt ON rt.id = be.source_event_id
    WHERE be.tenant_id = p_tenant_id
      AND be.event_timestamp >= cutoff
      AND rt.latitude BETWEEN p_lat_min AND p_lat_max
      AND rt.longitude BETWEEN p_lng_min AND p_lng_max
  ),
  behavior_agg AS (
    SELECT
      row_idx, col_idx,
      COUNT(*) AS behavior_count,
      COUNT(*) FILTER (WHERE severity = 'low') AS low_count,
      COUNT(*) FILTER (WHERE severity = 'medium') AS medium_count,
      COUNT(*) FILTER (WHERE severity = 'high') AS high_count,
      COUNT(*) FILTER (WHERE severity = 'critical') AS critical_count,
      AVG(CASE severity
        WHEN 'low' THEN 1
        WHEN 'medium' THEN 3
        WHEN 'high' THEN 7
        WHEN 'critical' THEN 15
        ELSE 1
      END) AS avg_severity_score
    FROM behavior_grid
    GROUP BY row_idx, col_idx
  ),
  incident_grid AS (
    -- Compliance incidents
    SELECT
      ci.severity,
      ci.status,
      rt.latitude,
      rt.longitude,
      FLOOR((rt.latitude - p_lat_min) / NULLIF(lat_step, 0))::int AS row_idx,
      FLOOR((rt.longitude - p_lng_min) / NULLIF(lng_step, 0))::int AS col_idx
    FROM fleet_compliance_incidents ci
    JOIN fleet_behavior_events be ON be.id = ci.behavior_event_id
    JOIN raw_tracking_events rt ON rt.id = be.source_event_id
    WHERE ci.tenant_id = p_tenant_id
      AND ci.created_at >= cutoff
      AND rt.latitude BETWEEN p_lat_min AND p_lat_max
      AND rt.longitude BETWEEN p_lng_min AND p_lng_max
  ),
  incident_agg AS (
    SELECT
      row_idx, col_idx,
      COUNT(*) AS incident_count,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
      COUNT(*) FILTER (WHERE severity IN ('high', 'critical')) AS severe_count
    FROM incident_grid
    GROUP BY row_idx, col_idx
  ),
  combined AS (
    SELECT
      COALESCE(tg.row_idx, ba.row_idx, ia.row_idx) AS row_idx,
      COALESCE(tg.col_idx, ba.col_idx, ia.col_idx) AS col_idx,
      COALESCE(tg.center_lat, p_lat_min + COALESCE(tg.row_idx, ba.row_idx, ia.row_idx) * lat_step + lat_step/2) AS lat,
      COALESCE(tg.center_lng, p_lng_min + COALESCE(tg.col_idx, ba.col_idx, ia.col_idx) * lng_step + lng_step/2) AS lng,
      COALESCE(tg.event_count, 0) AS tracking_events,
      COALESCE(tg.avg_speed, 0) AS avg_speed,
      COALESCE(tg.max_speed, 0) AS max_speed,
      COALESCE(ba.behavior_count, 0) AS behavior_events,
      COALESCE(ba.low_count, 0) AS low_severity,
      COALESCE(ba.medium_count, 0) AS medium_severity,
      COALESCE(ba.high_count, 0) AS high_severity,
      COALESCE(ba.critical_count, 0) AS critical_severity,
      COALESCE(ba.avg_severity_score, 0) AS severity_score,
      COALESCE(ia.incident_count, 0) AS incidents,
      COALESCE(ia.pending_count, 0) AS pending_incidents,
      COALESCE(ia.severe_count, 0) AS severe_incidents,
      -- Composite risk intensity: weighted formula
      LEAST(1.0, (
        COALESCE(ba.low_count, 0) * 0.05 +
        COALESCE(ba.medium_count, 0) * 0.15 +
        COALESCE(ba.high_count, 0) * 0.35 +
        COALESCE(ba.critical_count, 0) * 0.75 +
        COALESCE(ia.incident_count, 0) * 0.5 +
        COALESCE(ia.severe_count, 0) * 0.8
      ) / GREATEST(1.0, COALESCE(tg.event_count, 1)::double precision * 0.1)) AS risk_intensity
    FROM tracking_grid tg
    FULL OUTER JOIN behavior_agg ba ON tg.row_idx = ba.row_idx AND tg.col_idx = ba.col_idx
    FULL OUTER JOIN incident_agg ia ON COALESCE(tg.row_idx, ba.row_idx) = ia.row_idx
      AND COALESCE(tg.col_idx, ba.col_idx) = ia.col_idx
  )
  SELECT jsonb_build_object(
    'grid_size', p_grid_size,
    'bounds', jsonb_build_object(
      'lat_min', p_lat_min, 'lat_max', p_lat_max,
      'lng_min', p_lng_min, 'lng_max', p_lng_max
    ),
    'days_back', p_days_back,
    'generated_at', NOW(),
    'total_cells', (SELECT COUNT(*) FROM combined WHERE risk_intensity > 0),
    'cells', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'lat', c.lat,
        'lng', c.lng,
        'risk_intensity', ROUND(c.risk_intensity::numeric, 3),
        'risk_level', CASE
          WHEN c.risk_intensity >= 0.7 THEN 'critical'
          WHEN c.risk_intensity >= 0.4 THEN 'high'
          WHEN c.risk_intensity >= 0.15 THEN 'medium'
          ELSE 'low'
        END,
        'tracking_events', c.tracking_events,
        'behavior_events', c.behavior_events,
        'incidents', c.incidents,
        'severity_breakdown', jsonb_build_object(
          'low', c.low_severity,
          'medium', c.medium_severity,
          'high', c.high_severity,
          'critical', c.critical_severity
        ),
        'avg_speed', ROUND(c.avg_speed::numeric, 1),
        'max_speed', ROUND(c.max_speed::numeric, 1)
      ) ORDER BY c.risk_intensity DESC)
      FROM combined c
      WHERE c.risk_intensity > 0
    ), '[]'::jsonb),
    'summary', (
      SELECT jsonb_build_object(
        'total_tracking_events', SUM(tracking_events),
        'total_behavior_events', SUM(behavior_events),
        'total_incidents', SUM(incidents),
        'critical_zones', COUNT(*) FILTER (WHERE risk_intensity >= 0.7),
        'high_risk_zones', COUNT(*) FILTER (WHERE risk_intensity >= 0.4 AND risk_intensity < 0.7),
        'medium_risk_zones', COUNT(*) FILTER (WHERE risk_intensity >= 0.15 AND risk_intensity < 0.4),
        'low_risk_zones', COUNT(*) FILTER (WHERE risk_intensity > 0 AND risk_intensity < 0.15)
      )
      FROM combined
    )
  ) INTO result;

  RETURN result;
END;
$$;
