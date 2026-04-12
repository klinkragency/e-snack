-- Drop tables in reverse order of creation
DROP TABLE IF EXISTS delivery_assignments;
DROP TABLE IF EXISTS driver_status;
DROP TABLE IF EXISTS driver_locations;

-- Remove driver_id from orders
DROP INDEX IF EXISTS idx_orders_driver_id;
ALTER TABLE orders DROP COLUMN IF EXISTS driver_id;
