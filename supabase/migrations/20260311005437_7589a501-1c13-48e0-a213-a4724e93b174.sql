ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS bytes_uploaded bigint DEFAULT 0;
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS bytes_downloaded bigint DEFAULT 0;