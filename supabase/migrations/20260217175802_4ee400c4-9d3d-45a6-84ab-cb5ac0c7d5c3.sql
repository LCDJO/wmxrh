-- Allow 'superseded' status in landing_page_versions
ALTER TABLE public.landing_page_versions DROP CONSTRAINT landing_page_versions_status_check;
ALTER TABLE public.landing_page_versions ADD CONSTRAINT landing_page_versions_status_check 
  CHECK (status IN ('draft', 'submitted', 'approved', 'published', 'superseded'));