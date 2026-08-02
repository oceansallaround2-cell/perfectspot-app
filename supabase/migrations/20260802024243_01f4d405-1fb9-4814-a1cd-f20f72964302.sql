-- 1. Reactions (shared across love messages, journal entries, memories)
CREATE TABLE public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('love_message','journal_entry','memory','watch_message')),
  target_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.reactions TO authenticated;
GRANT ALL ON public.reactions TO service_role;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions readable by authenticated" ON public.reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own reaction" ON public.reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own reaction" ON public.reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX reactions_target_idx ON public.reactions (target_type, target_id);

-- 2. Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = recipient_id);
CREATE POLICY "create notification as actor" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = recipient_id);
CREATE POLICY "delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = recipient_id);
CREATE INDEX notifications_recipient_idx ON public.notifications (recipient_id, created_at DESC);

-- 3. Editable love messages
ALTER TABLE public.love_messages ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE POLICY "update own love_message" ON public.love_messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);
GRANT UPDATE ON public.love_messages TO authenticated;

-- 4. Journal / memories edit metadata
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- 5. Watch chat: voice notes
ALTER TABLE public.watch_messages ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text';
ALTER TABLE public.watch_messages ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE public.watch_messages ADD COLUMN IF NOT EXISTS audio_path text;
ALTER TABLE public.watch_messages ADD COLUMN IF NOT EXISTS duration_seconds numeric;

-- 6. Web push subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own push subscription" ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 8. Auto-expire notifications after 9 days
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'expire-old-notifications',
  '0 3 * * *',
  $$DELETE FROM public.notifications WHERE created_at < now() - INTERVAL '9 days'$$
);