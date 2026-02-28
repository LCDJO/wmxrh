
CREATE POLICY "Anyone authenticated can read footer defaults"
ON public.platform_footer_defaults
FOR SELECT
USING (auth.role() = 'authenticated');
