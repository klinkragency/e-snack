package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/klinkragency/e-snack/internal/repository"
	"github.com/lib/pq"
)

var ErrPromoNotFound = errors.New("promo code not found")
var ErrPromoLimitReached = errors.New("promo code usage limit reached")

type promoRepository struct {
	db *sql.DB
}

func NewPromoRepository(db *sql.DB) repository.PromoCodeRepository {
	return &promoRepository{db: db}
}

func (r *promoRepository) Create(ctx context.Context, promo *repository.PromoCode) error {
	query := `
		INSERT INTO promo_codes (
			code, discount_type, discount_value, min_order_amount, max_discount_amount,
			max_total_uses, max_uses_per_user, first_order_only, starts_at, expires_at,
			is_active, description, is_private, requires_claim
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, current_uses, created_at, updated_at
	`

	err := r.db.QueryRowContext(
		ctx,
		query,
		strings.ToUpper(promo.Code),
		promo.DiscountType,
		promo.DiscountValue,
		promo.MinOrderAmount,
		promo.MaxDiscountAmount,
		promo.MaxTotalUses,
		promo.MaxUsesPerUser,
		promo.FirstOrderOnly,
		promo.StartsAt,
		promo.ExpiresAt,
		promo.IsActive,
		promo.Description,
		promo.IsPrivate,
		promo.RequiresClaim,
	).Scan(&promo.ID, &promo.CurrentUses, &promo.CreatedAt, &promo.UpdatedAt)

	if err != nil {
		return err
	}

	if len(promo.RestaurantIDs) > 0 {
		return r.SetRestaurantIDs(ctx, promo.ID, promo.RestaurantIDs)
	}

	return nil
}

func (r *promoRepository) GetByID(ctx context.Context, id string) (*repository.PromoCode, error) {
	query := `
		SELECT p.id, p.code, p.discount_type, p.discount_value, p.min_order_amount, p.max_discount_amount,
		       p.max_total_uses, p.max_uses_per_user, p.first_order_only, p.starts_at, p.expires_at,
		       p.is_active, p.current_uses, p.description, p.is_private, p.requires_claim,
		       p.created_at, p.updated_at,
		       COALESCE((SELECT COUNT(*) FROM user_promo_codes WHERE promo_code_id = p.id), 0) as assigned_count,
		       COALESCE((SELECT COUNT(*) FROM user_promo_codes WHERE promo_code_id = p.id AND status = 'claimed'), 0) as claimed_count
		FROM promo_codes p
		WHERE p.id = $1
	`

	promo := &repository.PromoCode{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&promo.ID,
		&promo.Code,
		&promo.DiscountType,
		&promo.DiscountValue,
		&promo.MinOrderAmount,
		&promo.MaxDiscountAmount,
		&promo.MaxTotalUses,
		&promo.MaxUsesPerUser,
		&promo.FirstOrderOnly,
		&promo.StartsAt,
		&promo.ExpiresAt,
		&promo.IsActive,
		&promo.CurrentUses,
		&promo.Description,
		&promo.IsPrivate,
		&promo.RequiresClaim,
		&promo.CreatedAt,
		&promo.UpdatedAt,
		&promo.AssignedCount,
		&promo.ClaimedCount,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrPromoNotFound
	}
	if err != nil {
		return nil, err
	}

	promo.RestaurantIDs, err = r.GetRestaurantIDs(ctx, promo.ID)
	if err != nil {
		return nil, err
	}

	return promo, nil
}

