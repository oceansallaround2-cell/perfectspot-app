ALTER TABLE public.important_dates
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.important_dates REPLICA IDENTITY FULL;
ALTER TABLE public.journal_entries REPLICA IDENTITY FULL;
ALTER TABLE public.watch_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.important_dates;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.journal_entries;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_messages;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;