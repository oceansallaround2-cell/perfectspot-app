
CREATE POLICY "view surprise files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'surprises' AND public.can_view_surprise(((storage.foldername(name))[1])::uuid));
CREATE POLICY "creator uploads surprise files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'surprises' AND public.is_surprise_creator(((storage.foldername(name))[1])::uuid));
CREATE POLICY "creator updates surprise files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'surprises' AND public.is_surprise_creator(((storage.foldername(name))[1])::uuid));
CREATE POLICY "creator deletes surprise files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'surprises' AND public.is_surprise_creator(((storage.foldername(name))[1])::uuid));
