ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS device_id text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_device_id_key ON public.profiles(device_id) WHERE device_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.device_registered(_device text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.profiles where device_id = _device)
$$;
REVOKE ALL ON FUNCTION public.device_registered(text) FROM public;
GRANT EXECUTE ON FUNCTION public.device_registered(text) TO anon, authenticated;