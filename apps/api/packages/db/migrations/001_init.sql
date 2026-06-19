-- Basic extensions
create extension if not exists pgcrypto;

-- Users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Short links
create table if not exists links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  code text not null unique,
  target_url text not null,
  title text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists links_user_id_created_at_idx on links(user_id, created_at desc);

-- Click events (analytics)
create table if not exists click_events (
  id bigserial primary key,
  link_id uuid not null references links(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  ip inet,
  user_agent text,
  referrer text,
  country_code text,
  region text,
  city text
);

create index if not exists click_events_link_id_clicked_at_idx on click_events(link_id, clicked_at desc);
create index if not exists click_events_referrer_idx on click_events(link_id, referrer);
create index if not exists click_events_country_idx on click_events(link_id, country_code);

-- updated_at trigger
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists links_set_updated_at on links;
create trigger links_set_updated_at
before update on links
for each row execute function set_updated_at();

