
-- RPC: Extended platform metrics (marketing, API, financial)
CREATE OR REPLACE FUNCTION public.get_platform_extended_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result JSONB;
  -- Landing Pages
  _total_lps INTEGER;
  _published_lps INTEGER;
  _draft_lps INTEGER;
  _total_lp_views BIGINT;
  _total_lp_conversions BIGINT;
  _avg_conversion_rate NUMERIC;
  _top_lps JSONB;
  -- Landing Metric Events
  _lp_events_7d BIGINT;
  _lp_revenue_total NUMERIC;
  -- Referral
  _total_referral_clicks BIGINT;
  _total_referral_signups BIGINT;
  _total_referral_conversions BIGINT;
  _total_referral_reward NUMERIC;
  -- API
  _total_api_requests BIGINT;
  _total_api_errors BIGINT;
  _total_api_rate_limited BIGINT;
  _avg_api_latency NUMERIC;
  _p95_api_latency NUMERIC;
  _api_clients_active INTEGER;
  -- Invoices
  _invoices_total INTEGER;
  _invoices_paid INTEGER;
  _invoices_pending INTEGER;
  _invoices_overdue INTEGER;
  _invoices_total_amount NUMERIC;
  _invoices_paid_amount NUMERIC;
  _invoices_pending_amount NUMERIC;
BEGIN
  -- Only allow platform users
  IF NOT is_active_platform_user(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- ═══ LANDING PAGES ═══
  SELECT COUNT(*) INTO _total_lps FROM landing_pages WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO _published_lps FROM landing_pages WHERE deleted_at IS NULL AND status = 'published';
  SELECT COUNT(*) INTO _draft_lps FROM landing_pages WHERE deleted_at IS NULL AND status = 'draft';

  -- Aggregate analytics from JSONB
  SELECT 
    COALESCE(SUM((analytics->>'views')::bigint), 0),
    COALESCE(SUM((analytics->>'conversions')::bigint), 0),
    CASE WHEN COALESCE(SUM((analytics->>'views')::bigint), 0) > 0 
      THEN ROUND(COALESCE(SUM((analytics->>'conversions')::bigint), 0)::numeric / COALESCE(SUM((analytics->>'views')::bigint), 1) * 100, 2)
      ELSE 0
    END
  INTO _total_lp_views, _total_lp_conversions, _avg_conversion_rate
  FROM landing_pages WHERE deleted_at IS NULL;

  -- Top LPs
  SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO _top_lps FROM (
    SELECT name, slug, status,
      (analytics->>'views')::int as views,
      (analytics->>'conversions')::int as conversions,
      (analytics->>'conversionRate')::numeric as conversion_rate
    FROM landing_pages WHERE deleted_at IS NULL
    ORDER BY (analytics->>'views')::int DESC NULLS LAST
    LIMIT 5
  ) sub;

  -- Landing metric events last 7 days
  SELECT COUNT(*), COALESCE(SUM(revenue_generated), 0)
  INTO _lp_events_7d, _lp_revenue_total
  FROM landing_metric_events
  WHERE created_at >= now() - interval '7 days';

  -- ═══ REFERRAL ═══
  SELECT 
    COALESCE(SUM(total_clicks), 0),
    COALESCE(SUM(total_signups), 0),
    COALESCE(SUM(total_conversions), 0),
    COALESCE(SUM(total_reward_brl), 0)
  INTO _total_referral_clicks, _total_referral_signups, _total_referral_conversions, _total_referral_reward
  FROM referral_links WHERE is_active = true;

  -- ═══ API USAGE ═══
  SELECT 
    COALESCE(SUM(total_requests), 0),
    COALESCE(SUM(failed_requests), 0),
    COALESCE(SUM(rate_limited_requests), 0),
    COALESCE(AVG(avg_response_time_ms), 0),
    COALESCE(AVG(p95_response_time_ms), 0)
  INTO _total_api_requests, _total_api_errors, _total_api_rate_limited, _avg_api_latency, _p95_api_latency
  FROM api_analytics_aggregates;

  SELECT COUNT(*) INTO _api_clients_active FROM api_clients WHERE status = 'active';

  -- ═══ INVOICES ═══
  SELECT COUNT(*) INTO _invoices_total FROM invoices;
  SELECT COUNT(*), COALESCE(SUM(total_amount), 0) INTO _invoices_paid, _invoices_paid_amount FROM invoices WHERE status = 'paid';
  SELECT COUNT(*), COALESCE(SUM(total_amount), 0) INTO _invoices_pending, _invoices_pending_amount FROM invoices WHERE status = 'pending';
  SELECT COUNT(*) INTO _invoices_overdue FROM invoices WHERE status = 'overdue';
  SELECT COALESCE(SUM(total_amount), 0) INTO _invoices_total_amount FROM invoices;

  _result := jsonb_build_object(
    'marketing', jsonb_build_object(
      'total_landing_pages', _total_lps,
      'published_lps', _published_lps,
      'draft_lps', _draft_lps,
      'total_views', _total_lp_views,
      'total_conversions', _total_lp_conversions,
      'avg_conversion_rate', _avg_conversion_rate,
      'events_7d', _lp_events_7d,
      'lp_revenue_total', _lp_revenue_total,
      'top_landing_pages', _top_lps,
      'referral_clicks', _total_referral_clicks,
      'referral_signups', _total_referral_signups,
      'referral_conversions', _total_referral_conversions,
      'referral_reward_brl', _total_referral_reward
    ),
    'api', jsonb_build_object(
      'total_requests', _total_api_requests,
      'total_errors', _total_api_errors,
      'total_rate_limited', _total_api_rate_limited,
      'avg_latency_ms', ROUND(_avg_api_latency, 1),
      'p95_latency_ms', ROUND(_p95_api_latency, 1),
      'active_clients', _api_clients_active
    ),
    'financial', jsonb_build_object(
      'invoices_total', _invoices_total,
      'invoices_paid', _invoices_paid,
      'invoices_pending', _invoices_pending,
      'invoices_overdue', _invoices_overdue,
      'total_billed', _invoices_total_amount,
      'total_received', _invoices_paid_amount,
      'total_pending_amount', _invoices_pending_amount
    )
  );

  RETURN _result;
END;
$function$;
