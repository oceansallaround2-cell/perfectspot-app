
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  partner_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- MEMORIES
CREATE TABLE public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_path TEXT NOT NULL,
  media_type TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memories readable by authenticated" ON public.memories FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own memory" ON public.memories FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "delete own memory" ON public.memories FOR DELETE TO authenticated USING (auth.uid() = uploader_id);
CREATE POLICY "update own memory" ON public.memories FOR UPDATE TO authenticated USING (auth.uid() = uploader_id);

-- LOVE MESSAGES
CREATE TABLE public.love_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.love_messages TO authenticated;
GRANT ALL ON public.love_messages TO service_role;
ALTER TABLE public.love_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "love_messages readable by authenticated" ON public.love_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own love_message" ON public.love_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "delete own love_message" ON public.love_messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.love_messages;

-- IMPORTANT DATES
CREATE TABLE public.important_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  is_anniversary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.important_dates TO authenticated;
GRANT ALL ON public.important_dates TO service_role;
ALTER TABLE public.important_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dates readable by authenticated" ON public.important_dates FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own date" ON public.important_dates FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "update own date" ON public.important_dates FOR UPDATE TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "delete own date" ON public.important_dates FOR DELETE TO authenticated USING (auth.uid() = creator_id);

-- JOURNAL ENTRIES
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mood TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journal readable by authenticated" ON public.journal_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own journal" ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "update own journal" ON public.journal_entries FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "delete own journal" ON public.journal_entries FOR DELETE TO authenticated USING (auth.uid() = author_id);
