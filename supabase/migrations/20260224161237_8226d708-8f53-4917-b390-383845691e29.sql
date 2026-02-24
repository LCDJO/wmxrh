
-- Create storage bucket for PDF layout logos
INSERT INTO storage.buckets (id, name, public) VALUES ('pdf-logos', 'pdf-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload logos
CREATE POLICY "Authenticated users can upload pdf logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pdf-logos');

-- Allow authenticated users to update their logos
CREATE POLICY "Authenticated users can update pdf logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'pdf-logos');

-- Allow authenticated users to delete their logos
CREATE POLICY "Authenticated users can delete pdf logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pdf-logos');

-- Public read access for logos
CREATE POLICY "Public read access for pdf logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'pdf-logos');
