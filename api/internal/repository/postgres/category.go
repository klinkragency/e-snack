package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/beldys/api/internal/repository"
)

type categoryRepository struct {
	db *sql.DB
}

func NewCategoryRepository(db *sql.DB) repository.CategoryRepository {
	return &categoryRepository{db: db}
}

func (r *categoryRepository) Create(ctx context.Context, category *repository.Category) error {
	query := `
		INSERT INTO categories (restaurant_id, name, position)
		VALUES ($1, $2, $3)
		RETURNING id, is_active, created_at, updated_at
	`

	return r.db.QueryRowContext(
		ctx, query,
		category.RestaurantID, category.Name, category.Position,
	).Scan(&category.ID, &category.IsActive, &category.CreatedAt, &category.UpdatedAt)
}

func (r *categoryRepository) GetByID(ctx context.Context, id string) (*repository.Category, error) {
	query := `
		SELECT id, restaurant_id, name, position, is_active, created_at, updated_at
		FROM categories WHERE id = $1
	`

	cat := &repository.Category{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&cat.ID, &cat.RestaurantID, &cat.Name, &cat.Position, &cat.IsActive, &cat.CreatedAt, &cat.UpdatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	return cat, nil
}

func (r *categoryRepository) ListByRestaurant(ctx context.Context, restaurantID string) ([]*repository.Category, error) {
	query := `
		SELECT id, restaurant_id, name, position, is_active, created_at, updated_at
		FROM categories
		WHERE restaurant_id = $1
		ORDER BY position ASC, created_at ASC
	`

	rows, err := r.db.QueryContext(ctx, query, restaurantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []*repository.Category
	for rows.Next() {
		cat := &repository.Category{}
		if err := rows.Scan(
			&cat.ID, &cat.RestaurantID, &cat.Name, &cat.Position, &cat.IsActive, &cat.CreatedAt, &cat.UpdatedAt,
		); err != nil {
			return nil, err
		}
		categories = append(categories, cat)
	}

	return categories, rows.Err()
}

func (r *categoryRepository) Update(ctx context.Context, category *repository.Category) error {
	query := `
		UPDATE categories SET
			name = $2, position = $3, is_active = $4, updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at
	`

	return r.db.QueryRowContext(
		ctx, query,
		category.ID, category.Name, category.Position, category.IsActive,
	).Scan(&category.UpdatedAt)
}

func (r *categoryRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM categories WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}

	return nil
}