func (r *promoRepository) GetByCode(ctx context.Context, code string) (*repository.PromoCode, error) {
	query := `
		SELECT p.id, p.code, p.discount_type, p.discount_value, p.min_order_amount, p.max_discount_amount,
		       p.max_total_uses, p.max_uses_per_user, p.first_order_only, p.starts_at, p.expires_at,
		       p.is_active, p.current_uses, p.description, p.is_private, p.requires_claim,
		       p.created_at, p.updated_at,
		       COALESCE((SELECT COUNT(*) FROM user_promo_codes WHERE promo_code_id = p.id), 0) as assigned_count,
		       COALESCE((SELECT COUNT(*) FROM user_promo_codes WHERE promo_code_id = p.id AND status = 'claimed'), 0) as claimed_count
		FROM promo_codes p
		WHERE UPPER(p.code) = UPPER($1)
	`

	promo := &repository.PromoCode{}
	err := r.db.QueryRowContext(ctx, query, code).Scan(
		&promo.ID,
		&promo.Code,
		&promo.DiscountType,
		&promo.DiscountValue,
		&promo.MinOrderAmount,
		&promo.MaxDiscountAmount,
		&promo.MaxTotalUses,
		&promo.MaxUsesPerUser,
		&promo.FirstOrderOnly,
		&promo.StartsAt,
		&promo.ExpiresAt,
		&promo.IsActive,
		&promo.CurrentUses,
		&promo.Description,
		&promo.IsPrivate,
		&promo.RequiresClaim,
		&promo.CreatedAt,
		&promo.UpdatedAt,
		&promo.AssignedCount,
		&promo.ClaimedCount,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrPromoNotFound
	}
	if err != nil {
		return nil, err
	}

	promo.RestaurantIDs, err = r.GetRestaurantIDs(ctx, promo.ID)
	if err != nil {
		return nil, err
	}

	return promo, nil
}

