package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/klinkragency/e-snack/internal/repository"
)

var ErrUserPromoNotFound = errors.New("user promo code not found")

type userPromoRepository struct {
	db *sql.DB
}

func NewUserPromoRepository(db *sql.DB) repository.UserPromoCodeRepository {
	return &userPromoRepository{db: db}
}

func (r *userPromoRepository) Create(ctx context.Context, upc *repository.UserPromoCode) error {
	query := `
		INSERT INTO user_promo_codes (promo_code_id, user_id, status, assigned_by, expires_at, notes)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, assigned_at, created_at, updated_at
	`

	status := upc.Status
	if status == "" {
		status = "assigned"
	}

	return r.db.QueryRowContext(
		ctx,
		query,
		upc.PromoCodeID,
		upc.UserID,
		status,
		upc.AssignedBy,
		upc.ExpiresAt,
		upc.Notes,
	).Scan(&upc.ID, &upc.AssignedAt, &upc.CreatedAt, &upc.UpdatedAt)
}

func (r *userPromoRepository) GetByID(ctx context.Context, id string) (*repository.UserPromoCode, error) {
	query := `
		SELECT upc.id, upc.promo_code_id, upc.user_id, u.email, u.name, upc.status,
		       upc.assigned_by, upc.assigned_at, upc.claimed_at, upc.used_at, upc.used_order_id,
		       upc.revoked_at, upc.revoked_by, upc.revoked_reason, upc.expires_at, upc.notes,
		       upc.created_at, upc.updated_at
		FROM user_promo_codes upc
		JOIN users u ON u.id = upc.user_id
		WHERE upc.id = $1
	`

	upc := &repository.UserPromoCode{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&upc.ID,
		&upc.PromoCodeID,
		&upc.UserID,
		&upc.UserEmail,
		&upc.UserName,
		&upc.Status,
		&upc.AssignedBy,
		&upc.AssignedAt,
		&upc.ClaimedAt,
		&upc.UsedAt,
		&upc.UsedOrderID,
		&upc.RevokedAt,
		&upc.RevokedBy,
		&upc.RevokedReason,
		&upc.ExpiresAt,
		&upc.Notes,
		&upc.CreatedAt,
		&upc.UpdatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrUserPromoNotFound
	}
	if err != nil {
		return nil, err
	}

	return upc, nil
}

func (r *userPromoRepository) GetByPromoAndUser(ctx context.Context, promoID, userID string) (*repository.UserPromoCode, error) {
	query := `
		SELECT upc.id, upc.promo_code_id, upc.user_id, u.email, u.name, upc.status,
		       upc.assigned_by, upc.assigned_at, upc.claimed_at, upc.used_at, upc.used_order_id,
		       upc.revoked_at, upc.revoked_by, upc.revoked_reason, upc.expires_at, upc.notes,
		       upc.created_at, upc.updated_at
		FROM user_promo_codes upc
		JOIN users u ON u.id = upc.user_id
		WHERE upc.promo_code_id = $1 AND upc.user_id = $2
	`

	upc := &repository.UserPromoCode{}
	err := r.db.QueryRowContext(ctx, query, promoID, userID).Scan(
		&upc.ID,
		&upc.PromoCodeID,
		&upc.UserID,
		&upc.UserEmail,
		&upc.UserName,
		&upc.Status,
		&upc.AssignedBy,
		&upc.AssignedAt,
		&upc.ClaimedAt,
		&upc.UsedAt,
		&upc.UsedOrderID,
		&upc.RevokedAt,
		&upc.RevokedBy,
		&upc.RevokedReason,
		&upc.ExpiresAt,
		&upc.Notes,
		&upc.CreatedAt,
		&upc.UpdatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrUserPromoNotFound
	}
	if err != nil {
		return nil, err
	}

	return upc, nil
}

func (r *userPromoRepository) Update(ctx context.Context, upc *repository.UserPromoCode) error {
	query := `
		UPDATE user_promo_codes
		SET status = $1, claimed_at = $2, used_at = $3, used_order_id = $4,
		    revoked_at = $5, revoked_by = $6, revoked_reason = $7, expires_at = $8,
		    notes = $9, updated_at = NOW()
		WHERE id = $10
		RETURNING updated_at
	`

	err := r.db.QueryRowContext(
		ctx,
		query,
		upc.Status,
		upc.ClaimedAt,
		upc.UsedAt,
		upc.UsedOrderID,
		upc.RevokedAt,
		upc.RevokedBy,
		upc.RevokedReason,
		upc.ExpiresAt,
		upc.Notes,
		upc.ID,
	).Scan(&upc.UpdatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		return ErrUserPromoNotFound
	}
	return err
}

func (r *userPromoRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM user_promo_codes WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrUserPromoNotFound
	}

	return nil
}

// ==================== Listing ====================

