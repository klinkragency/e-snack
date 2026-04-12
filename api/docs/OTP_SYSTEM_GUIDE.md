# Guide du Système d'Authentification OTP

## Vue d'ensemble

Système d'authentification complet avec :
- ✅ Vérification email par OTP à l'inscription
- ✅ Reset password avec code OTP par email
- ✅ Gestion de sessions avancée avec Redis
- ✅ Rate limiting multi-niveaux
- ✅ Audit trail complet

## Architecture

### Stockage Hybride
- **Redis** : Validation rapide, TTL automatique, clé = `otp:{user_id}:{type}`
- **PostgreSQL** : Audit, compliance, historique permanent

### Sécurité
- Codes OTP hashés avec bcrypt (jamais en clair)
- Rate limiting : 3 demandes / 30 min par user
- Tentatives limitées : 5 max par code
- Expiration : 10 min (email verify), 30 min (password reset)

## API Endpoints

### 1. Email Verification Flow

#### A. Envoyer le code de vérification
```bash
POST /api/v1/auth/verify-email/send
Authorization: Bearer {access_token}
Content-Type: application/json
{}

Response:
{
  "success": true,
  "message": "Verification code sent to your email"
}
```

#### B. Vérifier le code
```bash
POST /api/v1/auth/verify-email
Authorization: Bearer {access_token}
Content-Type: application/json
{
  "code": "123456"
}

Response:
{
  "success": true,
  "message": "Email verified successfully"
}
```

### 2. Password Reset Flow

#### A. Demander un code de reset
```bash
POST /api/v1/auth/forgot-password
Content-Type: application/json
{
  "email": "user@example.com"
}

Response (toujours success pour éviter email enumeration):
{
  "success": true,
  "message": "If this email exists, a verification code has been sent"
}
```

#### B. Vérifier le code de reset
```bash
POST /api/v1/auth/verify-reset-code
Content-Type: application/json
{
  "email": "user@example.com",
  "code": "654321"
}

Response:
{
  "success": true,
  "message": "Code verified successfully",
  "resetToken": "reset_user-id_timestamp"
}
```

#### C. Réinitialiser le mot de passe
```bash
POST /api/v1/auth/reset-password
Content-Type: application/json
{
  "resetToken": "reset_user-id_timestamp",
  "newPassword": "newSecurePassword123"
}

Response:
{
  "success": true,
  "message": "Password reset successfully"
}
```

## Test End-to-End

### Scénario 1 : Email Verification

```bash
# 1. Créer un compte
RESPONSE=$(curl -s http://localhost:8080/api/v1/auth/register \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "phone": "0612345678"
  }')

# 2. Extraire le token
TOKEN=$(echo "$RESPONSE" | jq -r '.accessToken')
echo "User created with email_verified=false"

# 3. Demander un code de vérification
curl -s http://localhost:8080/api/v1/auth/verify-email/send \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# 4. Récupérer le code depuis les logs du serveur (dev mode)
# En production, le code sera envoyé par email

# 5. Vérifier avec le code
curl -s http://localhost:8080/api/v1/auth/verify-email \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "123456"
  }'

# 6. Vérifier le profil
curl -s http://localhost:8080/api/v1/auth/profile \
  -H "Authorization: Bearer $TOKEN" | jq '.emailVerified'
# Output: true
```

### Scénario 2 : Password Reset

```bash
# 1. Demander un reset
curl -s http://localhost:8080/api/v1/auth/forgot-password \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'

# 2. Récupérer le code depuis les logs (dev) ou email (prod)

# 3. Vérifier le code et obtenir reset token
RESET_RESPONSE=$(curl -s http://localhost:8080/api/v1/auth/verify-reset-code \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "code": "654321"
  }')

RESET_TOKEN=$(echo "$RESET_RESPONSE" | jq -r '.resetToken')

# 4. Réinitialiser le mot de passe
curl -s http://localhost:8080/api/v1/auth/reset-password \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"resetToken\": \"$RESET_TOKEN\",
    \"newPassword\": \"newSecurePass123\"
  }"

# 5. Se connecter avec le nouveau mot de passe
curl -s http://localhost:8080/api/v1/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "newSecurePass123"
  }'
```

## Vérification en Base de Données

### Voir les codes OTP actifs
```sql
SELECT
    u.email,
    o.otp_type,
    o.destination,
    o.attempt_count,
    o.max_attempts,
    o.created_at,
    o.expires_at,
    o.verified_at
FROM otp_codes o
JOIN users u ON o.user_id = u.id
WHERE o.revoked_at IS NULL
ORDER BY o.created_at DESC;
```

