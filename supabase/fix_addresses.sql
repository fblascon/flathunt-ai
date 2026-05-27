-- Fix addresses extracted with buggy regex that included "alquiler en" or "venta en" prefix
-- Run this in Supabase SQL Editor

-- Preview affected rows first
SELECT count(*) AS affected_count
FROM listings
WHERE address ~ '^(?:alquiler|venta)\s+en\s+';

-- Show sample of broken addresses
SELECT id, title, address
FROM listings
WHERE address ~ '^(?:alquiler|venta)\s+en\s+'
LIMIT 10;

-- Apply the fix: remove "alquiler en " or "venta en " prefix
UPDATE listings
SET address = regexp_replace(address, '^(?:alquiler|venta)\s+en\s+', '')
WHERE address ~ '^(?:alquiler|venta)\s+en\s+';

-- If there are other bad patterns (e.g. just "alquiler " without "en"), fix those too
UPDATE listings
SET address = regexp_replace(address, '^(?:alquiler|venta)\s+', '')
WHERE address ~ '^(?:alquiler|venta)\s+'
  AND address !~ '^(?:Calle|Av\.|Avda\.|Avenida|Plaza|Paseo|Ronda|Glorieta|Carretera|Camino|Travesía|Urbanización|Pasaje|Cuesta|Vía)';

-- Verify after fix
SELECT address, count(*) 
FROM listings 
WHERE address ~ '^alquiler|^venta'
GROUP BY address;
