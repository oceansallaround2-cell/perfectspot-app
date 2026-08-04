
CREATE TABLE public.surprise_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'birthday',
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  music_path text,
  voice_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.surprise_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.surprise_events(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.surprise_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.surprise_events(id) ON DELETE CASCADE,
  content text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.surprise_wishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.surprise_events(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wish text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.surprise_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.surprise_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now(),
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.surprise_events TO authenticated;
GRANT ALL ON public.surprise_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surprise_photos TO authenticated;
GRANT ALL ON public.surprise_photos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surprise_messages TO authenticated;
GRANT ALL ON public.surprise_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surprise_wishes TO authenticated;
GRANT ALL ON public.surprise_wishes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surprise_progress TO authenticated;
GRANT ALL ON public.surprise_progress TO service_role;

ALTER TABLE public.surprise_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surprise_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surprise_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surprise_wishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surprise_progress ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_surprise(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.surprise_events e
    WHERE e.id = _event_id
      AND (e.creator_id = auth.uid() OR (e.recipient_id = auth.uid() AND e.start_at <= now()))
  )
$$;

CREATE OR REPLACE FUNCTION public.is_surprise_creator(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.surprise_events e
    WHERE e.id = _event_id AND e.creator_id = auth.uid()
  )
$$;

CREATE POLICY "view surprise events" ON public.surprise_events FOR SELECT TO authenticated
  USING (creator_id = auth.uid() OR (recipient_id = auth.uid() AND start_at <= now()));
CREATE POLICY "create own surprise event" ON public.surprise_events FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());
CREATE POLICY "update own surprise event" ON public.surprise_events FOR UPDATE TO authenticated
  USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());
CREATE POLICY "delete own surprise event" ON public.surprise_events FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY "view surprise photos" ON public.surprise_photos FOR SELECT TO authenticated
  USING (public.can_view_surprise(event_id));
CREATE POLICY "creator manages photos insert" ON public.surprise_photos FOR INSERT TO authenticated
  WITH CHECK (public.is_surprise_creator(event_id));
CREATE POLICY "creator manages photos update" ON public.surprise_photos FOR UPDATE TO authenticated
  USING (public.is_surprise_creator(event_id)) WITH CHECK (public.is_surprise_creator(event_id));
CREATE POLICY "creator manages photos delete" ON public.surprise_photos FOR DELETE TO authenticated
  USING (public.is_surprise_creator(event_id));

CREATE POLICY "view surprise messages" ON public.surprise_messages FOR SELECT TO authenticated
  USING (public.can_view_surprise(event_id));
CREATE POLICY "creator manages messages insert" ON public.surprise_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_surprise_creator(event_id));
CREATE POLICY "creator manages messages update" ON public.surprise_messages FOR UPDATE TO authenticated
  USING (public.is_surprise_creator(event_id)) WITH CHECK (public.is_surprise_creator(event_id));
CREATE POLICY "creator manages messages delete" ON public.surprise_messages FOR DELETE TO authenticated
  USING (public.is_surprise_creator(event_id));

CREATE POLICY "view own or created wishes" ON public.surprise_wishes FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR public.is_surprise_creator(event_id));
CREATE POLICY "write own wish" ON public.surprise_wishes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_view_surprise(event_id));

CREATE POLICY "manage own progress" ON public.surprise_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.surprise_events REPLICA IDENTITY FULL;
ALTER TABLE public.surprise_photos REPLICA IDENTITY FULL;
ALTER TABLE public.surprise_messages REPLICA IDENTITY FULL;
ALTER TABLE public.surprise_wishes REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.surprise_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.surprise_photos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.surprise_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.surprise_wishes;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER surprise_events_touch BEFORE UPDATE ON public.surprise_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER surprise_progress_touch BEFORE UPDATE ON public.surprise_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
