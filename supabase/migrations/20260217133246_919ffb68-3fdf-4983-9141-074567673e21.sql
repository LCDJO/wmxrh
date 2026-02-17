
-- Helper RPCs to atomically increment referral link counters
CREATE OR REPLACE FUNCTION public.increment_referral_link_signups(link_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE referral_links SET total_signups = total_signups + 1 WHERE id = link_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_referral_link_conversions(link_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE referral_links
  SET total_conversions = total_conversions + 1
  WHERE id = link_id;
$$;
