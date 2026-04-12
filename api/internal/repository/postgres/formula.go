package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/klinkragency/e-snack/internal/repository"
)

type formulaRepository struct {
	db         *sql.DB
	optionRepo repository.ProductOptionRepository
}

func NewFormulaRepository(db *sql.DB, optionRepo repository.ProductOptionRepository) repository.FormulaRepository {
	return &formulaRepository{db: db, optionRepo: optionRepo}
}

func (r *formulaRepository) Create(ctx context.Context, formula *repository.Formula, products []repository.FormulaProductInput) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	query := `
		INSERT INTO formulas (category_id, name, description, base_price, image_url, position)
		VALUES ($1, $2, $3, $4, $5, COALESCE((SELECT MAX(position) + 1 FROM formulas WHERE category_id = $1), 0))
		RETURNING id, is_available, position, created_at, updated_at
	`
	err = tx.QueryRowContext(ctx, query,
		formula.CategoryID, formula.Name, formula.Description, formula.BasePrice, formula.ImageURL,
	).Scan(&formula.ID, &formula.IsAvailable, &formula.Position, &formula.CreatedAt, &formula.UpdatedAt)
	if err != nil {
		return err
	}

	for i, input := range products {
		var groupLabel *string
		if input.GroupLabel != "" {
			groupLabel = &input.GroupLabel
		}
		fpQuery := `
			INSERT INTO formula_products (formula_id, product_id, position, group_label)
			VALUES ($1, $2, $3, $4)
			RETURNING id, created_at
		`
		fp := &repository.FormulaProduct{
			FormulaID:  formula.ID,
			ProductID:  input.ProductID,
			Position:   i,
			GroupLabel: groupLabel,
		}
		err = tx.QueryRowContext(ctx, fpQuery, formula.ID, input.ProductID, i, groupLabel).Scan(&fp.ID, &fp.CreatedAt)
		if err != nil {
			return err
		}
		formula.Products = append(formula.Products, fp)
	}

	return tx.Commit()
}

func (r *formulaRepository) GetByID(ctx context.Context, id string) (*repository.Formula, error) {
	query := `
		SELECT id, category_id, name, description, base_price, image_url, is_available, position, created_at, updated_at
		FROM formulas WHERE id = $1
	`
	f := &repository.Formula{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&f.ID, &f.CategoryID, &f.Name, &f.Description, &f.BasePrice,
		&f.ImageURL, &f.IsAvailable, &f.Position, &f.CreatedAt, &f.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	f.Products, err = r.loadFormulaProducts(ctx, f.ID)
	if err != nil {
		return nil, err
	}
	return f, nil
}

func (r *formulaRepository) ListByCategory(ctx context.Context, categoryID string) ([]*repository.Formula, error) {
	query := `
		SELECT id, category_id, name, description, base_price, image_url, is_available, position, created_at, updated_at
		FROM formulas
		WHERE category_id = $1
		ORDER BY position ASC, created_at ASC
	`
	rows, err := r.db.QueryContext(ctx, query, categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var formulas []*repository.Formula
	for rows.Next() {
		f := &repository.Formula{}
		if err := rows.Scan(
			&f.ID, &f.CategoryID, &f.Name, &f.Description, &f.BasePrice,
			&f.ImageURL, &f.IsAvailable, &f.Position, &f.CreatedAt, &f.UpdatedAt,
		); err != nil {
			return nil, err
		}
		f.Products, _ = r.loadFormulaProducts(ctx, f.ID)
		formulas = append(formulas, f)
	}
	return formulas, rows.Err()
}

func (r *formulaRepository) Update(ctx context.Context, formula *repository.Formula, products []repository.FormulaProductInput) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	query := `
		UPDATE formulas SET category_id=$2, name=$3, description=$4, base_price=$5, image_url=$6, position=$7, updated_at=NOW()
		WHERE id=$1
		RETURNING updated_at
	`
	err = tx.QueryRowContext(ctx, query,
		formula.ID, formula.CategoryID, formula.Name, formula.Description, formula.BasePrice, formula.ImageURL, formula.Position,
	).Scan(&formula.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	// Replace all formula_products
	if products != nil {
		_, err = tx.ExecContext(ctx, `DELETE FROM formula_products WHERE formula_id = $1`, formula.ID)
		if err != nil {
			return err
		}
		formula.Products = nil
		for i, input := range products {
			var groupLabel *string
			if input.GroupLabel != "" {
				groupLabel = &input.GroupLabel
			}
			fpQuery := `
				INSERT INTO formula_products (formula_id, product_id, position, group_label)
				VALUES ($1, $2, $3, $4)
				RETURNING id, created_at
			`
			fp := &repository.FormulaProduct{
				FormulaID:  formula.ID,
				ProductID:  input.ProductID,
				Position:   i,
				GroupLabel: groupLabel,
			}
			err = tx.QueryRowContext(ctx, fpQuery, formula.ID, input.ProductID, i, groupLabel).Scan(&fp.ID, &fp.CreatedAt)
			if err != nil {
				return err
			}
			formula.Products = append(formula.Products, fp)
		}
	}

	return tx.Commit()
}

func (r *formulaRepository) Delete(ctx context.Context, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM formulas WHERE id = $1`, id)
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

func (r *formulaRepository) SetAvailability(ctx context.Context, id string, available bool) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE formulas SET is_available = $2, updated_at = NOW() WHERE id = $1`,
		id, available,
	)
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

// loadFormulaProducts loads the products linked to a formula, including their full product data + options.
func (r *formulaRepository) loadFormulaProducts(ctx context.Context, formulaID string) ([]*repository.FormulaProduct, error) {
	query := `
		SELECT fp.id, fp.formula_id, fp.product_id, fp.position, fp.group_label, fp.created_at,
		       p.id, p.category_id, p.name, p.description, p.price, p.image_url, p.is_available, p.position,
		       p.allergens, p.nutritional_info, p.created_at, p.updated_at
		FROM formula_products fp
		JOIN products p ON p.id = fp.product_id
		WHERE fp.formula_id = $1
		ORDER BY fp.position ASC
	`
	rows, err := r.db.QueryContext(ctx, query, formulaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []*repository.FormulaProduct
	for rows.Next() {
		fp := &repository.FormulaProduct{}
		p := &repository.Product{}
		if err := rows.Scan(
			&fp.ID, &fp.FormulaID, &fp.ProductID, &fp.Position, &fp.GroupLabel, &fp.CreatedAt,
			&p.ID, &p.CategoryID, &p.Name, &p.Description, &p.Price, &p.ImageURL,
			&p.IsAvailable, &p.Position, &p.Allergens, &p.NutritionalInfo, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		// Load product options
		p.Options, _ = r.optionRepo.ListByProduct(ctx, p.ID)
		fp.Product = p
		products = append(products, fp)
	}
	return products, rows.Err()
}
