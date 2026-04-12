package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/klinkragency/e-snack/internal/repository"
)

type restaurantRepository struct {
	db *sql.DB
}

func NewRestaurantRepository(db *sql.DB) repository.RestaurantRepository {
	return &restaurantRepository{db: db}
}

func (r *restaurantRepository) Create(ctx context.Context, restaurant *repository.Restaurant) error {
	query := `
		INSERT INTO restaurants (name, slug, description, address, lat, lng, opening_hours, delivery_radius_km)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, is_active, created_at, updated_at
	`

	openingHours := restaurant.OpeningHours
	if openingHours == nil {
		openingHours = json.RawMessage("{}")
	}

	return r.db.QueryRowContext(
		ctx, query,
		restaurant.Name,
		restaurant.Slug,
		restaurant.Description,
		restaurant.Address,
		restaurant.Lat,
		restaurant.Lng,
		openingHours,
		restaurant.DeliveryRadiusKm,
	).Scan(&restaurant.ID, &restaurant.IsActive, &restaurant.CreatedAt, &restaurant.UpdatedAt)
}

func (r *restaurantRepository) GetByID(ctx context.Context, id string) (*repository.Restaurant, error) {
	query := `
		SELECT id, name, slug, description, logo_url, banner_url, banner_position, address, lat, lng,
		       opening_hours, delivery_radius_km, delivery_fee, delivery_time_min, delivery_time_max,
		       is_active, pickup_enabled, free_delivery_threshold, notification_sound_url, created_at, updated_at
		FROM restaurants WHERE id = $1
	`

	rest := &repository.Restaurant{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&rest.ID, &rest.Name, &rest.Slug, &rest.Description, &rest.LogoURL, &rest.BannerURL, &rest.BannerPosition,
		&rest.Address, &rest.Lat, &rest.Lng, &rest.OpeningHours, &rest.DeliveryRadiusKm,
		&rest.DeliveryFee, &rest.DeliveryTimeMin, &rest.DeliveryTimeMax,
		&rest.IsActive, &rest.PickupEnabled, &rest.FreeDeliveryThreshold, &rest.NotificationSoundURL, &rest.CreatedAt, &rest.UpdatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	rest.Customization, _ = r.GetCustomization(ctx, rest.ID)
	return rest, nil
}

func (r *restaurantRepository) GetBySlug(ctx context.Context, slug string) (*repository.Restaurant, error) {
	query := `
		SELECT id, name, slug, description, logo_url, banner_url, banner_position, address, lat, lng,
		       opening_hours, delivery_radius_km, delivery_fee, delivery_time_min, delivery_time_max,
		       is_active, pickup_enabled, free_delivery_threshold, notification_sound_url, created_at, updated_at
		FROM restaurants WHERE slug = $1
	`

	rest := &repository.Restaurant{}
	err := r.db.QueryRowContext(ctx, query, slug).Scan(
		&rest.ID, &rest.Name, &rest.Slug, &rest.Description, &rest.LogoURL, &rest.BannerURL, &rest.BannerPosition,
		&rest.Address, &rest.Lat, &rest.Lng, &rest.OpeningHours, &rest.DeliveryRadiusKm,
		&rest.DeliveryFee, &rest.DeliveryTimeMin, &rest.DeliveryTimeMax,
		&rest.IsActive, &rest.PickupEnabled, &rest.FreeDeliveryThreshold, &rest.NotificationSoundURL, &rest.CreatedAt, &rest.UpdatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	rest.Customization, _ = r.GetCustomization(ctx, rest.ID)
	return rest, nil
}

func (r *restaurantRepository) List(ctx context.Context, activeOnly bool, page, pageSize int) ([]*repository.Restaurant, int, error) {
	countQuery := `SELECT COUNT(*) FROM restaurants`
	listQuery := `
		SELECT id, name, slug, description, logo_url, banner_url, banner_position, address, lat, lng,
		       opening_hours, delivery_radius_km, delivery_fee, delivery_time_min, delivery_time_max,
		       is_active, pickup_enabled, free_delivery_threshold, notification_sound_url, created_at, updated_at
		FROM restaurants
	`

	if activeOnly {
		countQuery += " WHERE is_active = true"
		listQuery += " WHERE is_active = true"
	}

	listQuery += " ORDER BY position ASC, created_at ASC LIMIT $1 OFFSET $2"

	var total int
	if err := r.db.QueryRowContext(ctx, countQuery).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	rows, err := r.db.QueryContext(ctx, listQuery, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var restaurants []*repository.Restaurant
	for rows.Next() {
		rest := &repository.Restaurant{}
		if err := rows.Scan(
			&rest.ID, &rest.Name, &rest.Slug, &rest.Description, &rest.LogoURL, &rest.BannerURL, &rest.BannerPosition,
			&rest.Address, &rest.Lat, &rest.Lng, &rest.OpeningHours, &rest.DeliveryRadiusKm,
			&rest.DeliveryFee, &rest.DeliveryTimeMin, &rest.DeliveryTimeMax,
			&rest.IsActive, &rest.PickupEnabled, &rest.FreeDeliveryThreshold, &rest.NotificationSoundURL, &rest.CreatedAt, &rest.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		rest.Customization, _ = r.GetCustomization(ctx, rest.ID)
		restaurants = append(restaurants, rest)
	}

	return restaurants, total, rows.Err()
}

func (r *restaurantRepository) Update(ctx context.Context, restaurant *repository.Restaurant) error {
	query := `
		UPDATE restaurants SET
			name = $2, slug = $3, description = $4, logo_url = $5, banner_url = $6, banner_position = $7,
			address = $8, lat = $9, lng = $10, opening_hours = $11, delivery_radius_km = $12,
			delivery_fee = $13, delivery_time_min = $14, delivery_time_max = $15,
			is_active = $16, pickup_enabled = $17, free_delivery_threshold = $18,
			notification_sound_url = $19, updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at
	`

	return r.db.QueryRowContext(
		ctx, query,
		restaurant.ID, restaurant.Name, restaurant.Slug, restaurant.Description,
		restaurant.LogoURL, restaurant.BannerURL, restaurant.BannerPosition, restaurant.Address, restaurant.Lat,
		restaurant.Lng, restaurant.OpeningHours, restaurant.DeliveryRadiusKm,
		restaurant.DeliveryFee, restaurant.DeliveryTimeMin, restaurant.DeliveryTimeMax,
		restaurant.IsActive, restaurant.PickupEnabled, restaurant.FreeDeliveryThreshold,
		restaurant.NotificationSoundURL,
	).Scan(&restaurant.UpdatedAt)
}

func (r *restaurantRepository) Reorder(ctx context.Context, ids []string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck
	for i, id := range ids {
		if _, err := tx.ExecContext(ctx, `UPDATE restaurants SET position = $1 WHERE id = $2`, i, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *restaurantRepository) ExistsBySlug(ctx context.Context, slug string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM restaurants WHERE slug = $1)`
	var exists bool
	err := r.db.QueryRowContext(ctx, query, slug).Scan(&exists)
	return exists, err
}

func (r *restaurantRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM restaurants WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *restaurantRepository) GetCustomization(ctx context.Context, restaurantID string) (*repository.Customization, error) {
	query := `
		SELECT id, restaurant_id, primary_color, secondary_color, font, theme, created_at, updated_at
		FROM restaurant_customization WHERE restaurant_id = $1
	`

	c := &repository.Customization{}
	err := r.db.QueryRowContext(ctx, query, restaurantID).Scan(
		&c.ID, &c.RestaurantID, &c.PrimaryColor, &c.SecondaryColor, &c.Font, &c.Theme, &c.CreatedAt, &c.UpdatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return c, nil
}

func (r *restaurantRepository) UpsertCustomization(ctx context.Context, c *repository.Customization) error {
	query := `
		INSERT INTO restaurant_customization (restaurant_id, primary_color, secondary_color, font, theme)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (restaurant_id) DO UPDATE SET
			primary_color = EXCLUDED.primary_color,
			secondary_color = EXCLUDED.secondary_color,
			font = EXCLUDED.font,
			theme = EXCLUDED.theme,
			updated_at = NOW()
		RETURNING id, created_at, updated_at
	`

	return r.db.QueryRowContext(
		ctx, query,
		c.RestaurantID, c.PrimaryColor, c.SecondaryColor, c.Font, c.Theme,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}