func (r *userPromoRepository) ListByPromo(ctx context.Context, promoID string, page, pageSize int, statusFilter string) ([]*repository.UserPromoCode, int, error) {
	offset := (page - 1) * pageSize

	conditions := []string{"upc.promo_code_id = $1"}
	args := []interface{}{promoID}
	argIndex := 2

	if statusFilter != "" && statusFilter != "all" {
		conditions = append(conditions, fmt.Sprintf("upc.status = $%d", argIndex))
		args = append(args, statusFilter)
		argIndex++
	}

	whereClause := "WHERE " + strings.Join(conditions, " AND ")

	// Count
	countQuery := "SELECT COUNT(*) FROM user_promo_codes upc " + whereClause
	var total int
	err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Data
	dataArgs := make([]interface{}, len(args))
	copy(dataArgs, args)
	dataArgs = append(dataArgs, pageSize, offset)

	query := fmt.Sprintf(`
		SELECT upc.id, upc.promo_code_id, upc.user_id, u.email, u.name, upc.status,
		       upc.assigned_by, upc.assigned_at, upc.claimed_at, upc.used_at, upc.used_order_id,
		       upc.revoked_at, upc.revoked_by, upc.revoked_reason, upc.expires_at, upc.notes,
		       upc.created_at, upc.updated_at
		FROM user_promo_codes upc
		JOIN users u ON u.id = upc.user_id
		%s
		ORDER BY upc.assigned_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIndex, argIndex+1)

	rows, err := r.db.QueryContext(ctx, query, dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []*repository.UserPromoCode
	for rows.Next() {
		upc := &repository.UserPromoCode{}
		err := rows.Scan(
			&upc.ID,
			&upc.PromoCodeID,
			&upc.UserID,
			&upc.UserEmail,
			&upc.UserName,
			&upc.Status,
			&upc.AssignedBy,
			&upc.AssignedAt,
			&upc.ClaimedAt,
			&upc.UsedAt,
			&upc.UsedOrderID,
			&upc.RevokedAt,
			&upc.RevokedBy,
			&upc.RevokedReason,
			&upc.ExpiresAt,
			&upc.Notes,
			&upc.CreatedAt,
			&upc.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		results = append(results, upc)
	}

	return results, total, nil
}

func (r *userPromoRepository) ListByUser(ctx context.Context, userID string, page, pageSize int, statusFilter string) ([]*repository.UserPromoCode, int, error) {
	offset := (page - 1) * pageSize

	conditions := []string{"upc.user_id = $1"}
	args := []interface{}{userID}
	argIndex := 2

	if statusFilter != "" && statusFilter != "all" {
		if statusFilter == "available" {
			// Available = assigned or claimed, not expired, not revoked, not used
			conditions = append(conditions, "upc.status IN ('assigned', 'claimed')")
			conditions = append(conditions, "(upc.expires_at IS NULL OR upc.expires_at > NOW())")
		} else {
			conditions = append(conditions, fmt.Sprintf("upc.status = $%d", argIndex))
			args = append(args, statusFilter)
			argIndex++
		}
	}

	whereClause := "WHERE " + strings.Join(conditions, " AND ")

	// Count
	countQuery := "SELECT COUNT(*) FROM user_promo_codes upc " + whereClause
	var total int
	err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Data with promo details
	dataArgs := make([]interface{}, len(args))
	copy(dataArgs, args)
	dataArgs = append(dataArgs, pageSize, offset)

	query := fmt.Sprintf(`
		SELECT upc.id, upc.promo_code_id, upc.user_id, u.email, u.name, upc.status,
		       upc.assigned_by, upc.assigned_at, upc.claimed_at, upc.used_at, upc.used_order_id,
		       upc.revoked_at, upc.revoked_by, upc.revoked_reason, upc.expires_at, upc.notes,
		       upc.created_at, upc.updated_at,
		       pc.id, pc.code, pc.discount_type, pc.discount_value, pc.min_order_amount,
		       pc.max_discount_amount, pc.first_order_only, pc.is_active, pc.description,
		       pc.starts_at, pc.expires_at
		FROM user_promo_codes upc
		JOIN users u ON u.id = upc.user_id
		JOIN promo_codes pc ON pc.id = upc.promo_code_id
		%s
		ORDER BY upc.assigned_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIndex, argIndex+1)

	rows, err := r.db.QueryContext(ctx, query, dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []*repository.UserPromoCode
	for rows.Next() {
		upc := &repository.UserPromoCode{}
		promo := &repository.PromoCode{}
		var promoMinOrder, promoMaxDiscount sql.NullFloat64
		var promoDescription sql.NullString
		var promoExpiresAt sql.NullTime

		err := rows.Scan(
			&upc.ID,
			&upc.PromoCodeID,
			&upc.UserID,
			&upc.UserEmail,
			&upc.UserName,
			&upc.Status,
			&upc.AssignedBy,
			&upc.AssignedAt,
			&upc.ClaimedAt,
			&upc.UsedAt,
			&upc.UsedOrderID,
			&upc.RevokedAt,
			&upc.RevokedBy,
			&upc.RevokedReason,
			&upc.ExpiresAt,
			&upc.Notes,
			&upc.CreatedAt,
			&upc.UpdatedAt,
			// Promo fields
			&promo.ID,
			&promo.Code,
			&promo.DiscountType,
			&promo.DiscountValue,
			&promoMinOrder,
			&promoMaxDiscount,
			&promo.FirstOrderOnly,
			&promo.IsActive,
			&promoDescription,
			&promo.StartsAt,
			&promoExpiresAt,
		)
		if err != nil {
			return nil, 0, err
		}

		if promoMinOrder.Valid {
			promo.MinOrderAmount = &promoMinOrder.Float64
		}
		if promoMaxDiscount.Valid {
			promo.MaxDiscountAmount = &promoMaxDiscount.Float64
		}
		if promoDescription.Valid {
			promo.Description = &promoDescription.String
		}
		if promoExpiresAt.Valid {
			promo.ExpiresAt = &promoExpiresAt.Time
		}

		upc.Promo = promo
		results = append(results, upc)
	}

	return results, total, nil
}

// ==================== Status Updates ====================

func (r *userPromoRepository) Claim(ctx context.Context, id string) error {
	query := `
		UPDATE user_promo_codes
		SET status = 'claimed', claimed_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND status = 'assigned'
		RETURNING id
	`

	var returnedID string
	err := r.db.QueryRowContext(ctx, query, id).Scan(&returnedID)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("cannot claim: assignment not found or already claimed")
	}
	return err
}

