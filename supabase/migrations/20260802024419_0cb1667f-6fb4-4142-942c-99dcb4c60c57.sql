CREATE POLICY "voice notes readable by authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'voice-notes');

CREATE POLICY "upload own voice note"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'voice-notes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "delete own voice note"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'voice-notes' AND (storage.foldername(name))[1] = auth.uid()::text);