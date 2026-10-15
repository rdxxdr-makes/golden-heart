CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.portal_pins (
  role public.app_role PRIMARY KEY,
  pin_hash text NOT NULL
);
REVOKE ALL ON public.portal_pins FROM anon, authenticated;
GRANT ALL ON public.portal_pins TO service_role;
ALTER TABLE public.portal_pins ENABLE ROW LEVEL SECURITY;
-- No policies: hashes are readable only by the security-definer function below.

CREATE OR REPLACE FUNCTION public.redeem_portal_pin(_pin text)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
declare
  granted public.app_role;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select p.role into granted from public.portal_pins p
   where p.pin_hash = extensions.crypt(coalesce(_pin, ''), p.pin_hash)
   order by (p.role = 'admin') desc limit 1;
  if granted is null then
    perform pg_sleep(0.5);
    raise exception 'Invalid PIN';
  end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), granted)
  on conflict (user_id, role) do nothing;
  return granted;
end;
$$;
REVOKE ALL ON FUNCTION public.redeem_portal_pin(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_portal_pin(text) TO authenticated;