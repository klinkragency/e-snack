-- Add 'cancelled' status to delivery_assignments
-- Used when admin unassigns a driver from an order
ALTER TABLE delivery_assignments DROP CONSTRAINT IF EXISTS delivery_assignments_status_check;
ALTER TABLE delivery_assignments ADD CONSTRAINT delivery_assignments_status_check
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'completed', 'cancelled'));
