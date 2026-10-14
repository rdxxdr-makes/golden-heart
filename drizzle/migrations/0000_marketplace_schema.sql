
-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);
-- no insert/update/delete policies: roles are only granted server-side

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  address text not null,
  phone text not null unique,
  avatar_path text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "admins read all profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id);
-- phone lookup for WhatsApp contact on approved listings (phone only, address stays private)
create or replace function public.seller_phone(_seller_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select phone from public.profiles where id = _seller_id
$$;
grant execute on function public.seller_phone(uuid) to anon, authenticated;

-- Listings
create type public.listing_type as enum ('sell', 'donate', 'bid');
create type public.listing_status as enum ('pending', 'approved', 'rejected', 'sold');

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  type listing_type not null,
  title text not null,
  description text not null default '',
  price numeric(12,2),
  category text not null,
  location text not null,
  photos text[] not null default '{}',
  status listing_status not null default 'pending',
  rejection_reason text,
  bid_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.listings to anon;
grant select, insert, update, delete on public.listings to authenticated;
grant all on public.listings to service_role;
alter table public.listings enable row level security;

create policy "public reads approved listings" on public.listings for select to anon, authenticated
  using (status = 'approved');
create policy "owners read own listings" on public.listings for select to authenticated
  using (auth.uid() = owner_id);
create policy "admins read all listings" on public.listings for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "users insert own listings as pending" on public.listings for insert to authenticated
  with check (auth.uid() = owner_id and status = 'pending');
create policy "owners update own listings" on public.listings for update to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id and status in ('pending','approved','sold'));
create policy "owners delete own listings" on public.listings for delete to authenticated
  using (auth.uid() = owner_id);
create policy "admins update any listing" on public.listings for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "admins delete any listing" on public.listings for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Bids
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  bidder_id uuid not null,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);
grant select on public.bids to anon;
grant select, insert on public.bids to authenticated;
grant all on public.bids to service_role;
alter table public.bids enable row level security;
create policy "anyone reads bids" on public.bids for select to anon, authenticated using (true);
-- inserts happen through the place_bid function only (no direct insert policy)

create or replace function public.place_bid(_listing_id uuid, _amount numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  l public.listings%rowtype;
  current_high numeric;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into l from public.listings where id = _listing_id for update;
  if not found then raise exception 'Listing not found'; end if;
  if l.type <> 'bid' then raise exception 'Not an auction listing'; end if;
  if l.status <> 'approved' then raise exception 'Listing is not open for bidding'; end if;
  if l.bid_deadline is null or l.bid_deadline <= now() then raise exception 'Bidding has ended'; end if;
  if l.owner_id = auth.uid() then raise exception 'You cannot bid on your own listing'; end if;
  select coalesce(max(amount), l.price, 0) into current_high from public.bids where listing_id = _listing_id;
  if _amount <= current_high then raise exception 'Bid must be higher than the current highest bid (₹%)', current_high; end if;
  insert into public.bids (listing_id, bidder_id, amount) values (_listing_id, auth.uid(), _amount) returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.place_bid(uuid, numeric) to authenticated;

-- Highest bid helper
create or replace function public.highest_bid(_listing_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select max(amount) from public.bids where listing_id = _listing_id
$$;
grant execute on function public.highest_bid(uuid) to anon, authenticated;

-- Storage policies for listing-photos bucket (private; signed URLs)
create policy "anyone can view listing photos" on storage.objects for select to anon, authenticated
  using (bucket_id = 'listing-photos');
create policy "users upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users manage own photos" on storage.objects for update to authenticated
  using (bucket_id = 'listing-photos' and owner = auth.uid());
create policy "users delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and owner = auth.uid());

-- Realtime
alter publication supabase_realtime add table public.listings;
alter publication supabase_realtime add table public.bids;
