package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/lib/pq"

	"github.com/beldys/api/internal/repository"
)

// ErrDuplicateAssignment is returned when a unique constraint is violated during assignment creation.
var ErrDuplicateAssignment = errors.New("assignment already exists for this order")

type driverRepository struct {
	db *sql.DB
}

func NewDriverRepository(db *sql.DB) repository.DriverRepository {
	return &driverRepository{db: db}
}

// ─── Location ───

func (r *driverRepository) UpdateLocation(ctx context.Context, loc *repository.DriverLocation) error {
	query := `
		INSERT INTO driver_locations (driver_id, lat, lng, heading, speed, accuracy, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (driver_id) DO UPDATE SET
			lat = EXCLUDED.lat,
			lng = EXCLUDED.lng,
			heading = EXCLUDED.heading,
			speed = EXCLUDED.speed,
			accuracy = EXCLUDED.accuracy,
			updated_at = NOW()
		RETURNING updated_at
	`

	return r.db.QueryRowContext(ctx, query,
		loc.DriverID, loc.Lat, loc.Lng, loc.Heading, loc.Speed, loc.Accuracy,
	).Scan(&loc.UpdatedAt)
}

func (r *driverRepository) GetLocation(ctx context.Context, driverID string) (*repository.DriverLocation, error) {
	query := `
		SELECT driver_id, lat, lng, heading, speed, accuracy, updated_at
		FROM driver_locations WHERE driver_id = $1
	`

	loc := &repository.DriverLocation{}
	err := r.db.QueryRowContext(ctx, query, driverID).Scan(
		&loc.DriverID, &loc.Lat, &loc.Lng, &loc.Heading, &loc.Speed, &loc.Accuracy, &loc.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return loc, err
}

func (r *driverRepository) GetLocationByOrderID(ctx context.Context, orderID string) (*repository.DriverLocation, error) {
	query := `
		SELECT dl.driver_id, dl.lat, dl.lng, dl.heading, dl.speed, dl.accuracy, dl.updated_at
		FROM driver_locations dl
		JOIN orders o ON o.driver_id = dl.driver_id
		WHERE o.id = $1
	`

	loc := &repository.DriverLocation{}
	err := r.db.QueryRowContext(ctx, query, orderID).Scan(
		&loc.DriverID, &loc.Lat, &loc.Lng, &loc.Heading, &loc.Speed, &loc.Accuracy, &loc.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return loc, err
}

// ─── Status ───

func (r *driverRepository) GetStatus(ctx context.Context, driverID string) (*repository.DriverStatus, error) {
	query := `
		SELECT driver_id, status, current_order_id, phone, telegram_chat_id, last_seen_at, created_at, updated_at
		FROM driver_status WHERE driver_id = $1
	`

	status := &repository.DriverStatus{}
	err := r.db.QueryRowContext(ctx, query, driverID).Scan(
		&status.DriverID, &status.Status, &status.CurrentOrderID, &status.Phone,
		&status.TelegramChatID, &status.LastSeenAt, &status.CreatedAt, &status.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return status, err
}

func (r *driverRepository) UpsertStatus(ctx context.Context, status *repository.DriverStatus) error {
	query := `
		INSERT INTO driver_status (driver_id, status, current_order_id, phone, last_seen_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		ON CONFLICT (driver_id) DO UPDATE SET
			status = EXCLUDED.status,
			current_order_id = EXCLUDED.current_order_id,
			phone = EXCLUDED.phone,
			last_seen_at = NOW(),
			updated_at = NOW()
		RETURNING last_seen_at, created_at, updated_at
	`

	return r.db.QueryRowContext(ctx, query,
		status.DriverID, status.Status, status.CurrentOrderID, status.Phone,
	).Scan(&status.LastSeenAt, &status.CreatedAt, &status.UpdatedAt)
}

func (r *driverRepository) SetAvailability(ctx context.Context, driverID, status string) error {
	query := `
		INSERT INTO driver_status (driver_id, status, last_seen_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (driver_id) DO UPDATE SET
			status = $2,
			last_seen_at = NOW(),
			updated_at = NOW()
	`

	_, err := r.db.ExecContext(ctx, query, driverID, status)
	return err
}

func (r *driverRepository) ListDriversByStatus(ctx context.Context, status string, page, pageSize int) ([]*repository.DriverStatus, int, error) {
	countQuery := `SELECT COUNT(*) FROM driver_status`
	args := []interface{}{}

	if status != "" {
		countQuery += ` WHERE status = $1`
		args = append(args, status)
	}

	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	listQuery := `
		SELECT driver_id, status, current_order_id, phone, last_seen_at, created_at, updated_at
		FROM driver_status
	`

	if status != "" {
		listQuery += ` WHERE status = $1`
	}
	listQuery += ` ORDER BY last_seen_at DESC`

	if page > 0 && pageSize > 0 {
		offset := (page - 1) * pageSize
		if status != "" {
			listQuery += ` LIMIT $2 OFFSET $3`
			args = append(args, pageSize, offset)
		} else {
			listQuery += ` LIMIT $1 OFFSET $2`
			args = append(args, pageSize, offset)
		}
	}

	rows, err := r.db.QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var statuses []*repository.DriverStatus
	for rows.Next() {
		s := &repository.DriverStatus{}
		if err := rows.Scan(
			&s.DriverID, &s.Status, &s.CurrentOrderID, &s.Phone,
			&s.LastSeenAt, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		statuses = append(statuses, s)
	}

	return statuses, total, rows.Err()
}

// ─── Assignments ───

func (r *driverRepository) CreateAssignment(ctx context.Context, assignment *repository.DeliveryAssignment) error {
	query := `
		INSERT INTO delivery_assignments (order_id, driver_id, status, expires_at, notes)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, assigned_at
	`

	err := r.db.QueryRowContext(ctx, query,
		assignment.OrderID, assignment.DriverID, assignment.Status, assignment.ExpiresAt, assignment.Notes,
	).Scan(&assignment.ID, &assignment.AssignedAt)
	if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
		return ErrDuplicateAssignment
	}
	return err
}

func (r *driverRepository) GetAssignment(ctx context.Context, id string) (*repository.DeliveryAssignment, error) {
	query := `
		SELECT id, order_id, driver_id, status, assigned_at, responded_at, expires_at, completed_at, notes
		FROM delivery_assignments WHERE id = $1
	`

	a := &repository.DeliveryAssignment{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&a.ID, &a.OrderID, &a.DriverID, &a.Status, &a.AssignedAt,
		&a.RespondedAt, &a.ExpiresAt, &a.CompletedAt, &a.Notes,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return a, err
}

func (r *driverRepository) GetAssignmentByOrderAndDriver(ctx context.Context, orderID, driverID string) (*repository.DeliveryAssignment, error) {
	query := `
		SELECT id, order_id, driver_id, status, assigned_at, responded_at, expires_at, completed_at, notes
		FROM delivery_assignments WHERE order_id = $1 AND driver_id = $2
	`

	a := &repository.DeliveryAssignment{}
	err := r.db.QueryRowContext(ctx, query, orderID, driverID).Scan(
		&a.ID, &a.OrderID, &a.DriverID, &a.Status, &a.AssignedAt,
		&a.RespondedAt, &a.ExpiresAt, &a.CompletedAt, &a.Notes,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return a, err
}

func (r *driverRepository) ListAssignmentsByDriver(ctx context.Context, driverID string, status string) ([]*repository.DeliveryAssignment, error) {
	query := `
		SELECT id, order_id, driver_id, status, assigned_at, responded_at, expires_at, completed_at, notes
		FROM delivery_assignments WHERE driver_id = $1
	`
	args := []interface{}{driverID}

	if status != "" {
		query += ` AND status = $2`
		args = append(args, status)
	}
	query += ` ORDER BY assigned_at DESC`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var assignments []*repository.DeliveryAssignment
	for rows.Next() {
		a := &repository.DeliveryAssignment{}
		if err := rows.Scan(
			&a.ID, &a.OrderID, &a.DriverID, &a.Status, &a.AssignedAt,
			&a.RespondedAt, &a.ExpiresAt, &a.CompletedAt, &a.Notes,
		); err != nil {
			return nil, err
		}
		assignments = append(assignments, a)
	}

	return assignments, rows.Err()
}

func (r *driverRepository) ListAssignmentsByOrder(ctx context.Context, orderID string) ([]*repository.DeliveryAssignment, error) {
	query := `
		SELECT id, order_id, driver_id, status, assigned_at, responded_at, expires_at, completed_at, notes
		FROM delivery_assignments WHERE order_id = $1
		ORDER BY assigned_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var assignments []*repository.DeliveryAssignment
	for rows.Next() {
		a := &repository.DeliveryAssignment{}
		if err := rows.Scan(
			&a.ID, &a.OrderID, &a.DriverID, &a.Status, &a.AssignedAt,
			&a.RespondedAt, &a.ExpiresAt, &a.CompletedAt, &a.Notes,
		); err != nil {
			return nil, err
		}
		assignments = append(assignments, a)
	}

	return assignments, rows.Err()
}

func (r *driverRepository) UpdateAssignmentStatus(ctx context.Context, id, status string, notes *string) error {
	query := `
		UPDATE delivery_assignments
		SET status = $2, responded_at = NOW(), notes = COALESCE($3, notes)
		WHERE id = $1
	`

	result, err := r.db.ExecContext(ctx, query, id, status, notes)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// CancelOtherPendingAssignments cancels all pending assignments for an order except the accepted one.
// Called after a driver accepts so other competing drivers receive a "cancelled" state.
func (r *driverRepository) CancelOtherPendingAssignments(ctx context.Context, orderID, acceptedAssignmentID string) error {
	query := `
		UPDATE delivery_assignments
		SET status = 'cancelled', responded_at = NOW(), notes = 'Commande assignée à un autre livreur'
		WHERE order_id = $1 AND id != $2 AND status = 'pending'
	`
	_, err := r.db.ExecContext(ctx, query, orderID, acceptedAssignmentID)
	return err
}

func (r *driverRepository) ResetAssignment(ctx context.Context, id string, expiresAt time.Time) error {
	query := `
		UPDATE delivery_assignments
		SET status = 'pending', responded_at = NULL, completed_at = NULL, notes = NULL,
			assigned_at = NOW(), expires_at = $2
		WHERE id = $1
	`

	result, err := r.db.ExecContext(ctx, query, id, expiresAt)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *driverRepository) CompleteAssignment(ctx context.Context, id string) error {
	query := `
		UPDATE delivery_assignments
		SET status = 'completed', completed_at = NOW()
		WHERE id = $1
	`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *driverRepository) ExpireOldAssignments(ctx context.Context) (int, error) {
	query := `
		UPDATE delivery_assignments
		SET status = 'expired'
		WHERE status = 'pending' AND expires_at < NOW()
	`

	result, err := r.db.ExecContext(ctx, query)
	if err != nil {
		return 0, err
	}

	rowsAffected, _ := result.RowsAffected()
	return int(rowsAffected), nil
}

// ─── Order-Driver linking ───

func (r *driverRepository) AssignDriverToOrder(ctx context.Context, orderID, driverID string) error {
	query := `UPDATE orders SET driver_id = $2, updated_at = NOW() WHERE id = $1`

	result, err := r.db.ExecContext(ctx, query, orderID, driverID)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *driverRepository) UnassignDriverFromOrder(ctx context.Context, orderID string) error {
	query := `UPDATE orders SET driver_id = NULL, updated_at = NOW() WHERE id = $1`

	result, err := r.db.ExecContext(ctx, query, orderID)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *driverRepository) GetOrderDriver(ctx context.Context, orderID string) (*string, error) {
	query := `SELECT driver_id FROM orders WHERE id = $1`

	var driverID *string
	err := r.db.QueryRowContext(ctx, query, orderID).Scan(&driverID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return driverID, err
}

// ─── Admin queries ───

func (r *driverRepository) ListDriversWithDetails(ctx context.Context, status string, page, pageSize int) ([]*repository.User, []*repository.DriverStatus, []*repository.DriverLocation, int, error) {
	countQuery := `
		SELECT COUNT(*) FROM users u
		LEFT JOIN driver_status ds ON ds.driver_id = u.id
		WHERE u.role = 'livreur'
	`
	args := []interface{}{}

	if status != "" {
		countQuery += ` AND ds.status = $1`
		args = append(args, status)
	}

	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, nil, nil, 0, err
	}

	listQuery := `
		SELECT
			u.id, u.email, u.name, u.phone, u.created_at,
			ds.driver_id, ds.status, ds.current_order_id, ds.phone as ds_phone, ds.last_seen_at, ds.created_at as ds_created_at, ds.updated_at as ds_updated_at,
			dl.driver_id as dl_driver_id, dl.lat, dl.lng, dl.heading, dl.speed, dl.accuracy, dl.updated_at as dl_updated_at
		FROM users u
		LEFT JOIN driver_status ds ON ds.driver_id = u.id
		LEFT JOIN driver_locations dl ON dl.driver_id = u.id
		WHERE u.role = 'livreur'
	`

	if status != "" {
		listQuery += ` AND ds.status = $1`
	}
	listQuery += ` ORDER BY ds.last_seen_at DESC NULLS LAST`

	offset := (page - 1) * pageSize
	if status != "" {
		listQuery += ` LIMIT $2 OFFSET $3`
		args = append(args, pageSize, offset)
	} else {
		listQuery += ` LIMIT $1 OFFSET $2`
		args = append(args, pageSize, offset)
	}

	rows, err := r.db.QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, nil, nil, 0, err
	}
	defer rows.Close()

	var users []*repository.User
	var statuses []*repository.DriverStatus
	var locations []*repository.DriverLocation

	for rows.Next() {
		u := &repository.User{}
		ds := &repository.DriverStatus{}
		dl := &repository.DriverLocation{}

		var dsDriverID, dlDriverID sql.NullString
		var dsStatus, dsPhone sql.NullString
		var dsCurrentOrderID sql.NullString
		var dsLastSeenAt, dsCreatedAt, dsUpdatedAt sql.NullTime
		var dlLat, dlLng sql.NullFloat64
		var dlHeading, dlSpeed, dlAccuracy sql.NullFloat64
		var dlUpdatedAt sql.NullTime

		if err := rows.Scan(
			&u.ID, &u.Email, &u.Name, &u.Phone, &u.CreatedAt,
			&dsDriverID, &dsStatus, &dsCurrentOrderID, &dsPhone, &dsLastSeenAt, &dsCreatedAt, &dsUpdatedAt,
			&dlDriverID, &dlLat, &dlLng, &dlHeading, &dlSpeed, &dlAccuracy, &dlUpdatedAt,
		); err != nil {
			return nil, nil, nil, 0, err
		}

		users = append(users, u)

		if dsDriverID.Valid {
			ds.DriverID = dsDriverID.String
			ds.Status = dsStatus.String
			if dsCurrentOrderID.Valid {
				ds.CurrentOrderID = &dsCurrentOrderID.String
			}
			if dsPhone.Valid {
				ds.Phone = &dsPhone.String
			}
			ds.LastSeenAt = dsLastSeenAt.Time
			ds.CreatedAt = dsCreatedAt.Time
			ds.UpdatedAt = dsUpdatedAt.Time
			statuses = append(statuses, ds)
		} else {
			statuses = append(statuses, nil)
		}

		if dlDriverID.Valid {
			dl.DriverID = dlDriverID.String
			dl.Lat = dlLat.Float64
			dl.Lng = dlLng.Float64
			if dlHeading.Valid {
				dl.Heading = &dlHeading.Float64
			}
			if dlSpeed.Valid {
				dl.Speed = &dlSpeed.Float64
			}
			if dlAccuracy.Valid {
				dl.Accuracy = &dlAccuracy.Float64
			}
			dl.UpdatedAt = dlUpdatedAt.Time
			locations = append(locations, dl)
		} else {
			locations = append(locations, nil)
		}
	}

	return users, statuses, locations, total, rows.Err()
}

func (r *driverRepository) ListNearbyDrivers(ctx context.Context, lat, lng, radiusKm float64) ([]*repository.User, []*repository.DriverStatus, []*repository.DriverLocation, error) {
	// Haversine formula for distance calculation
	query := `
		SELECT
			u.id, u.email, u.name, u.phone, u.created_at,
			ds.driver_id, ds.status, ds.current_order_id, ds.phone as ds_phone, ds.last_seen_at, ds.created_at as ds_created_at, ds.updated_at as ds_updated_at,
			dl.driver_id as dl_driver_id, dl.lat, dl.lng, dl.heading, dl.speed, dl.accuracy, dl.updated_at as dl_updated_at,
			(6371 * acos(cos(radians($1)) * cos(radians(dl.lat)) * cos(radians(dl.lng) - radians($2)) + sin(radians($1)) * sin(radians(dl.lat)))) AS distance_km
		FROM users u
		JOIN driver_status ds ON ds.driver_id = u.id
		JOIN driver_locations dl ON dl.driver_id = u.id
		WHERE u.role = 'livreur' AND ds.status = 'available'
		HAVING (6371 * acos(cos(radians($1)) * cos(radians(dl.lat)) * cos(radians(dl.lng) - radians($2)) + sin(radians($1)) * sin(radians(dl.lat)))) < $3
		ORDER BY distance_km ASC
	`

	rows, err := r.db.QueryContext(ctx, query, lat, lng, radiusKm)
	if err != nil {
		return nil, nil, nil, err
	}
	defer rows.Close()

	var users []*repository.User
	var statuses []*repository.DriverStatus
	var locations []*repository.DriverLocation

	for rows.Next() {
		u := &repository.User{}
		ds := &repository.DriverStatus{}
		dl := &repository.DriverLocation{}
		var distanceKm float64

		var dsCurrentOrderID sql.NullString
		var dsPhone sql.NullString
		var dlHeading, dlSpeed, dlAccuracy sql.NullFloat64

		if err := rows.Scan(
			&u.ID, &u.Email, &u.Name, &u.Phone, &u.CreatedAt,
			&ds.DriverID, &ds.Status, &dsCurrentOrderID, &dsPhone, &ds.LastSeenAt, &ds.CreatedAt, &ds.UpdatedAt,
			&dl.DriverID, &dl.Lat, &dl.Lng, &dlHeading, &dlSpeed, &dlAccuracy, &dl.UpdatedAt,
			&distanceKm,
		); err != nil {
			return nil, nil, nil, err
		}

		if dsCurrentOrderID.Valid {
			ds.CurrentOrderID = &dsCurrentOrderID.String
		}
		if dsPhone.Valid {
			ds.Phone = &dsPhone.String
		}
		if dlHeading.Valid {
			dl.Heading = &dlHeading.Float64
		}
		if dlSpeed.Valid {
			dl.Speed = &dlSpeed.Float64
		}
		if dlAccuracy.Valid {
			dl.Accuracy = &dlAccuracy.Float64
		}

		users = append(users, u)
		statuses = append(statuses, ds)
		locations = append(locations, dl)
	}

	return users, statuses, locations, rows.Err()
}

// ─── Stats ───

func (r *driverRepository) CountDeliveriesToday(ctx context.Context, driverID string) (int, error) {
	query := `
		SELECT COUNT(*) FROM delivery_assignments
		WHERE driver_id = $1 AND status = 'completed'
		AND assigned_at >= CURRENT_DATE
	`

	var count int
	err := r.db.QueryRowContext(ctx, query, driverID).Scan(&count)
	return count, err
}

func (r *driverRepository) CountDeliveriesTotal(ctx context.Context, driverID string) (int, error) {
	query := `
		SELECT COUNT(*) FROM delivery_assignments
		WHERE driver_id = $1 AND status = 'completed'
	`

	var count int
	err := r.db.QueryRowContext(ctx, query, driverID).Scan(&count)
	return count, err
}

// GetBatchDriverStats returns delivery counts and hours worked for multiple drivers in a single query.
func (r *driverRepository) GetBatchDriverStats(ctx context.Context, driverIDs []string) (map[string]repository.DriverStatsBatch, error) {
	result := make(map[string]repository.DriverStatsBatch, len(driverIDs))
	if len(driverIDs) == 0 {
		return result, nil
	}

	// Build a UUID array literal from driver IDs
	query := `
		WITH ids AS (
			SELECT unnest($1::uuid[]) AS driver_id
		),
		delivery_stats AS (
			SELECT
				driver_id,
				COUNT(*) FILTER (WHERE status = 'completed' AND assigned_at >= CURRENT_DATE) AS deliveries_today,
				COUNT(*) FILTER (WHERE status = 'completed') AS deliveries_total
			FROM delivery_assignments
			WHERE driver_id = ANY($1::uuid[])
			GROUP BY driver_id
		),
		hour_stats AS (
			SELECT
				driver_id,
				COALESCE(
					EXTRACT(EPOCH FROM SUM(
						COALESCE(ended_at, NOW()) - GREATEST(started_at, CURRENT_DATE::timestamptz)
					)) / 3600.0,
					0
				) AS hours_today
			FROM availability_log
			WHERE driver_id = ANY($1::uuid[])
			  AND status IN ('available', 'on_delivery')
			  AND COALESCE(ended_at, NOW()) > CURRENT_DATE::timestamptz
			  AND started_at < NOW()
			GROUP BY driver_id
		)
		SELECT
			ids.driver_id::text,
			COALESCE(ds.deliveries_today, 0),
			COALESCE(ds.deliveries_total, 0),
			COALESCE(hs.hours_today, 0)
		FROM ids
		LEFT JOIN delivery_stats ds ON ds.driver_id = ids.driver_id
		LEFT JOIN hour_stats hs ON hs.driver_id = ids.driver_id
	`

	// Convert []string to pq.Array for the ANY($1::uuid[]) param
	rows, err := r.db.QueryContext(ctx, query, pq.Array(driverIDs))
	if err != nil {
		return result, err
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		var s repository.DriverStatsBatch
		if err := rows.Scan(&id, &s.DeliveriesToday, &s.DeliveriesTotal, &s.HoursWorkedToday); err != nil {
			continue
		}
		result[id] = s
	}
	return result, rows.Err()
}



func (r *driverRepository) LogAvailabilityChange(ctx context.Context, driverID, newStatus string) error {
	// Close the previous open interval
	closeQuery := `
		UPDATE availability_log SET ended_at = NOW()
		WHERE driver_id = $1 AND ended_at IS NULL
	`
	if _, err := r.db.ExecContext(ctx, closeQuery, driverID); err != nil {
		return err
	}

	// Insert a new open interval
	insertQuery := `
		INSERT INTO availability_log (driver_id, status, started_at)
		VALUES ($1, $2, NOW())
	`
	_, err := r.db.ExecContext(ctx, insertQuery, driverID, newStatus)
	return err
}

func (r *driverRepository) GetHoursWorkedToday(ctx context.Context, driverID string) (float64, error) {
	query := `
		SELECT COALESCE(
			EXTRACT(EPOCH FROM SUM(
				COALESCE(ended_at, NOW()) - GREATEST(started_at, CURRENT_DATE::timestamptz)
			)) / 3600.0,
			0
		)
		FROM availability_log
		WHERE driver_id = $1
		  AND status IN ('available', 'on_delivery')
		  AND COALESCE(ended_at, NOW()) > CURRENT_DATE::timestamptz
		  AND started_at < NOW()
	`

	var hours float64
	err := r.db.QueryRowContext(ctx, query, driverID).Scan(&hours)
	return hours, err
}

func (r *driverRepository) GetDailyWorkSummary(ctx context.Context, driverID string, from, to time.Time) ([]repository.DailyWorkEntry, error) {
	// effective_end: if the session is still open (ended_at IS NULL), cap it at:
	//   - NOW()              for sessions that started today (currently active)
	//   - midnight of start day  for older sessions that were never properly closed
	// This prevents a stale open session from contributing 24h to every historical day.
	query := `
		WITH days AS (
			SELECT generate_series($2::date, $3::date, '1 day')::date AS day
		),
		log_capped AS (
			SELECT driver_id, status, started_at,
				COALESCE(
					ended_at,
					CASE
						WHEN started_at::date >= CURRENT_DATE THEN NOW()
						ELSE (started_at::date + interval '1 day')::timestamptz
					END
				) AS effective_end
			FROM availability_log
			WHERE driver_id = $1
			  AND status IN ('available', 'on_delivery')
		)
		SELECT d.day,
			COALESCE(
				EXTRACT(EPOCH FROM SUM(
					CASE WHEN lc.started_at IS NOT NULL THEN
						LEAST(lc.effective_end, (d.day + interval '1 day')::timestamptz)
						- GREATEST(lc.started_at, d.day::timestamptz)
					END
				)) / 3600.0,
				0
			) AS hours
		FROM days d
		LEFT JOIN log_capped lc
			ON lc.started_at < (d.day + interval '1 day')::timestamptz
			AND lc.effective_end > d.day::timestamptz
		GROUP BY d.day
		ORDER BY d.day
	`

	rows, err := r.db.QueryContext(ctx, query, driverID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []repository.DailyWorkEntry
	for rows.Next() {
		var e repository.DailyWorkEntry
		if err := rows.Scan(&e.Date, &e.Hours); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

func (r *driverRepository) GetDailyDeliveryCounts(ctx context.Context, driverID string, from, to time.Time) ([]repository.DailyDeliveryCount, error) {
	query := `
		WITH days AS (
			SELECT generate_series($2::date, $3::date, '1 day')::date AS day
		)
		SELECT d.day, COUNT(da.id)::int AS cnt
		FROM days d
		LEFT JOIN delivery_assignments da
			ON da.driver_id = $1
			AND da.status = 'completed'
			AND DATE(da.completed_at) = d.day
		GROUP BY d.day
		ORDER BY d.day
	`

	rows, err := r.db.QueryContext(ctx, query, driverID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var counts []repository.DailyDeliveryCount
	for rows.Next() {
		var c repository.DailyDeliveryCount
		if err := rows.Scan(&c.Date, &c.Count); err != nil {
			return nil, err
		}
		counts = append(counts, c)
	}
	return counts, rows.Err()
}

// ─── Telegram ───

func (r *driverRepository) SetTelegramChatID(ctx context.Context, driverID string, chatID int64) error {
	query := `
		INSERT INTO driver_status (driver_id, status, telegram_chat_id)
		VALUES ($1, 'offline', $2)
		ON CONFLICT (driver_id) DO UPDATE SET
			telegram_chat_id = $2,
			updated_at = NOW()
	`

	_, err := r.db.ExecContext(ctx, query, driverID, chatID)
	return err
}

func (r *driverRepository) GetDriverByTelegramChatID(ctx context.Context, chatID int64) (*repository.DriverStatus, error) {
	query := `
		SELECT driver_id, status, current_order_id, phone, telegram_chat_id, last_seen_at, created_at, updated_at
		FROM driver_status WHERE telegram_chat_id = $1
	`

	status := &repository.DriverStatus{}
	err := r.db.QueryRowContext(ctx, query, chatID).Scan(
		&status.DriverID, &status.Status, &status.CurrentOrderID, &status.Phone,
		&status.TelegramChatID, &status.LastSeenAt, &status.CreatedAt, &status.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return status, err
}

func (r *driverRepository) RemoveTelegramChatID(ctx context.Context, driverID string) error {
	query := `UPDATE driver_status SET telegram_chat_id = NULL, updated_at = NOW() WHERE driver_id = $1`

	_, err := r.db.ExecContext(ctx, query, driverID)
	return err
}

// ─── Telegram Linking Codes ───

func (r *driverRepository) CreateTelegramLinkCode(ctx context.Context, code, driverID string, expiresAt time.Time) error {
	// First delete any existing unused codes for this driver
	deleteQuery := `DELETE FROM telegram_linking_codes WHERE driver_id = $1 AND used_at IS NULL`
	r.db.ExecContext(ctx, deleteQuery, driverID)

	query := `INSERT INTO telegram_linking_codes (code, driver_id, expires_at) VALUES ($1, $2, $3)`
	_, err := r.db.ExecContext(ctx, query, code, driverID, expiresAt)
	return err
}

func (r *driverRepository) GetTelegramLinkCode(ctx context.Context, code string) (string, error) {
	query := `
		SELECT driver_id FROM telegram_linking_codes
		WHERE code = $1 AND used_at IS NULL AND expires_at > NOW()
	`

	var driverID string
	err := r.db.QueryRowContext(ctx, query, code).Scan(&driverID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	return driverID, err
}

func (r *driverRepository) MarkTelegramLinkCodeUsed(ctx context.Context, code string) error {
	query := `UPDATE telegram_linking_codes SET used_at = NOW() WHERE code = $1`
	_, err := r.db.ExecContext(ctx, query, code)
	return err
}

func (r *driverRepository) DeleteExpiredTelegramLinkCodes(ctx context.Context) (int, error) {
	query := `DELETE FROM telegram_linking_codes WHERE expires_at < NOW() OR used_at IS NOT NULL`
	result, err := r.db.ExecContext(ctx, query)
	if err != nil {
		return 0, err
	}
	rowsAffected, _ := result.RowsAffected()
	return int(rowsAffected), nil
}
