-- Script to update location names to proper city names for weather API compatibility
-- The OpenWeatherMap API requires city names, not country names or generic names

-- First, let's see what locations exist
SELECT id, name, city, type, latitude, longitude FROM locations ORDER BY name;

-- Update locations with proper city names based on their coordinates
-- You should update these based on your actual data

-- Example updates (customize based on your actual locations):

-- If you have a location named "France", update it to the actual city
-- UPDATE locations SET name = 'Paris Warehouse', city = 'Paris' WHERE name = 'France' AND type = 'warehouse';

-- If you have generic names, update them to include the city
-- UPDATE locations SET city = 'Chicago' WHERE name LIKE '%Chicago%' AND city IS NULL;
-- UPDATE locations SET city = 'Miami' WHERE name LIKE '%Miami%' AND city IS NULL;
-- UPDATE locations SET city = 'Denver' WHERE name LIKE '%Denver%' AND city IS NULL;

-- Common European locations - update to proper city names
-- UPDATE locations SET city = 'Paris' WHERE name LIKE '%France%' OR name LIKE '%Paris%';
-- UPDATE locations SET city = 'London' WHERE name LIKE '%UK%' OR name LIKE '%London%';
-- UPDATE locations SET city = 'Berlin' WHERE name LIKE '%Germany%' OR name LIKE '%Berlin%';

-- After updating, verify the changes
-- SELECT id, name, city, type FROM locations ORDER BY name;

-- IMPORTANT: The WeatherCard component uses the location 'name' field to fetch weather
-- Make sure your location names are actual city names that OpenWeatherMap can recognize:
-- - "Chicago Hub" -> Weather API will try "Chicago Hub" which won't work well
-- - Better to use: name = "Chicago Hub", city = "Chicago" and update WeatherCard to use city field

-- Alternative approach: Update location names to be recognizable by weather API
-- Examples of good location names for weather API:
-- - "Chicago" (not "Chicago Hub")
-- - "Miami" (not "Miami Warehouse")
-- - "Paris" (not "France")
-- - "Denver" (not "Denver Distribution")

-- To fix weather API, either:
-- 1. Update location names to be just city names
-- 2. Or add a 'city' column and update WeatherCard to use location.city instead of location.name

-- Here are some suggested updates (uncomment and modify as needed):
/*
UPDATE locations SET
  name = 'Chicago',
  city = 'Chicago'
WHERE name ILIKE '%chicago%';

UPDATE locations SET
  name = 'Miami',
  city = 'Miami'
WHERE name ILIKE '%miami%';

UPDATE locations SET
  name = 'Denver',
  city = 'Denver'
WHERE name ILIKE '%denver%';

UPDATE locations SET
  name = 'Paris',
  city = 'Paris'
WHERE name ILIKE '%france%' OR name ILIKE '%paris%';
*/
