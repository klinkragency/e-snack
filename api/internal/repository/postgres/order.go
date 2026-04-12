package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/beldys/api/internal/repository"
)

type orderRepository struct {
	db *sql.DB
}

func NewOrderRepository(db *sql.DB) repository.OrderRepository {
	return &orderRepository{db: db}
}

func (r *orderRepository) Create(ctx context.Context, order *repository.Order) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Insert order
	orderQuery := `
		INSERT INTO orders (
			user_id, restaurant_id, order_type, status,
			subtotal, delivery_fee, discount, total,
			delivery_address, delivery_lat, delivery_lng, delivery_instructions,
			table_number, scheduled_pickup_time, payment_status, promo_code_id,
			customer_notes
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		RETURNING id, created_at, updated_at
	`

	err = tx.QueryRowContext(ctx, orderQuery,
		order.UserID, order.RestaurantID, order.OrderType, order.Status,
		order.Subtotal, order.DeliveryFee, order.Discount, order.Total,
		order.DeliveryAddress, order.DeliveryLat, order.DeliveryLng, order.DeliveryInstructions,
		order.TableNumber, order.ScheduledPickupTime, order.PaymentStatus, order.PromoCodeID,
		order.CustomerNotes,
	).Scan(&order.ID, &order.CreatedAt, &order.UpdatedAt)
	if err != nil {
		return err
	}

	// Insert order items (supports both products and formulas)
	itemQuery := `
		INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, total, notes,
		                         item_type, formula_id, formula_name)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at
	`

	optionQuery := `
		INSERT INTO order_item_options (order_item_id, option_choice_id, option_name, choice_name, price_modifier)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`

	formulaProductQuery := `
		INSERT INTO order_formula_products (order_item_id, product_id, product_name, position)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at
	`

	formulaProductOptionQuery := `
		INSERT INTO order_formula_product_options (order_formula_product_id, option_choice_id, option_name, choice_name, price_modifier)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`

	for _, item := range order.Items {
		item.OrderID = order.ID
		itemType := item.ItemType
		if itemType == "" {
			itemType = "product"
		}
		err = tx.QueryRowContext(ctx, itemQuery,
			item.OrderID, item.ProductID, item.ProductName, item.UnitPrice,
			item.Quantity, item.Total, item.Notes,
			itemType, item.FormulaID, item.FormulaName,
		).Scan(&item.ID, &item.CreatedAt)
		if err != nil {
			return err
		}

		// Regular product options
		for _, opt := range item.Options {
			opt.OrderItemID = item.ID
			err = tx.QueryRowContext(ctx, optionQuery,
				opt.OrderItemID, opt.OptionChoiceID, opt.OptionName, opt.ChoiceName, opt.PriceModifier,
			).Scan(&opt.ID, &opt.CreatedAt)
			if err != nil {
				return err
			}
		}

		// Formula product snapshots
		for _, fp := range item.FormulaProducts {
			fp.OrderItemID = item.ID
			err = tx.QueryRowContext(ctx, formulaProductQuery,
				fp.OrderItemID, fp.ProductID, fp.ProductName, fp.Position,
			).Scan(&fp.ID, &fp.CreatedAt)
			if err != nil {
				return err
			}
			for _, fpOpt := range fp.Options {
				fpOpt.OrderFormulaProductID = fp.ID
				err = tx.QueryRowContext(ctx, formulaProductOptionQuery,
					fpOpt.OrderFormulaProductID, fpOpt.OptionChoiceID,
					fpOpt.OptionName, fpOpt.ChoiceName, fpOpt.PriceModifier,
				).Scan(&fpOpt.ID, &fpOpt.CreatedAt)
				if err != nil {
					return err
				}
			}
		}
	}

	// Add initial status history
	historyQuery := `
		INSERT INTO order_status_history (order_id, status, changed_by, notes)
		VALUES ($1, $2, $3, $4)
	`
	_, err = tx.ExecContext(ctx, historyQuery, order.ID, order.Status, order.UserID, "Order created")
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *orderRepository) GetByID(ctx context.Context, id string) (*repository.Order, error) {
	orderQuery := `
		SELECT id, order_number, user_id, restaurant_id, order_type, status,
		       subtotal, delivery_fee, discount, total,
		       delivery_address, delivery_lat, delivery_lng, delivery_instructions,
		       table_number, scheduled_pickup_time, payment_intent_id, payment_status,
		       promo_code_id, customer_notes, estimated_prep_minutes, created_at, updated_at, completed_at
		FROM orders WHERE id = $1
	`

	order := &repository.Order{}
	err := r.db.QueryRowContext(ctx, orderQuery, id).Scan(
		&order.ID, &order.OrderNumber, &order.UserID, &order.RestaurantID, &order.OrderType, &order.Status,
		&order.Subtotal, &order.DeliveryFee, &order.Discount, &order.Total,
		&order.DeliveryAddress, &order.DeliveryLat, &order.DeliveryLng, &order.DeliveryInstructions,
		&order.TableNumber, &order.ScheduledPickupTime, &order.PaymentIntentID, &order.PaymentStatus,
		&order.PromoCodeID, &order.CustomerNotes, &order.EstimatedPrepMinutes, &order.CreatedAt, &order.UpdatedAt, &order.CompletedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	// Fetch items
	order.Items, err = r.getOrderItems(ctx, order.ID)
	if err != nil {
		return nil, err
	}

	// Fetch status history
	order.StatusHistory, err = r.getStatusHistory(ctx, order.ID)
	if err != nil {
		return nil, err
	}

	return order, nil
}

func (r *orderRepository) getOrderItems(ctx context.Context, orderID string) ([]*repository.OrderItem, error) {
	itemsQuery := `
		SELECT id, order_id, product_id, product_name, unit_price, quantity, total, notes,
		       item_type, formula_id, formula_name, created_at
		FROM order_items WHERE order_id = $1 ORDER BY created_at
	`

	rows, err := r.db.QueryContext(ctx, itemsQuery, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []*repository.OrderItem
	for rows.Next() {
		item := &repository.OrderItem{}
		if err := rows.Scan(
			&item.ID, &item.OrderID, &item.ProductID, &item.ProductName,
			&item.UnitPrice, &item.Quantity, &item.Total, &item.Notes,
			&item.ItemType, &item.FormulaID, &item.FormulaName, &item.CreatedAt,
		); err != nil {
			return nil, err
		}

		item.Options, _ = r.getItemOptions(ctx, item.ID)
		if item.ItemType == "formula" {
			item.FormulaProducts, _ = r.getFormulaProducts(ctx, item.ID)
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *orderRepository) getFormulaProducts(ctx context.Context, orderItemID string) ([]*repository.OrderFormulaProduct, error) {
	query := `
		SELECT id, order_item_id, product_id, product_name, position, created_at
		FROM order_formula_products WHERE order_item_id = $1 ORDER BY position
	`
	rows, err := r.db.QueryContext(ctx, query, orderItemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []*repository.OrderFormulaProduct
	for rows.Next() {
		fp := &repository.OrderFormulaProduct{}
		if err := rows.Scan(&fp.ID, &fp.OrderItemID, &fp.ProductID, &fp.ProductName, &fp.Position, &fp.CreatedAt); err != nil {
			return nil, err
		}
		fp.Options, _ = r.getFormulaProductOptions(ctx, fp.ID)
		products = append(products, fp)
	}
	return products, rows.Err()
}

func (r *orderRepository) getFormulaProductOptions(ctx context.Context, formulaProductID string) ([]*repository.OrderFormulaProductOption, error) {
	query := `
		SELECT id, order_formula_product_id, option_choice_id, option_name, choice_name, price_modifier, created_at
		FROM order_formula_product_options WHERE order_formula_product_id = $1
	`
	rows, err := r.db.QueryContext(ctx, query, formulaProductID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var options []*repository.OrderFormulaProductOption
	for rows.Next() {
		opt := &repository.OrderFormulaProductOption{}
		if err := rows.Scan(&opt.ID, &opt.OrderFormulaProductID, &opt.OptionChoiceID, &opt.OptionName, &opt.ChoiceName, &opt.PriceModifier, &opt.CreatedAt); err != nil {
			return nil, err
		}
		options = append(options, opt)
	}
	return options, rows.Err()
}

func (r *orderRepository) getItemOptions(ctx context.Context, itemID string) ([]*repository.OrderItemOption, error) {
	optionsQuery := `
		SELECT id, order_item_id, option_choice_id, option_name, choice_name, price_modifier, created_at
		FROM order_item_options WHERE order_item_id = $1
	`

	rows, err := r.db.QueryContext(ctx, optionsQuery, itemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var options []*repository.OrderItemOption
	for rows.Next() {
		opt := &repository.OrderItemOption{}
		if err := rows.Scan(
			&opt.ID, &opt.OrderItemID, &opt.OptionChoiceID, &opt.OptionName,
			&opt.ChoiceName, &opt.PriceModifier, &opt.CreatedAt,
		); err != nil {
			return nil, err
		}
		options = append(options, opt)
	}

	return options, rows.Err()
}

func (r *orderRepository) getStatusHistory(ctx context.Context, orderID string) ([]*repository.OrderStatusHistory, error) {
	historyQuery := `
		SELECT id, order_id, status, changed_by, notes, created_at
		FROM order_status_history WHERE order_id = $1 ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, historyQuery, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []*repository.OrderStatusHistory
	for rows.Next() {
		h := &repository.OrderStatusHistory{}
		if err := rows.Scan(&h.ID, &h.OrderID, &h.Status, &h.ChangedBy, &h.Notes, &h.CreatedAt); err != nil {
			return nil, err
		}
		history = append(history, h)
	}

	return history, rows.Err()
}

func (r *orderRepository) ListByUser(ctx context.Context, userID string, page, pageSize int) ([]*repository.Order, int, error) {
	countQuery := `SELECT COUNT(*) FROM orders WHERE user_id = $1`
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, userID).Scan(&total); err != nil {
		return nil, 0, err
	}

	listQuery := `
		SELECT id, order_number, user_id, restaurant_id, order_type, status,
		       subtotal, delivery_fee, discount, total,
		       payment_status, created_at, updated_at
		FROM orders WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	offset := (page - 1) * pageSize
	rows, err := r.db.QueryContext(ctx, listQuery, userID, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var orders []*repository.Order
	for rows.Next() {
		o := &repository.Order{}
		if err := rows.Scan(
			&o.ID, &o.OrderNumber, &o.UserID, &o.RestaurantID, &o.OrderType, &o.Status,
			&o.Subtotal, &o.DeliveryFee, &o.Discount, &o.Total,
			&o.PaymentStatus, &o.CreatedAt, &o.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		orders = append(orders, o)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	// Fetch items for each order
	for _, order := range orders {
		order.Items, _ = r.getOrderItems(ctx, order.ID)
	}

	return orders, total, nil
}

func (r *orderRepository) ListByRestaurant(ctx context.Context, restaurantID string, status string, page, pageSize int) ([]*repository.Order, int, error) {
	countQuery := `SELECT COUNT(*) FROM orders WHERE restaurant_id = $1`
	args := []interface{}{restaurantID}

	if status != "" {
		countQuery += " AND status = $2"
		args = append(args, status)
	}

	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	listQuery := `
		SELECT o.id, o.order_number, o.user_id, o.restaurant_id, o.order_type, o.status,
		       o.subtotal, o.delivery_fee, o.discount, o.total,
		       o.delivery_address, o.delivery_lat, o.delivery_lng, o.delivery_instructions,
		       o.payment_status, o.driver_id, o.customer_notes, o.estimated_prep_minutes, o.created_at, o.updated_at,
		       COALESCE(cu.name, ''), COALESCE(cu.email, ''), COALESCE(cu.phone, ''),
		       COALESCE(du.name, ''), COALESCE(du.phone, '')
		FROM orders o
		LEFT JOIN users cu ON cu.id = o.user_id
		LEFT JOIN users du ON du.id = o.driver_id
		WHERE o.restaurant_id = $1
	`

	if status != "" {
		listQuery += " AND o.status = $2"
	}
	listQuery += " ORDER BY o.created_at DESC LIMIT $" + nextParam(len(args)+1) + " OFFSET $" + nextParam(len(args)+2)

	offset := (page - 1) * pageSize
	args = append(args, pageSize, offset)

	rows, err := r.db.QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var orders []*repository.Order
	for rows.Next() {
		o := &repository.Order{}
		if err := rows.Scan(
			&o.ID, &o.OrderNumber, &o.UserID, &o.RestaurantID, &o.OrderType, &o.Status,
			&o.Subtotal, &o.DeliveryFee, &o.Discount, &o.Total,
			&o.DeliveryAddress, &o.DeliveryLat, &o.DeliveryLng, &o.DeliveryInstructions,
			&o.PaymentStatus, &o.DriverID, &o.CustomerNotes, &o.EstimatedPrepMinutes, &o.CreatedAt, &o.UpdatedAt,
			&o.CustomerName, &o.CustomerEmail, &o.CustomerPhone,
			&o.DriverName, &o.DriverPhone,
		); err != nil {
			return nil, 0, err
		}
		orders = append(orders, o)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	// Fetch items for each order
	for _, order := range orders {
		order.Items, _ = r.getOrderItems(ctx, order.ID)
	}

	return orders, total, nil
}

func (r *orderRepository) UpdateStatus(ctx context.Context, id, status string, changedBy *string, notes *string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Update order status
	updateQuery := `UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1`
	result, err := tx.ExecContext(ctx, updateQuery, id, status)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}

	// If completed status, set completed_at
	if status == "delivered" || status == "cancelled" || status == "refunded" {
		_, err = tx.ExecContext(ctx, `UPDATE orders SET completed_at = NOW() WHERE id = $1`, id)
		if err != nil {
			return err
		}
	}

	// Add to history
	historyQuery := `
		INSERT INTO order_status_history (order_id, status, changed_by, notes)
		VALUES ($1, $2, $3, $4)
	`
	_, err = tx.ExecContext(ctx, historyQuery, id, status, changedBy, notes)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (r *orderRepository) UpdatePaymentStatus(ctx context.Context, id, paymentStatus string, paymentIntentID *string) error {
	query := `
		UPDATE orders SET payment_status = $2, payment_intent_id = $3, updated_at = NOW()
		WHERE id = $1
	`

	result, err := r.db.ExecContext(ctx, query, id, paymentStatus, paymentIntentID)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}

func (r *orderRepository) UpdatePrepTime(ctx context.Context, id string, minutes int32) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE orders SET estimated_prep_minutes = $2, updated_at = NOW() WHERE id = $1`,
		id, minutes,
	)
	if err != nil {
		return err
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *orderRepository) AddStatusHistory(ctx context.Context, history *repository.OrderStatusHistory) error {
	query := `
		INSERT INTO order_status_history (order_id, status, changed_by, notes)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at
	`

	return r.db.QueryRowContext(ctx, query,
		history.OrderID, history.Status, history.ChangedBy, history.Notes,
	).Scan(&history.ID, &history.CreatedAt)
}

func nextParam(n int) string {
	return fmt.Sprintf("%d", n)
}

func (r *orderRepository) CountByUser(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM orders WHERE user_id = $1", userID).Scan(&count)
	return count, err
}

func (r *orderRepository) GetByPaymentIntentID(ctx context.Context, paymentIntentID string) (*repository.Order, error) {
	query := `
		SELECT id, user_id, restaurant_id, order_type, status,
		       subtotal, delivery_fee, discount, total,
		       delivery_address, delivery_lat, delivery_lng, delivery_instructions,
		       table_number, scheduled_pickup_time, payment_intent_id, payment_status,
		       promo_code_id, customer_notes, created_at, updated_at, completed_at
		FROM orders WHERE payment_intent_id = $1
	`

	order := &repository.Order{}
	err := r.db.QueryRowContext(ctx, query, paymentIntentID).Scan(
		&order.ID, &order.UserID, &order.RestaurantID, &order.OrderType, &order.Status,
		&order.Subtotal, &order.DeliveryFee, &order.Discount, &order.Total,
		&order.DeliveryAddress, &order.DeliveryLat, &order.DeliveryLng, &order.DeliveryInstructions,
		&order.TableNumber, &order.ScheduledPickupTime, &order.PaymentIntentID, &order.PaymentStatus,
		&order.PromoCodeID, &order.CustomerNotes, &order.CreatedAt, &order.UpdatedAt, &order.CompletedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	return order, nil
}

// ConfirmPaymentTx confirme un paiement de façon atomique dans une seule transaction :
// - payment_status = 'paid', payment_intent_id = mollieID
// - order status = 'confirmed'
// - insère un payment_event d'audit
func (r *orderRepository) ConfirmPaymentTx(ctx context.Context, orderID, mollieID string, amount float64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx,
		`UPDATE orders SET payment_status = 'paid', payment_intent_id = $2, status = 'confirmed', updated_at = NOW() WHERE id = $1`,
		orderID, mollieID,
	)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx,
		`INSERT INTO order_status_history (order_id, status, notes) VALUES ($1, 'confirmed', 'Paiement confirmé via Mollie')`,
		orderID,
	)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx,
		`INSERT INTO payment_events (order_id, mollie_id, event_type, amount) VALUES ($1, $2, 'paid', $3)`,
		orderID, mollieID, amount,
	)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// FailPaymentTx marque un paiement échoué/expiré de façon atomique.
func (r *orderRepository) FailPaymentTx(ctx context.Context, orderID, mollieID, reason string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx,
		`UPDATE orders SET payment_status = 'failed', updated_at = NOW() WHERE id = $1`,
		orderID,
	)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(ctx,
		`INSERT INTO payment_events (order_id, mollie_id, event_type) VALUES ($1, $2, $3)`,
		orderID, mollieID, reason, // reason = 'failed' | 'expired' | 'canceled'
	)
	if err != nil {
		return err
	}

	return tx.Commit()
}
