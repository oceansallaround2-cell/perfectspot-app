
CREATE POLICY "memories bucket read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'memories');
CREATE POLICY "memories bucket insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'memories');
CREATE POLICY "memories bucket update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'memories');
CREATE POLICY "memories bucket delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'memories');