func (r *promoRepository) List(ctx context.Context, page, pageSize int, search string, activeOnly bool, typeFilter string) ([]*repository.PromoCode, int, error) {
	offset := (page - 1) * pageSize

	conditions := []string{}
	args := []interface{}{}
	argIndex := 1

	if search != "" {
		conditions = append(conditions, fmt.Sprintf("UPPER(code) LIKE UPPER($%d)", argIndex))
		args = append(args, "%"+search+"%")
		argIndex++
	}

	if activeOnly {
		conditions = append(conditions, "is_active = true")
		conditions = append(conditions, "starts_at <= NOW()")
		conditions = append(conditions, "(expires_at IS NULL OR expires_at > NOW())")
	}

	if typeFilter == "public" {
		conditions = append(conditions, "is_private = false")
	} else if typeFilter == "private" {
		conditions = append(conditions, "is_private = true")
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	countQuery := "SELECT COUNT(*) FROM promo_codes " + whereClause
	var total int
	err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	dataArgs := make([]interface{}, len(args))
	copy(dataArgs, args)
	dataArgs = append(dataArgs, pageSize, offset)
	query := fmt.Sprintf(`
		SELECT p.id, p.code, p.discount_type, p.discount_value, p.min_order_amount, p.max_discount_amount,
		       p.max_total_uses, p.max_uses_per_user, p.first_order_only, p.starts_at, p.expires_at,
		       p.is_active, p.current_uses, p.description, p.is_private, p.requires_claim,
		       p.created_at, p.updated_at,
		       COALESCE((SELECT COUNT(*) FROM user_promo_codes WHERE promo_code_id = p.id), 0) as assigned_count,
		       COALESCE((SELECT COUNT(*) FROM user_promo_codes WHERE promo_code_id = p.id AND status = 'claimed'), 0) as claimed_count
		FROM promo_codes p
		%s
		ORDER BY p.created_at DESC
		LIMIT $%d OFFSET $%d`, whereClause, argIndex, argIndex+1)

	rows, err := r.db.QueryContext(ctx, query, dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	promos := []*repository.PromoCode{}
	for rows.Next() {
		promo := &repository.PromoCode{}
		err := rows.Scan(
			&promo.ID,
			&promo.Code,
			&promo.DiscountType,
			&promo.DiscountValue,
			&promo.MinOrderAmount,
			&promo.MaxDiscountAmount,
			&promo.MaxTotalUses,
			&promo.MaxUsesPerUser,
			&promo.FirstOrderOnly,
			&promo.StartsAt,
			&promo.ExpiresAt,
			&promo.IsActive,
			&promo.CurrentUses,
			&promo.Description,
			&promo.IsPrivate,
			&promo.RequiresClaim,
			&promo.CreatedAt,
			&promo.UpdatedAt,
			&promo.AssignedCount,
			&promo.ClaimedCount,
		)
		if err != nil {
			return nil, 0, err
		}
		promos = append(promos, promo)
	}

	for _, promo := range promos {
		promo.RestaurantIDs, err = r.GetRestaurantIDs(ctx, promo.ID)
		if err != nil {
			return nil, 0, err
		}
	}

	return promos, total, nil
}

func (r *promoRepository) Update(ctx context.Context, promo *repository.PromoCode) error {
	query := `
		UPDATE promo_codes
		SET code = $1, discount_type = $2, discount_value = $3, min_order_amount = $4,
		    max_discount_amount = $5, max_total_uses = $6, max_uses_per_user = $7,
		    first_order_only = $8, starts_at = $9, expires_at = $10, is_active = $11,
		    description = $12, is_private = $13, requires_claim = $14, updated_at = NOW()
		WHERE id = $15
		RETURNING updated_at
	`

	err := r.db.QueryRowContext(
		ctx,
		query,
		strings.ToUpper(promo.Code),
		promo.DiscountType,
		promo.DiscountValue,
		promo.MinOrderAmount,
		promo.MaxDiscountAmount,
		promo.MaxTotalUses,
		promo.MaxUsesPerUser,
		promo.FirstOrderOnly,
		promo.StartsAt,
		promo.ExpiresAt,
		promo.IsActive,
		promo.Description,
		promo.IsPrivate,
		promo.RequiresClaim,
		promo.ID,
	).Scan(&promo.UpdatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		return ErrPromoNotFound
	}
	if err != nil {
		return err
	}

	return r.SetRestaurantIDs(ctx, promo.ID, promo.RestaurantIDs)
}

func (r *promoRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM promo_codes WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrPromoNotFound
	}

	return nil
}

// ==================== Restaurant Restrictions ====================

func (r *promoRepository) SetRestaurantIDs(ctx context.Context, promoID string, restaurantIDs []string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM promo_code_restaurants WHERE promo_code_id = $1", promoID)
	if err != nil {
		return err
	}

	if len(restaurantIDs) == 0 {
		return nil
	}

	query := `INSERT INTO promo_code_restaurants (promo_code_id, restaurant_id) VALUES ($1, unnest($2::uuid[]))`
	_, err = r.db.ExecContext(ctx, query, promoID, pq.Array(restaurantIDs))
	return err
}

func (r *promoRepository) GetRestaurantIDs(ctx context.Context, promoID string) ([]string, error) {
	query := `SELECT restaurant_id FROM promo_code_restaurants WHERE promo_code_id = $1`
	rows, err := r.db.QueryContext(ctx, query, promoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}

	return ids, nil
}

// ==================== Usage Tracking ====================

func (r *promoRepository) RecordUsage(ctx context.Context, usage *repository.PromoUsage) error {
	source := usage.Source
	if source == "" {
		source = "direct"
	}

	query := `
		INSERT INTO promo_usage (promo_code_id, user_id, order_id, discount_applied, source, user_promo_code_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`

	return r.db.QueryRowContext(
		ctx,
		query,
		usage.PromoCodeID,
		usage.UserID,
		usage.OrderID,
		usage.DiscountApplied,
		source,
		usage.UserPromoCodeID,
	).Scan(&usage.ID, &usage.CreatedAt)
}

func (r *promoRepository) GetUsageByPromo(ctx context.Context, promoID string, page, pageSize int) ([]*repository.PromoUsage, int, error) {
	offset := (page - 1) * pageSize

	var total int
	err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM promo_usage WHERE promo_code_id = $1",
		promoID,
	).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `
		SELECT pu.id, pu.promo_code_id, pu.user_id, u.email, pu.order_id, pu.discount_applied,
		       COALESCE(pu.source, 'direct'), pu.user_promo_code_id, pu.created_at
		FROM promo_usage pu
		JOIN users u ON u.id = pu.user_id
		WHERE pu.promo_code_id = $1
		ORDER BY pu.created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.QueryContext(ctx, query, promoID, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	usages := []*repository.PromoUsage{}
	for rows.Next() {
		usage := &repository.PromoUsage{}
		err := rows.Scan(
			&usage.ID,
			&usage.PromoCodeID,
			&usage.UserID,
			&usage.UserEmail,
			&usage.OrderID,
			&usage.DiscountApplied,
			&usage.Source,
			&usage.UserPromoCodeID,
			&usage.CreatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		usages = append(usages, usage)
	}

	return usages, total, nil
}

func (r *promoRepository) CountUsageByUser(ctx context.Context, promoID, userID string) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM promo_usage WHERE promo_code_id = $1 AND user_id = $2",
		promoID, userID,
	).Scan(&count)
	return count, err
}

func (r *promoRepository) GetTotalDiscountByPromo(ctx context.Context, promoID string) (float64, error) {
	var total sql.NullFloat64
	err := r.db.QueryRowContext(ctx,
		"SELECT SUM(discount_applied) FROM promo_usage WHERE promo_code_id = $1",
		promoID,
	).Scan(&total)
	if err != nil {
		return 0, err
	}
	if !total.Valid {
		return 0, nil
	}
	return total.Float64, nil
}

// ==================== Counter ====================

func (r *promoRepository) IncrementUses(ctx context.Context, promoID string) error {
	query := `
		UPDATE promo_codes
		SET current_uses = current_uses + 1, updated_at = NOW()
		WHERE id = $1
		  AND (max_total_uses IS NULL OR current_uses < max_total_uses)
	`
	result, err := r.db.ExecContext(ctx, query, promoID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrPromoLimitReached
	}
	return nil
}

// ==================== Stats ====================

func (r *promoRepository) GetStats(ctx context.Context, promoID string) (*repository.PromoStats, error) {
	query := `
		SELECT
			COALESCE((SELECT COUNT(*) FROM user_promo_codes WHERE promo_code_id = $1), 0) as total_assignments,
			COALESCE((SELECT COUNT(*) FROM user_promo_codes WHERE promo_code_id = $1 AND status = 'claimed'), 0) as claimed_count,
			COALESCE((SELECT COUNT(*) FROM user_promo_codes WHERE promo_code_id = $1 AND status = 'used'), 0) as used_count,
			COALESCE((SELECT COUNT(*) FROM user_promo_codes WHERE promo_code_id = $1 AND status = 'revoked'), 0) as revoked_count,
			COALESCE((SELECT COUNT(*) FROM user_promo_codes WHERE promo_code_id = $1 AND status = 'expired'), 0) as expired_count,
			COALESCE((SELECT SUM(discount_applied) FROM promo_usage WHERE promo_code_id = $1), 0) as total_discount,
			COALESCE((SELECT AVG(discount_applied) FROM promo_usage WHERE promo_code_id = $1), 0) as avg_discount,
			COALESCE((SELECT COUNT(DISTINCT user_id) FROM promo_usage WHERE promo_code_id = $1), 0) as unique_users
	`

	stats := &repository.PromoStats{}
	err := r.db.QueryRowContext(ctx, query, promoID).Scan(
		&stats.TotalAssignments,
		&stats.ClaimedCount,
		&stats.UsedCount,
		&stats.RevokedCount,
		&stats.ExpiredCount,
		&stats.TotalDiscountGiven,
		&stats.AverageDiscount,
		&stats.UniqueUsers,
	)
	if err != nil {
		return nil, err
	}

	return stats, nil
}

// Helper
func (r *promoRepository) IsValidAtTime(promo *repository.PromoCode, t time.Time) bool {
	if !promo.IsActive {
		return false
	}
	if t.Before(promo.StartsAt) {
		return false
	}
	if promo.ExpiresAt != nil && t.After(*promo.ExpiresAt) {
		return false
	}
	return true
}
