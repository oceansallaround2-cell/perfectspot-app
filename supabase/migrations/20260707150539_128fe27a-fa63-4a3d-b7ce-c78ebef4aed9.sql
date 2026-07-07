
-- Rooms
CREATE TABLE public.watch_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  creator_id uuid NOT NULL,
  video_url text,
  is_playing boolean NOT NULL DEFAULT false,
  position_seconds double precision NOT NULL DEFAULT 0,
  last_sync_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_rooms TO authenticated;
GRANT ALL ON public.watch_rooms TO service_role;
ALTER TABLE public.watch_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms readable by authenticated" ON public.watch_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own room" ON public.watch_rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "update room by authenticated" ON public.watch_rooms FOR UPDATE TO authenticated USING (true);
CREATE POLICY "delete own room" ON public.watch_rooms FOR DELETE TO authenticated USING (auth.uid() = creator_id);

-- Members
CREATE TABLE public.watch_room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.watch_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_room_members TO authenticated;
GRANT ALL ON public.watch_room_members TO service_role;
ALTER TABLE public.watch_room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members readable by authenticated" ON public.watch_room_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own membership" ON public.watch_room_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own membership" ON public.watch_room_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Messages
CREATE TABLE public.watch_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.watch_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.watch_messages TO authenticated;
GRANT ALL ON public.watch_messages TO service_role;
ALTER TABLE public.watch_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watch messages readable by authenticated" ON public.watch_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own watch message" ON public.watch_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "delete own watch message" ON public.watch_messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_messages;

-- Full row payloads on updates so clients get the whole video state
ALTER TABLE public.watch_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.watch_room_members REPLICA IDENTITY FULL;
ALTER TABLE public.watch_messages REPLICA IDENTITY FULL;
