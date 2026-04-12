package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/klinkragency/e-snack/internal/repository"
)

var ErrNotFound = errors.New("user not found")

type userRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) repository.UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) Create(ctx context.Context, user *repository.User) error {
	query := `
		INSERT INTO users (email, password_hash, role, phone)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`

	return r.db.QueryRowContext(
		ctx,
		query,
		user.Email,
		user.PasswordHash,
		user.Role,
		user.Phone,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
}

func (r *userRepository) GetByID(ctx context.Context, id string) (*repository.User, error) {
	query := `
		SELECT id, email, password_hash, role, phone, name, email_verified, phone_verified,
		       totp_secret, two_factor_enabled, failed_login_attempts, locked_until,
		       last_login_at, last_login_ip, is_banned, banned_at, ban_reason, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	user := &repository.User{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.Phone,
		&user.Name,
		&user.EmailVerified,
		&user.PhoneVerified,
		&user.TOTPSecret,
		&user.TwoFactorEnabled,
		&user.FailedLoginAttempts,
		&user.LockedUntil,
		&user.LastLoginAt,
		&user.LastLoginIP,
		&user.IsBanned,
		&user.BannedAt,
		&user.BanReason,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (r *userRepository) GetByEmail(ctx context.Context, email string) (*repository.User, error) {
	query := `
		SELECT id, email, password_hash, role, phone, name, email_verified, phone_verified,
		       totp_secret, two_factor_enabled, failed_login_attempts, locked_until,
		       last_login_at, last_login_ip, is_banned, banned_at, ban_reason, created_at, updated_at
		FROM users
		WHERE email = $1
	`

	user := &repository.User{}
	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.Phone,
		&user.Name,
		&user.EmailVerified,
		&user.PhoneVerified,
		&user.TOTPSecret,
		&user.TwoFactorEnabled,
		&user.FailedLoginAttempts,
		&user.LockedUntil,
		&user.LastLoginAt,
		&user.LastLoginIP,
		&user.IsBanned,
		&user.BannedAt,
		&user.BanReason,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (r *userRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`

	var exists bool
	err := r.db.QueryRowContext(ctx, query, email).Scan(&exists)
	return exists, err
}

func (r *userRepository) MarkEmailVerified(ctx context.Context, userID string) error {
	query := `UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, userID)
	return err
}

func (r *userRepository) UpdatePassword(ctx context.Context, userID, passwordHash string) error {
	query := `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, userID, passwordHash)
	return err
}

func (r *userRepository) IncrementFailedLogins(ctx context.Context, userID string) error {
	query := `UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, userID)
	return err
}

func (r *userRepository) ResetFailedLogins(ctx context.Context, userID string) error {
	query := `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, userID)
	return err
}

func (r *userRepository) UpdateProfile(ctx context.Context, userID string, name, phone *string) error {
	query := `UPDATE users SET name = COALESCE($2, name), phone = COALESCE($3, phone), updated_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, userID, name, phone)
	return err
}

func (r *userRepository) LockAccount(ctx context.Context, userID string, duration time.Duration) error {
	query := `UPDATE users SET locked_until = NOW() + $2::interval WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, userID, duration)
	return err
}

func (r *userRepository) UpdateTOTPSecret(ctx context.Context, userID string, secret *string) error {
	query := `UPDATE users SET totp_secret = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, userID, secret)
	return err
}

func (r *userRepository) Enable2FA(ctx context.Context, userID string) error {
	query := `UPDATE users SET two_factor_enabled = TRUE, updated_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, userID)
	return err
}

func (r *userRepository) Disable2FA(ctx context.Context, userID string) error {
	query := `UPDATE users SET two_factor_enabled = FALSE, totp_secret = NULL, updated_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, userID)
	return err
}

// ==================== Admin Methods ====================

func (r *userRepository) List(ctx context.Context, page, pageSize int, roleFilter string) ([]*repository.User, int, error) {
	var total int
	offset := (page - 1) * pageSize

	if roleFilter != "" {
		countQuery := `SELECT COUNT(*) FROM users WHERE role = $1`
		if err := r.db.QueryRowContext(ctx, countQuery, roleFilter).Scan(&total); err != nil {
			return nil, 0, err
		}

		listQuery := `
			SELECT id, email, password_hash, role, phone, name, email_verified, phone_verified,
			       totp_secret, two_factor_enabled, failed_login_attempts, locked_until,
			       last_login_at, last_login_ip, is_banned, banned_at, ban_reason, created_at, updated_at
			FROM users WHERE role = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
		`
		rows, err := r.db.QueryContext(ctx, listQuery, roleFilter, pageSize, offset)
		if err != nil {
			return nil, 0, err
		}
		defer rows.Close()
		return scanUsers(rows, total)
	}

	countQuery := `SELECT COUNT(*) FROM users`
	if err := r.db.QueryRowContext(ctx, countQuery).Scan(&total); err != nil {
		return nil, 0, err
	}

	listQuery := `
		SELECT id, email, password_hash, role, phone, name, email_verified, phone_verified,
		       totp_secret, two_factor_enabled, failed_login_attempts, locked_until,
		       last_login_at, last_login_ip, is_banned, banned_at, ban_reason, created_at, updated_at
		FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2
	`
	rows, err := r.db.QueryContext(ctx, listQuery, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	return scanUsers(rows, total)
}

func scanUsers(rows *sql.Rows, total int) ([]*repository.User, int, error) {
	var users []*repository.User
	for rows.Next() {
		user := &repository.User{}
		if err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.PasswordHash,
			&user.Role,
			&user.Phone,
			&user.Name,
			&user.EmailVerified,
			&user.PhoneVerified,
			&user.TOTPSecret,
			&user.TwoFactorEnabled,
			&user.FailedLoginAttempts,
			&user.LockedUntil,
			&user.LastLoginAt,
			&user.LastLoginIP,
			&user.IsBanned,
			&user.BannedAt,
			&user.BanReason,
			&user.CreatedAt,
			&user.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		users = append(users, user)
	}
	return users, total, rows.Err()
}

func (r *userRepository) Delete(ctx context.Context, userID string) error {
	query := `DELETE FROM users WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, userID)
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

func (r *userRepository) Ban(ctx context.Context, userID, reason string) error {
	query := `UPDATE users SET is_banned = TRUE, banned_at = NOW(), ban_reason = $2, updated_at = NOW() WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, userID, reason)
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

func (r *userRepository) Unban(ctx context.Context, userID string) error {
	query := `UPDATE users SET is_banned = FALSE, banned_at = NULL, ban_reason = NULL, updated_at = NOW() WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, userID)
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

func (r *userRepository) UpdateRole(ctx context.Context, userID, role string) error {
	query := `UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, userID, role)
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
