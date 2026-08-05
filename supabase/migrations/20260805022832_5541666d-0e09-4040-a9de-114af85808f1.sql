CREATE TABLE public.app_music (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_music TO authenticated;
GRANT ALL ON public.app_music TO service_role;
ALTER TABLE public.app_music ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_music readable by authenticated" ON public.app_music FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own app_music" ON public.app_music FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "delete own app_music" ON public.app_music FOR DELETE TO authenticated USING (auth.uid() = uploader_id);
ALTER TABLE public.app_music REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_music;