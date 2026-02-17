-- Add soft delete column to landing_pages
ALTER TABLE public.landing_pages ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_by to track who deleted
ALTER TABLE public.landing_pages ADD COLUMN deleted_by UUID DEFAULT NULL;