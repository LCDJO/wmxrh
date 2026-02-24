
-- Add watermark columns to pdf_layout_configs
ALTER TABLE public.pdf_layout_configs
  ADD COLUMN IF NOT EXISTS watermark_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS watermark_type text DEFAULT 'text' CHECK (watermark_type IN ('text', 'image', 'background')),
  ADD COLUMN IF NOT EXISTS watermark_text text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS watermark_image_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS watermark_opacity numeric DEFAULT 0.08,
  ADD COLUMN IF NOT EXISTS watermark_rotation numeric DEFAULT -30,
  ADD COLUMN IF NOT EXISTS watermark_font_size numeric DEFAULT 60,
  ADD COLUMN IF NOT EXISTS watermark_color text DEFAULT '#000000',
  ADD COLUMN IF NOT EXISTS watermark_position text DEFAULT 'center' CHECK (watermark_position IN ('center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'tiled'));
