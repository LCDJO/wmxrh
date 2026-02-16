
-- Enable realtime for employee_events to power training auto-generation
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_events;
