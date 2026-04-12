ALTER TABLE restaurants
  DROP COLUMN IF EXISTS delivery_fee,
  DROP COLUMN IF EXISTS delivery_time_min,
  DROP COLUMN IF EXISTS delivery_time_max;
