-- Create action-plans storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('action-plans', 'action-plans', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to action-plans bucket
CREATE POLICY "Authenticated users can upload action plans"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'action-plans');

-- Allow public read access to action-plans files
CREATE POLICY "Public can read action plans"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'action-plans');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update action plans"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'action-plans');

-- Allow authenticated users to delete action plans files
CREATE POLICY "Authenticated users can delete action plans"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'action-plans');
