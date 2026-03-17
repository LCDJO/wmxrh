-- Allow banner delivery logic to read only active ad data for public/authenticated users
DROP POLICY IF EXISTS "Public can read active ad campaigns" ON public.ads_campaigns;
CREATE POLICY "Public can read active ad campaigns"
ON public.ads_campaigns
FOR SELECT
TO anon, authenticated
USING (
  status = 'active'
  AND start_date <= now()
  AND (end_date IS NULL OR end_date >= now())
);

DROP POLICY IF EXISTS "Public can read active ad creatives" ON public.ads_creatives;
CREATE POLICY "Public can read active ad creatives"
ON public.ads_creatives
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (expires_at IS NULL OR expires_at >= now())
  AND EXISTS (
    SELECT 1
    FROM public.ads_campaigns c
    WHERE c.id = ads_creatives.campaign_id
      AND c.status = 'active'
      AND c.start_date <= now()
      AND (c.end_date IS NULL OR c.end_date >= now())
  )
  AND (
    placement_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.ads_placements p
      WHERE p.id = ads_creatives.placement_id
        AND p.is_active = true
    )
  )
);

DROP POLICY IF EXISTS "Public can read active ad placements" ON public.ads_placements;
CREATE POLICY "Public can read active ad placements"
ON public.ads_placements
FOR SELECT
TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Public can read targeting for active ad campaigns" ON public.ads_targeting;
CREATE POLICY "Public can read targeting for active ad campaigns"
ON public.ads_targeting
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ads_campaigns c
    WHERE c.id = ads_targeting.campaign_id
      AND c.status = 'active'
      AND c.start_date <= now()
      AND (c.end_date IS NULL OR c.end_date >= now())
  )
);