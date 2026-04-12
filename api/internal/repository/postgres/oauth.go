package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/beldys/api/internal/repository"
)

type oauthAccountRepository struct {
	db *sql.DB
}

func NewOAuthAccountRepository(db *sql.DB) repository.OAuthAccountRepository {
	return &oauthAccountRepository{db: db}
}

func (r *oauthAccountRepository) Create(ctx context.Context, account *repository.OAuthAccount) error {
	query := `
		INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at
	`

	return r.db.QueryRowContext(
		ctx,
		query,
		account.UserID,
		account.Provider,
		account.ProviderUserID,
		account.Email,
	).Scan(&account.ID, &account.CreatedAt)
}

func (r *oauthAccountRepository) GetByProvider(ctx context.Context, provider, providerUserID string) (*repository.OAuthAccount, error) {
	query := `
		SELECT id, user_id, provider, provider_user_id, email, created_at
		FROM oauth_accounts
		WHERE provider = $1 AND provider_user_id = $2
	`

	account := &repository.OAuthAccount{}
	err := r.db.QueryRowContext(ctx, query, provider, providerUserID).Scan(
		&account.ID,
		&account.UserID,
		&account.Provider,
		&account.ProviderUserID,
		&account.Email,
		&account.CreatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	return account, nil
}

