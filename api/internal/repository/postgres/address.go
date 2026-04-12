package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/klinkragency/e-snack/internal/repository"
)

type addressRepository struct {
	db *sql.DB
}

func NewDeliveryAddressRepository(db *sql.DB) repository.DeliveryAddressRepository {
	return &addressRepository{db: db}
}

func (r *addressRepository) ListByUser(ctx context.Context, userID string) ([]*repository.DeliveryAddress, error) {
	query := `
		SELECT id, user_id, label, address, lat, lng, is_default, created_at, updated_at
		FROM delivery_addresses
		WHERE user_id = $1
		ORDER BY is_default DESC, created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var addresses []*repository.DeliveryAddress
	for rows.Next() {
		a := &repository.DeliveryAddress{}
		if err := rows.Scan(&a.ID, &a.UserID, &a.Label, &a.Address, &a.Lat, &a.Lng, &a.IsDefault, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		addresses = append(addresses, a)
	}
	return addresses, rows.Err()
}

func (r *addressRepository) Create(ctx context.Context, addr *repository.DeliveryAddress) error {
	query := `
		INSERT INTO delivery_addresses (user_id, label, address, lat, lng, is_default)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRowContext(ctx, query,
		addr.UserID, addr.Label, addr.Address, addr.Lat, addr.Lng, addr.IsDefault,
	).Scan(&addr.ID, &addr.CreatedAt, &addr.UpdatedAt)
}

func (r *addressRepository) Update(ctx context.Context, addr *repository.DeliveryAddress) error {
	query := `
		UPDATE delivery_addresses
		SET label = $3, address = $4, lat = $5, lng = $6, updated_at = NOW()
		WHERE id = $1 AND user_id = $2
		RETURNING updated_at
	`
	err := r.db.QueryRowContext(ctx, query,
		addr.ID, addr.UserID, addr.Label, addr.Address, addr.Lat, addr.Lng,
	).Scan(&addr.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func (r *addressRepository) Delete(ctx context.Context, id, userID string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM delivery_addresses WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *addressRepository) GetByID(ctx context.Context, id, userID string) (*repository.DeliveryAddress, error) {
	query := `
		SELECT id, user_id, label, address, lat, lng, is_default, created_at, updated_at
		FROM delivery_addresses
		WHERE id = $1 AND user_id = $2
	`
	a := &repository.DeliveryAddress{}
	err := r.db.QueryRowContext(ctx, query, id, userID).Scan(
		&a.ID, &a.UserID, &a.Label, &a.Address, &a.Lat, &a.Lng, &a.IsDefault, &a.CreatedAt, &a.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return a, err
}

func (r *addressRepository) SetDefault(ctx context.Context, id, userID string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Unset all defaults for this user
	if _, err := tx.ExecContext(ctx, `UPDATE delivery_addresses SET is_default = false WHERE user_id = $1`, userID); err != nil {
		return err
	}

	// Set the new default
	result, err := tx.ExecContext(ctx, `UPDATE delivery_addresses SET is_default = true, updated_at = NOW() WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrNotFound
	}

	return tx.Commit()
}
