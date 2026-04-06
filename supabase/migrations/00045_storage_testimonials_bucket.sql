-- Create testimonials storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('testimonials', 'testimonials', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to testimonials bucket
CREATE POLICY "Authenticated users can upload testimonials"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'testimonials');

-- Allow public read access to testimonials files
CREATE POLICY "Public can read testimonials"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'testimonials');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update testimonials"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'testimonials');

-- Allow authenticated users to delete testimonials files
CREATE POLICY "Authenticated users can delete testimonials"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'testimonials');