### Voir l'audit trail
```sql
SELECT
    u.email,
    oa.action,
    oa.ip_address,
    oa.created_at
FROM otp_audit oa
JOIN users u ON oa.user_id = u.id
ORDER BY oa.created_at DESC
LIMIT 20;
```

### Vérifier les utilisateurs vérifiés
```sql
SELECT
    email,
    email_verified,
    phone_verified,
    two_factor_enabled,
    failed_login_attempts,
    locked_until,
    last_login_at
FROM users
ORDER BY created_at DESC;
```

## Rate Limiting

Le système limite automatiquement :
- **OTP requests** : 3 max / 30 min par user et type
- **Code attempts** : 5 max par code OTP
- **Failed logins** : 5 max / 30 min (future feature)

### Tester le rate limiting
```bash
# Envoi de 3 codes (ok)
for i in {1..3}; do
  curl -s http://localhost:8080/api/v1/auth/verify-email/send \
    -H "Authorization: Bearer $TOKEN" \
    -d '{}' | jq '.success'
done

# 4ème tentative (bloqué)
curl -s http://localhost:8080/api/v1/auth/verify-email/send \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}' | jq '.message'
# Output: "trop de tentatives, réessayez dans 30 minutes"
```

## Configuration Production

### 1. Configurer SendGrid

```bash
# .env
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=SG.your-api-key-here
EMAIL_FROM=noreply@beldys.club
EMAIL_FROM_NAME=Beldys Club
```

### 2. Implémenter SendGrid (TODO)

Dans `internal/service/email/service.go`, remplacer le stub :

```go
func (s *sendgridService) send(to, subject, html string) error {
    from := mail.NewEmail(s.from, s.from)
    toEmail := mail.NewEmail("", to)
    message := mail.NewSingleEmail(from, subject, toEmail, "", html)

    client := sendgrid.NewSendClient(s.apiKey)
    response, err := client.Send(message)

    if err != nil {
        return fmt.Errorf("failed to send email: %w", err)
    }

    if response.StatusCode >= 400 {
        return fmt.Errorf("sendgrid error: %d", response.StatusCode)
    }

    return nil
}
```

### 3. Monitoring

Mettre en place :
- Alertes sur taux d'échec d'envoi d'emails
- Métriques sur codes OTP générés/vérifiés
- Dashboard pour audit trail

## Sécurité Best Practices

### ✅ Implémenté
- Codes hashés avec bcrypt
- Rate limiting Redis
- Email enumeration protection
- Expiration automatique
- Audit trail complet

### 🔜 Recommandations
- [ ] HTTPS obligatoire en production
- [ ] Configurer CORS strictement
- [ ] Ajouter header X-RateLimit-*
- [ ] Log monitoring avec alertes
- [ ] 2FA/TOTP pour admins

## Dépannage

### Code OTP non reçu
1. Vérifier les logs serveur : `[EMAIL] To: ...`
2. Vérifier Redis : `redis-cli GET "otp:user-id:email_verify"`
3. Vérifier base de données : `SELECT * FROM otp_codes WHERE user_id = '...'`

### Rate limit atteint
```bash
# Nettoyer Redis (dev uniquement)
redis-cli DEL "otp:rate:user-id:email_verify"
```

### Token expiré
Les JWT access tokens expirent après 15 minutes. Utiliser refresh token :
```bash
curl -s http://localhost:8080/api/v1/auth/refresh \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

## Métriques

Pour surveiller le système en production :

```sql
-- Taux de vérification email
SELECT
    COUNT(CASE WHEN email_verified THEN 1 END) * 100.0 / COUNT(*) as verification_rate
FROM users
WHERE created_at > NOW() - INTERVAL '7 days';

-- Codes OTP générés par jour
SELECT
    DATE(created_at) as date,
    otp_type,
    COUNT(*) as count
FROM otp_codes
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), otp_type
ORDER BY date DESC;

-- Tentatives échouées
SELECT
    COUNT(*) as failed_attempts
FROM otp_codes
WHERE attempt_count >= max_attempts
    AND created_at > NOW() - INTERVAL '24 hours';
```

## Support

Pour plus d'informations :
- Architecture : Voir `/docs/ARCHITECTURE.md`
- API complète : Voir `/docs/openapi.yaml`
- Sécurité : Voir `/docs/SECURITY.md`
