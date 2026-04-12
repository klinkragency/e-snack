-- Speed up expired assignment cleanup queries
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_expires_at
  ON delivery_assignments(expires_at)
  WHERE status = 'pending';

-- Speed up last-seen driver queries for admin dashboards
CREATE INDEX IF NOT EXISTS idx_driver_status_last_seen_at
  ON driver_status(last_seen_at DESC NULLS LAST);

-- Speed up order+status lookups (used by GetAssignmentByOrder, status filters)
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order_status
  ON delivery_assignments(order_id, status);
