/*
  # Storage RLS policies for pin-photos bucket

  - Authenticated users can upload photos
  - Public read access for everyone
*/

CREATE POLICY "Authenticated users can upload pin photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pin-photos');

CREATE POLICY "Public read pin photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'pin-photos');
