
-- Enable Realtime for fleet event streaming tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.raw_tracking_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_behavior_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_compliance_incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_disciplinary_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.compliance_violations;
