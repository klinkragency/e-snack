package postgres

import (
	"context"
	"database/sql"

	"github.com/beldys/api/internal/repository"
)

type otpRepository struct {
	db *sql.DB
}

func NewOTPRepository(db *sql.DB) repository.OTPRepository {
	return &otpRepository{db: db}
}

func (r *otpRepository) Create(ctx context.Context, otp *repository.OTPCode) error {
	query := `
		INSERT INTO otp_codes (user_id, code_hash, otp_type, destination, max_attempts, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id, otp_type)
		DO UPDATE SET
			code_hash = EXCLUDED.code_hash,
			destination = EXCLUDED.destination,
			attempt_count = 0,
			created_at = NOW(),
			expires_at = EXCLUDED.expires_at,
			verified_at = NULL,
			revoked_at = NULL
		RETURNING id, created_at
	`
	return r.db.QueryRowContext(ctx, query,
		otp.UserID, otp.CodeHash, otp.OTPType, otp.Destination, otp.MaxAttempts, otp.ExpiresAt,
	).Scan(&otp.ID, &otp.CreatedAt)
}

func (r *otpRepository) GetActiveByUserAndType(ctx context.Context, userID, otpType string) (*repository.OTPCode, error) {
	query := `
		SELECT id, user_id, code_hash, otp_type, destination, attempt_count, max_attempts,
		       created_at, expires_at, verified_at, revoked_at
		FROM otp_codes
		WHERE user_id = $1 AND otp_type = $2
		  AND verified_at IS NULL
		  AND revoked_at IS NULL
		  AND expires_at > NOW()
	`

	otp := &repository.OTPCode{}
	err := r.db.QueryRowContext(ctx, query, userID, otpType).Scan(
		&otp.ID, &otp.UserID, &otp.CodeHash, &otp.OTPType, &otp.Destination,
		&otp.AttemptCount, &otp.MaxAttempts, &otp.CreatedAt, &otp.ExpiresAt,
		&otp.VerifiedAt, &otp.RevokedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	return otp, err
}

func (r *otpRepository) IncrementAttempts(ctx context.Context, id string) error {
	query := `UPDATE otp_codes SET attempt_count = attempt_count + 1 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *otpRepository) MarkAsVerified(ctx context.Context, id string) error {
	query := `UPDATE otp_codes SET verified_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *otpRepository) RevokeByUserAndType(ctx context.Context, userID, otpType string) error {
	query := `UPDATE otp_codes SET revoked_at = NOW() WHERE user_id = $1 AND otp_type = $2 AND revoked_at IS NULL`
	_, err := r.db.ExecContext(ctx, query, userID, otpType)
	return err
}

func (r *otpRepository) DeleteExpired(ctx context.Context) (int, error) {
	query := `DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '7 days'`
	result, err := r.db.ExecContext(ctx, query)
	if err != nil {
		return 0, err
	}
	count, _ := result.RowsAffected()
	return int(count), nil
}
