ALTER TABLE public.important_dates
  ADD COLUMN IF NOT EXISTS event_time time,
  ADD COLUMN IF NOT EXISTS repeat_yearly boolean NOT NULL DEFAULT false;

UPDATE public.important_dates
  SET repeat_yearly = true
  WHERE event_type IN ('birthday','anniversary') OR is_anniversary = true;

ALTER PUBLICATION supabase_realtime ADD TABLE public.memories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.surprise_progress;