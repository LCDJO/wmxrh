-- Allow authenticated users to create their own referral links
CREATE POLICY "users_insert_own_referral_links"
ON public.referral_links
FOR INSERT
WITH CHECK (referrer_user_id = auth.uid());
