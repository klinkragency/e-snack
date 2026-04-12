package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/beldys/api/internal/repository"
)

type paymentWebhookRepository struct {
	db *sql.DB
}

func NewPaymentWebhookRepository(db *sql.DB) repository.PaymentWebhookRepository {
	return &paymentWebhookRepository{db: db}
}

// Upsert insère un événement webhook. Si le mollie_id existe déjà et est déjà traité,
// l'insertion est ignorée (idempotent).
func (r *paymentWebhookRepository) Upsert(ctx context.Context, mollieID string) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO payment_webhook_events (mollie_id)
		VALUES ($1)
		ON CONFLICT DO NOTHING
	`, mollieID)
	return err
}

// ListPending retourne les événements en attente (max 5 tentatives).
func (r *paymentWebhookRepository) ListPending(ctx context.Context, limit int) ([]*repository.PaymentWebhookEvent, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, mollie_id, status, attempts, last_error, received_at, processed_at
		FROM payment_webhook_events
		WHERE status = 'pending' AND attempts < 5
		ORDER BY received_at ASC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*repository.PaymentWebhookEvent
	for rows.Next() {
		e := &repository.PaymentWebhookEvent{}
		if err := rows.Scan(&e.ID, &e.MollieID, &e.Status, &e.Attempts, &e.LastError, &e.ReceivedAt, &e.ProcessedAt); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

// MarkProcessed marque un événement comme traité avec succès.
func (r *paymentWebhookRepository) MarkProcessed(ctx context.Context, id string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx, `
		UPDATE payment_webhook_events
		SET status = 'processed', processed_at = $2
		WHERE id = $1
	`, id, now)
	return err
}

// MarkFailed marque un événement comme définitivement échoué (après épuisement des retries).
func (r *paymentWebhookRepository) MarkFailed(ctx context.Context, id, errMsg string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE payment_webhook_events
		SET status = 'failed', last_error = $2, attempts = attempts + 1
		WHERE id = $1
	`, id, errMsg)
	return err
}

// IncrementAttempts incrémente le compteur et stocke le dernier message d'erreur.
func (r *paymentWebhookRepository) IncrementAttempts(ctx context.Context, id, errMsg string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE payment_webhook_events
		SET attempts = attempts + 1, last_error = $2
		WHERE id = $1
	`, id, errMsg)
	return err
}

// InsertPaymentEvent écrit une entrée dans l'audit trail.
func (r *paymentWebhookRepository) InsertPaymentEvent(ctx context.Context, event *repository.PaymentEvent) error {
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO payment_events (order_id, mollie_id, event_type, amount, metadata)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`, event.OrderID, event.MollieID, event.EventType, event.Amount, event.Metadata,
	).Scan(&event.ID, &event.CreatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	return err
}
