-- Add new columns to inventory table for Smart Order Dispatch system

-- Add price_per_unit column (required, defaults to 0)
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS price_per_unit DECIMAL(10, 2) DEFAULT 0 NOT NULL;

-- Add max_discount column (required, defaults to 20)
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS max_discount INTEGER DEFAULT 20 NOT NULL;

-- Add discount tier 1 columns (optional)
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS discount_tier_1_qty INTEGER DEFAULT 0;

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS discount_tier_1_percent INTEGER DEFAULT 0;

-- Add discount tier 2 columns (optional)
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS discount_tier_2_qty INTEGER DEFAULT 0;

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS discount_tier_2_percent INTEGER DEFAULT 0;

-- Add discount tier 3 columns (optional)
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS discount_tier_3_qty INTEGER DEFAULT 0;

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS discount_tier_3_percent INTEGER DEFAULT 0;

-- Update existing rows to have default values for the new columns
UPDATE inventory
SET
  price_per_unit = 0,
  max_discount = 20,
  discount_tier_1_qty = 0,
  discount_tier_1_percent = 0,
  discount_tier_2_qty = 0,
  discount_tier_2_percent = 0,
  discount_tier_3_qty = 0,
  discount_tier_3_percent = 0
WHERE price_per_unit IS NULL;

-- Add check constraint to ensure discount percentages don't exceed max_discount
ALTER TABLE inventory
ADD CONSTRAINT check_discount_tier_1 CHECK (discount_tier_1_percent <= max_discount);

ALTER TABLE inventory
ADD CONSTRAINT check_discount_tier_2 CHECK (discount_tier_2_percent <= max_discount);

ALTER TABLE inventory
ADD CONSTRAINT check_discount_tier_3 CHECK (discount_tier_3_percent <= max_discount);

-- Add check constraint to ensure max_discount doesn't exceed 20%
ALTER TABLE inventory
ADD CONSTRAINT check_max_discount CHECK (max_discount <= 20);
