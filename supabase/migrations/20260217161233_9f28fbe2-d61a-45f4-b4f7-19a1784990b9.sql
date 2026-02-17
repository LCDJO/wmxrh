
-- Update event_type check constraint to match the canonical tracked events
ALTER TABLE public.landing_metric_events DROP CONSTRAINT landing_metric_events_event_type_check;
ALTER TABLE public.landing_metric_events ADD CONSTRAINT landing_metric_events_event_type_check
  CHECK (event_type IN ('page_view','scroll_depth','cta_click','signup_started','signup_completed','plan_selected','revenue_generated'));
