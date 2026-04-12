-- Allow multiple pending driver assignments per order
-- (first driver to accept wins; AcceptDelivery cancels the others)
DROP INDEX IF EXISTS idx_unique_pending_assignment_per_order;
