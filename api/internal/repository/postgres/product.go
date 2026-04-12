package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/klinkragency/e-snack/internal/repository"
)

type productRepository struct {
	db *sql.DB
}

func NewProductRepository(db *sql.DB) repository.ProductRepository {
	return &productRepository{db: db}
}

func (r *productRepository) Create(ctx context.Context, product *repository.Product) error {
	query := `
		INSERT INTO products (category_id, name, description, price, image_url, allergens, nutritional_info, position)
		VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE((SELECT MAX(position) + 1 FROM products WHERE category_id = $1), 0))
		RETURNING id, is_available, position, created_at, updated_at
	`

	allergens := product.Allergens
	if allergens == nil {
		allergens = json.RawMessage("[]")
	}
	nutritionalInfo := product.NutritionalInfo
	if nutritionalInfo == nil {
		nutritionalInfo = json.RawMessage("{}")
	}

	return r.db.QueryRowContext(
		ctx, query,
		product.CategoryID, product.Name, product.Description, product.Price,
		product.ImageURL, allergens, nutritionalInfo,
	).Scan(&product.ID, &product.IsAvailable, &product.Position, &product.CreatedAt, &product.UpdatedAt)
}

func (r *productRepository) GetByID(ctx context.Context, id string) (*repository.Product, error) {
	query := `
		SELECT id, category_id, name, description, price, image_url, is_available, position,
		       allergens, nutritional_info, created_at, updated_at
		FROM products WHERE id = $1
	`

	p := &repository.Product{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&p.ID, &p.CategoryID, &p.Name, &p.Description, &p.Price, &p.ImageURL,
		&p.IsAvailable, &p.Position, &p.Allergens, &p.NutritionalInfo, &p.CreatedAt, &p.UpdatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	return p, nil
}

func (r *productRepository) ListByCategory(ctx context.Context, categoryID string) ([]*repository.Product, error) {
	query := `
		SELECT id, category_id, name, description, price, image_url, is_available, position,
		       allergens, nutritional_info, created_at, updated_at
		FROM products
		WHERE category_id = $1
		ORDER BY position ASC, created_at ASC
	`

	rows, err := r.db.QueryContext(ctx, query, categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []*repository.Product
	for rows.Next() {
		p := &repository.Product{}
		if err := rows.Scan(
			&p.ID, &p.CategoryID, &p.Name, &p.Description, &p.Price, &p.ImageURL,
			&p.IsAvailable, &p.Position, &p.Allergens, &p.NutritionalInfo, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		products = append(products, p)
	}

	return products, rows.Err()
}

func (r *productRepository) Update(ctx context.Context, product *repository.Product) error {
	query := `
		UPDATE products SET
			category_id = $2, name = $3, description = $4, price = $5, image_url = $6, is_available = $7,
			allergens = $8, nutritional_info = $9, position = $10, updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at
	`

	return r.db.QueryRowContext(
		ctx, query,
		product.ID, product.CategoryID, product.Name, product.Description, product.Price, product.ImageURL,
		product.IsAvailable, product.Allergens, product.NutritionalInfo, product.Position,
	).Scan(&product.UpdatedAt)
}

func (r *productRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM products WHERE id = $1`
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

func (r *productRepository) SetAvailability(ctx context.Context, id string, available bool) error {
	query := `UPDATE products SET is_available = $2, updated_at = NOW() WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, id, available)
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

// ==================== Product Options ====================

type productOptionRepository struct {
	db *sql.DB
}

func NewProductOptionRepository(db *sql.DB) repository.ProductOptionRepository {
	return &productOptionRepository{db: db}
}

func (r *productOptionRepository) Create(ctx context.Context, option *repository.ProductOption) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	query := `
		INSERT INTO product_options (product_id, name, type, is_required, max_selections)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`

	err = tx.QueryRowContext(
		ctx, query,
		option.ProductID, option.Name, option.Type, option.IsRequired, option.MaxSelections,
	).Scan(&option.ID, &option.CreatedAt)
	if err != nil {
		return err
	}

	for _, choice := range option.Choices {
		choiceQuery := `
			INSERT INTO option_choices (option_id, name, price_modifier)
			VALUES ($1, $2, $3)
			RETURNING id, created_at
		`
		err = tx.QueryRowContext(
			ctx, choiceQuery,
			option.ID, choice.Name, choice.PriceModifier,
		).Scan(&choice.ID, &choice.CreatedAt)
		if err != nil {
			return err
		}
		choice.OptionID = option.ID
	}

	return tx.Commit()
}

func (r *productOptionRepository) GetByID(ctx context.Context, id string) (*repository.ProductOption, error) {
	query := `
		SELECT id, product_id, name, type, is_required, max_selections, created_at
		FROM product_options WHERE id = $1
	`

	opt := &repository.ProductOption{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&opt.ID, &opt.ProductID, &opt.Name, &opt.Type, &opt.IsRequired, &opt.MaxSelections, &opt.CreatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	opt.Choices, _ = r.getChoices(ctx, opt.ID)
	return opt, nil
}

func (r *productOptionRepository) ListByProduct(ctx context.Context, productID string) ([]*repository.ProductOption, error) {
	query := `
		SELECT id, product_id, name, type, is_required, max_selections, created_at
		FROM product_options
		WHERE product_id = $1
		ORDER BY created_at ASC
	`

	rows, err := r.db.QueryContext(ctx, query, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var options []*repository.ProductOption
	for rows.Next() {
		opt := &repository.ProductOption{}
		if err := rows.Scan(
			&opt.ID, &opt.ProductID, &opt.Name, &opt.Type, &opt.IsRequired, &opt.MaxSelections, &opt.CreatedAt,
		); err != nil {
			return nil, err
		}
		opt.Choices, _ = r.getChoices(ctx, opt.ID)
		options = append(options, opt)
	}

	return options, rows.Err()
}

func (r *productOptionRepository) Update(ctx context.Context, option *repository.ProductOption) error {
	query := `UPDATE product_options SET name = $2, type = $3, is_required = $4, max_selections = $5 WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, option.ID, option.Name, option.Type, option.IsRequired, option.MaxSelections)
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

func (r *productOptionRepository) UpdateChoice(ctx context.Context, choice *repository.OptionChoice) error {
	query := `UPDATE option_choices SET name = $2, price_modifier = $3 WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, choice.ID, choice.Name, choice.PriceModifier)
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

func (r *productOptionRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM product_options WHERE id = $1`
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

func (r *productOptionRepository) AddChoice(ctx context.Context, choice *repository.OptionChoice) error {
	query := `
		INSERT INTO option_choices (option_id, name, price_modifier)
		VALUES ($1, $2, $3)
		RETURNING id, created_at
	`

	return r.db.QueryRowContext(
		ctx, query,
		choice.OptionID, choice.Name, choice.PriceModifier,
	).Scan(&choice.ID, &choice.CreatedAt)
}

func (r *productOptionRepository) DeleteChoice(ctx context.Context, id string) error {
	query := `DELETE FROM option_choices WHERE id = $1`
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

func (r *productOptionRepository) getChoices(ctx context.Context, optionID string) ([]*repository.OptionChoice, error) {
	query := `
		SELECT id, option_id, name, price_modifier, created_at
		FROM option_choices
		WHERE option_id = $1
		ORDER BY created_at ASC
	`

	rows, err := r.db.QueryContext(ctx, query, optionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var choices []*repository.OptionChoice
	for rows.Next() {
		c := &repository.OptionChoice{}
		if err := rows.Scan(&c.ID, &c.OptionID, &c.Name, &c.PriceModifier, &c.CreatedAt); err != nil {
			return nil, err
		}
		choices = append(choices, c)
	}

	return choices, rows.Err()
}
