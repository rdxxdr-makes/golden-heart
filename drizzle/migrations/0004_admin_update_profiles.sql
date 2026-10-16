create policy "admins update any profile"
on public.profiles
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'::app_role));