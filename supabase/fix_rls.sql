-- ============================================
-- FlatHunt AI - Fix RLS issues
-- ============================================

-- 1. Añadir policy UPDATE a profiles (faltaba)
drop policy if exists "Usuarios actualizan su perfil" on profiles;
create policy "Usuarios actualizan su perfil"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2. Listings: cambiar SELECT de authenticated a anon (para que cualquiera vea pisos sin login)
-- Primero eliminar la policy vieja
drop policy if exists "Listings visibles para autenticados" on listings;
-- Luego crear la nueva para todos
drop policy if exists "Listings visibles para todos" on listings;
create policy "Listings visibles para todos"
  on listings for select
  using (true);

-- 3. Eliminar policies de service_role en listings (innecesarias, bypassea RLS)
drop policy if exists "Service puede modificar listings" on listings;
drop policy if exists "Service puede actualizar listings" on listings;
