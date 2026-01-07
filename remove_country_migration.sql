-- Remove country column from locations table
ALTER TABLE locations DROP COLUMN IF EXISTS country;

-- Remove country column from inventory table
ALTER TABLE inventory DROP COLUMN IF EXISTS country;
