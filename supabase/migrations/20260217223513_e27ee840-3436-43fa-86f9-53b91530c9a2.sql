
-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Authenticated users can upload to chat-attachments
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND auth.role() = 'authenticated'
);

-- RLS: Users can view chat attachments (tenant members or platform users)
CREATE POLICY "Authenticated users can view chat attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-attachments'
  AND auth.role() = 'authenticated'
);

-- RLS: Users can delete their own uploads
CREATE POLICY "Users can delete own chat attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
