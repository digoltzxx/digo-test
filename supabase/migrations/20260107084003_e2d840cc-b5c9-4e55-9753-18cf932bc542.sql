-- Create storage bucket for social proofs avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-proofs', 'social-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access for social proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'social-proofs');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload social proof images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'social-proofs' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete social proof images"
ON storage.objects FOR DELETE
USING (bucket_id = 'social-proofs' AND auth.role() = 'authenticated');