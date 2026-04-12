-- Restore single-pending-assignment-per-order constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_assignment_per_order
  ON delivery_assignments (order_id)
  WHERE status = 'pending';
