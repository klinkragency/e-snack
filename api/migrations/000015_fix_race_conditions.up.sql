-- Prevent multiple pending driver assignments for the same order
-- Only one driver can have a "pending" assignment per order at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_assignment_per_order
  ON delivery_assignments (order_id)
  WHERE status = 'pending';

-- Prevent duplicate promo usage records per order
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_promo_usage_per_order
  ON promo_usage (order_id)
  WHERE order_id IS NOT NULL;
