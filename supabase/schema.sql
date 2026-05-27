-- ============================================
-- FlatHunt AI - Supabase Schema
-- Ejecutar en SQL Editor de Supabase
-- ============================================

-- Habilitar pgvector para RAG semántico (Fase 3)
create extension if not exists vector;

-- ============================================
-- PERFILES DE USUARIO
-- ============================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Trigger: crear perfil automáticamente al registrarse
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================
-- PREFERENCIAS DE BÚSQUEDA
-- ============================================
create table if not exists search_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Mi búsqueda',
  max_price integer,
  min_rooms integer,
  min_size integer,
  neighborhoods text[],
  must_have text[],
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- LISTINGS (PISOS)
-- ============================================
create table if not exists listings (
  id text primary key,
  title text,
  price numeric,
  rooms integer,
  size_m2 integer,
  floor text,
  address text,
  neighborhood text,
  image_url text,
  images text[],
  description text,
  external_url text not null,
  latitude numeric,
  longitude numeric,
  source text default 'idealista',
  features text[],
  first_seen timestamptz default now(),
  last_seen timestamptz default now(),
  is_active boolean default true,
  embedding vector(1536)
);

-- ============================================
-- FAVORITOS
-- ============================================
create table if not exists favorites (
  user_id uuid references auth.users(id) on delete cascade,
  listing_id text references listings(id) on delete cascade,
  ai_score integer,
  ai_notes text,
  created_at timestamptz default now(),
  primary key (user_id, listing_id)
);

-- ============================================
-- HISTORIAL DE BÚSQUEDAS
-- ============================================
create table if not exists search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  query text,
  filters jsonb,
  results_count integer,
  source text default 'manual',
  created_at timestamptz default now()
);

-- ============================================
-- ÍNDICES
-- ============================================
create index if not exists listings_price_idx on listings(price);
create index if not exists listings_neighborhood_idx on listings(neighborhood);
create index if not exists listings_last_seen_idx on listings(last_seen desc);
create index if not exists favorites_user_idx on favorites(user_id);
create index if not exists search_history_user_idx on search_history(user_id);
create index if not exists search_preferences_user_idx on search_preferences(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Profiles
alter table profiles enable row level security;
create policy "Usuarios ven su propio perfil" on profiles
  for select using (auth.uid() = id);

-- Search preferences: cada usuario solo ve y gestiona las suyas
alter table search_preferences enable row level security;
create policy "Usuarios gestionan sus preferencias" on search_preferences
  for all using (auth.uid() = user_id);

-- Listings: visibles para todos los usuarios autenticados
alter table listings enable row level security;
create policy "Listings visibles para autenticados" on listings
  for select using (auth.role() = 'authenticated');

-- Solo el service_role puede insertar/actualizar listings (desde flathunter)
create policy "Service puede modificar listings" on listings
  for insert with check (auth.role() = 'service_role');
create policy "Service puede actualizar listings" on listings
  for update using (auth.role() = 'service_role');

-- Favorites: cada usuario gestiona los suyos
alter table favorites enable row level security;
create policy "Usuarios gestionan sus favoritos" on favorites
  for all using (auth.uid() = user_id);

-- Search history: cada usuario ve el suyo
alter table search_history enable row level security;
create policy "Usuarios ven su historial" on search_history
  for all using (auth.uid() = user_id);

-- ============================================
-- PG VECTOR INDEX (activar cuando haya datos)
-- ============================================
-- create index if not exists listings_embedding_idx
--   on listings using ivfflat (embedding vector_cosine_ops)
--   with (lists = 100);

-- ============================================
-- RPC: Búsqueda semántica con pgvector
-- ============================================
drop function if exists search_listings(vector,integer);

create or replace function search_listings (
  query_embedding vector(1536),
  match_count int default 10,
  neighborhoods text[] default null
)
returns table (
  id text,
  title text,
  price numeric,
  rooms int,
  size_m2 int,
  neighborhood text,
  address text,
  image_url text,
  images text[],
  similarity float,
  floor text,
  description text
)
language sql stable
as $$
  select
    listings.id,
    listings.title,
    listings.price,
    listings.rooms,
    listings.size_m2,
    listings.neighborhood,
    listings.address,
    listings.image_url,
    listings.images,
    1 - (listings.embedding <=> query_embedding) as similarity,
    listings.floor,
    listings.description
  from listings
  where listings.embedding is not null
    and listings.is_active = true
    and (neighborhoods is null or listings.neighborhood = any(neighborhoods))
  order by listings.embedding <=> query_embedding
  limit match_count;
$$;
