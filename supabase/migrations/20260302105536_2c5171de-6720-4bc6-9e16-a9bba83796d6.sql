-- Enable realtime for worktime_ledger so the control plane can show live entries
ALTER PUBLICATION supabase_realtime ADD TABLE public.worktime_ledger;