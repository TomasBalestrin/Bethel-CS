-- Create chat-attachments storage bucket for audio, images, documents sent via chat
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated can upload chat attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

-- Public read access (NextTrack API needs to download media via URL)
CREATE POLICY "Public can read chat attachments"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'chat-attachments');

-- Allow authenticated users to update
CREATE POLICY "Authenticated can update chat attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'chat-attachments');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated can delete chat attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'chat-attachments');
