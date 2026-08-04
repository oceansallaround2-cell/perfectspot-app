
REVOKE ALL ON FUNCTION public.can_view_surprise(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_surprise_creator(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_surprise(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_surprise_creator(uuid) TO authenticated;
