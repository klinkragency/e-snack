package auth

import (
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrInvalidIDToken   = errors.New("invalid ID token")
	ErrUnsupportedProvider = errors.New("unsupported OAuth provider")
)

// OAuthClaims contains the verified claims from an OAuth ID token.
type OAuthClaims struct {
	Sub      string
	Email    string
	Provider string
}

// verifyGoogleToken verifies a Google ID token using Google's tokeninfo endpoint.
func verifyGoogleToken(idToken, clientID string) (*OAuthClaims, error) {
	resp, err := http.Get("https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify Google token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, ErrInvalidIDToken
	}

	var payload struct {
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified string `json:"email_verified"`
		Aud           string `json:"aud"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("failed to decode Google token response: %w", err)
	}

	if payload.Aud != clientID {
		return nil, fmt.Errorf("token audience mismatch: %w", ErrInvalidIDToken)
	}

	if payload.EmailVerified != "true" {
		return nil, fmt.Errorf("email not verified: %w", ErrInvalidIDToken)
	}

	return &OAuthClaims{
		Sub:      payload.Sub,
		Email:    payload.Email,
		Provider: "google",
	}, nil
}

// Apple JWKS caching
var (
	appleJWKSCache     *appleJWKS
	appleJWKSMu        sync.Mutex
	appleJWKSFetchedAt time.Time
)

type appleJWKS struct {
	Keys []appleJWK `json:"keys"`
}

type appleJWK struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	N   string `json:"n"`
	E   string `json:"e"`
}

func getAppleJWKS() (*appleJWKS, error) {
	appleJWKSMu.Lock()
	defer appleJWKSMu.Unlock()

	if appleJWKSCache != nil && time.Since(appleJWKSFetchedAt) < 24*time.Hour {
		return appleJWKSCache, nil
	}

	resp, err := http.Get("https://appleid.apple.com/auth/keys")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch Apple JWKS: %w", err)
	}
	defer resp.Body.Close()

	var jwks appleJWKS
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return nil, fmt.Errorf("failed to decode Apple JWKS: %w", err)
	}

	appleJWKSCache = &jwks
	appleJWKSFetchedAt = time.Now()
	return &jwks, nil
}

// verifyAppleToken verifies an Apple ID token by fetching Apple's JWKS and validating the JWT.
func verifyAppleToken(idToken string) (*OAuthClaims, error) {
	// Parse without verification first to get the key ID
	parser := jwt.NewParser(jwt.WithoutClaimsValidation())
	unverified, _, err := parser.ParseUnverified(idToken, jwt.MapClaims{})
	if err != nil {
		return nil, fmt.Errorf("failed to parse Apple token: %w", ErrInvalidIDToken)
	}

	kid, ok := unverified.Header["kid"].(string)
	if !ok {
		return nil, fmt.Errorf("missing kid in Apple token header: %w", ErrInvalidIDToken)
	}

	jwks, err := getAppleJWKS()
	if err != nil {
		return nil, err
	}

	// Find the matching key
	var matchingKey *appleJWK
	for i := range jwks.Keys {
		if jwks.Keys[i].Kid == kid {
			matchingKey = &jwks.Keys[i]
			break
		}
	}
	if matchingKey == nil {
		return nil, fmt.Errorf("no matching Apple key found for kid %s: %w", kid, ErrInvalidIDToken)
	}

	// Build RSA public key
	pubKey, err := buildRSAPublicKey(matchingKey.N, matchingKey.E)
	if err != nil {
		return nil, fmt.Errorf("failed to build Apple public key: %w", err)
	}

	// Verify the token
	token, err := jwt.Parse(idToken, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return pubKey, nil
	}, jwt.WithIssuer("https://appleid.apple.com"))

	if err != nil {
		return nil, fmt.Errorf("Apple token verification failed: %w", ErrInvalidIDToken)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidIDToken
	}

	sub, _ := claims["sub"].(string)
	email, _ := claims["email"].(string)

	if sub == "" {
		return nil, fmt.Errorf("missing sub claim: %w", ErrInvalidIDToken)
	}

	return &OAuthClaims{
		Sub:      sub,
		Email:    email,
		Provider: "apple",
	}, nil
}

func buildRSAPublicKey(nStr, eStr string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(nStr)
	if err != nil {
		return nil, err
	}

	eBytes, err := base64.RawURLEncoding.DecodeString(eStr)
	if err != nil {
		return nil, err
	}

	n := new(big.Int).SetBytes(nBytes)
	e := new(big.Int).SetBytes(eBytes)

	return &rsa.PublicKey{
		N: n,
		E: int(e.Int64()),
	}, nil
}

// verifyOAuthToken dispatches to the appropriate provider verifier.
func verifyOAuthToken(provider, idToken, googleClientID string) (*OAuthClaims, error) {
	switch strings.ToLower(provider) {
	case "google":
		return verifyGoogleToken(idToken, googleClientID)
	case "apple":
		return verifyAppleToken(idToken)
	default:
		return nil, ErrUnsupportedProvider
	}
}