func (r *userPromoRepository) MarkUsed(ctx context.Context, id, orderID string) error {
	query := `
		UPDATE user_promo_codes
		SET status = 'used', used_at = NOW(), used_order_id = $2, updated_at = NOW()
		WHERE id = $1 AND status IN ('assigned', 'claimed')
		RETURNING id
	`

	var returnedID string
	err := r.db.QueryRowContext(ctx, query, id, orderID).Scan(&returnedID)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("cannot mark as used: assignment not found or invalid status")
	}
	return err
}

func (r *userPromoRepository) Revoke(ctx context.Context, id, revokedBy, reason string) error {
	query := `
		UPDATE user_promo_codes
		SET status = 'revoked', revoked_at = NOW(), revoked_by = $2, revoked_reason = $3, updated_at = NOW()
		WHERE id = $1 AND status NOT IN ('used', 'revoked')
		RETURNING id
	`

	var returnedID string
	err := r.db.QueryRowContext(ctx, query, id, revokedBy, reason).Scan(&returnedID)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("cannot revoke: assignment not found or already used/revoked")
	}
	return err
}

// ==================== Checks ====================

func (r *userPromoRepository) IsAssigned(ctx context.Context, promoID, userID string) (bool, error) {
	var exists bool
	err := r.db.QueryRowContext(ctx,
		"SELECT EXISTS(SELECT 1 FROM user_promo_codes WHERE promo_code_id = $1 AND user_id = $2)",
		promoID, userID,
	).Scan(&exists)
	return exists, err
}

func (r *userPromoRepository) IsClaimed(ctx context.Context, promoID, userID string) (bool, error) {
	var exists bool
	err := r.db.QueryRowContext(ctx,
		"SELECT EXISTS(SELECT 1 FROM user_promo_codes WHERE promo_code_id = $1 AND user_id = $2 AND status = 'claimed')",
		promoID, userID,
	).Scan(&exists)
	return exists, err
}

func (r *userPromoRepository) CanUse(ctx context.Context, promoID, userID string) (bool, string, error) {
	query := `
		SELECT status, expires_at
		FROM user_promo_codes
		WHERE promo_code_id = $1 AND user_id = $2
	`

	var status string
	var expiresAt sql.NullTime
	err := r.db.QueryRowContext(ctx, query, promoID, userID).Scan(&status, &expiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return false, "Code promo non attribué", nil
	}
	if err != nil {
		return false, "", err
	}

	// Check expiration
	if expiresAt.Valid && time.Now().After(expiresAt.Time) {
		return false, "Code promo expiré", nil
	}

	switch status {
	case "assigned", "claimed":
		return true, "", nil
	case "used":
		return false, "Code promo déjà utilisé", nil
	case "revoked":
		return false, "Code promo révoqué", nil
	case "expired":
		return false, "Code promo expiré", nil
	default:
		return false, "Statut inconnu", nil
	}
}

// ==================== Counts ====================

func (r *userPromoRepository) CountByPromoAndStatus(ctx context.Context, promoID, status string) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM user_promo_codes WHERE promo_code_id = $1 AND status = $2",
		promoID, status,
	).Scan(&count)
	return count, err
}

func (r *userPromoRepository) CountByPromo(ctx context.Context, promoID string) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM user_promo_codes WHERE promo_code_id = $1",
		promoID,
	).Scan(&count)
	return count, err
}

// ==================== Expiration ====================

func (r *userPromoRepository) ExpireOldAssignments(ctx context.Context) (int, error) {
	query := `
		UPDATE user_promo_codes
		SET status = 'expired', updated_at = NOW()
		WHERE status IN ('assigned', 'claimed')
		AND expires_at IS NOT NULL
		AND expires_at < NOW()
	`

	result, err := r.db.ExecContext(ctx, query)
	if err != nil {
		return 0, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	return int(rowsAffected), nil
}
