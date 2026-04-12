ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

-- Initialize positions based on created_at ASC (oldest first = lowest position)
UPDATE restaurants r
SET position = sub.rn - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn FROM restaurants
) sub
WHERE r.id = sub.id;
