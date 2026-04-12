package repository

import (
	"context"
	"encoding/json"
	"time"
)

// ==================== User ====================

type User struct {
	ID                  string
	Email               string
	PasswordHash        *string
	Role                string
	Phone               *string
	Name                *string
	EmailVerified       bool
	PhoneVerified       bool
	TOTPSecret          *string
	TwoFactorEnabled    bool
	FailedLoginAttempts int
	LockedUntil         *time.Time
	LastLoginAt         *time.Time
	LastLoginIP         *string
	IsBanned            bool
	BannedAt            *time.Time
	BanReason           *string
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

type UserRepository interface {
	Create(ctx context.Context, user *User) error
	GetByID(ctx context.Context, id string) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	ExistsByEmail(ctx context.Context, email string) (bool, error)
	MarkEmailVerified(ctx context.Context, userID string) error
	UpdatePassword(ctx context.Context, userID, passwordHash string) error
	IncrementFailedLogins(ctx context.Context, userID string) error
	ResetFailedLogins(ctx context.Context, userID string) error
	LockAccount(ctx context.Context, userID string, duration time.Duration) error
	UpdateProfile(ctx context.Context, userID string, name, phone *string) error
	UpdateTOTPSecret(ctx context.Context, userID string, secret *string) error
	Enable2FA(ctx context.Context, userID string) error
	Disable2FA(ctx context.Context, userID string) error
	// Admin methods
	List(ctx context.Context, page, pageSize int, roleFilter string) ([]*User, int, error)
	Delete(ctx context.Context, userID string) error
	Ban(ctx context.Context, userID, reason string) error
	Unban(ctx context.Context, userID string) error
	UpdateRole(ctx context.Context, userID, role string) error
}

// ==================== Delivery Address ====================

type DeliveryAddress struct {
	ID        string
	UserID    string
	Label     string
	Address   string
	Lat       *float64
	Lng       *float64
	IsDefault bool
	CreatedAt time.Time
	UpdatedAt time.Time
}

type DeliveryAddressRepository interface {
	ListByUser(ctx context.Context, userID string) ([]*DeliveryAddress, error)
	Create(ctx context.Context, addr *DeliveryAddress) error
	Update(ctx context.Context, addr *DeliveryAddress) error
	Delete(ctx context.Context, id, userID string) error
	GetByID(ctx context.Context, id, userID string) (*DeliveryAddress, error)
	SetDefault(ctx context.Context, id, userID string) error
}

// ==================== OTP Code ====================

type OTPCode struct {
	ID           string
	UserID       string
	CodeHash     string
	OTPType      string // email_verify, phone_verify, password_reset, 2fa_login
	Destination  string
	AttemptCount int
	MaxAttempts  int
	CreatedAt    time.Time
	ExpiresAt    time.Time
	VerifiedAt   *time.Time
	RevokedAt    *time.Time
}

type OTPRepository interface {
	Create(ctx context.Context, otp *OTPCode) error
	GetActiveByUserAndType(ctx context.Context, userID, otpType string) (*OTPCode, error)
	IncrementAttempts(ctx context.Context, id string) error
	MarkAsVerified(ctx context.Context, id string) error
	RevokeByUserAndType(ctx context.Context, userID, otpType string) error
	DeleteExpired(ctx context.Context) (int, error)
}

// ==================== OAuth Account ====================

type OAuthAccount struct {
	ID             string
	UserID         string
	Provider       string
	ProviderUserID string
	Email          string
	CreatedAt      time.Time
}

type OAuthAccountRepository interface {
	Create(ctx context.Context, account *OAuthAccount) error
	GetByProvider(ctx context.Context, provider, providerUserID string) (*OAuthAccount, error)
}

// ==================== Restaurant ====================

type Restaurant struct {
	ID                    string
	Name                  string
	Slug                  string
	Description           *string
	LogoURL               *string
	BannerURL             *string
	BannerPosition        *string // JSON: {"x": 50, "y": 50}
	Address               string
	Lat                   *float64
	Lng                   *float64
	OpeningHours          json.RawMessage
	DeliveryRadiusKm      float64
	DeliveryFee           float64 // in euros, e.g. 2.90
	DeliveryTimeMin       int     // estimated delivery time range min (minutes)
	DeliveryTimeMax       int     // estimated delivery time range max (minutes)
	FreeDeliveryThreshold float64 // subtotal threshold above which delivery is free (0 = disabled)
	IsActive              bool
	PickupEnabled         bool
	NotificationSoundURL  *string
	Customization         *Customization
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

type Customization struct {
	ID             string
	RestaurantID   string
	PrimaryColor   string
	SecondaryColor string
	Font           string
	Theme          string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type RestaurantRepository interface {
	Create(ctx context.Context, restaurant *Restaurant) error
	GetByID(ctx context.Context, id string) (*Restaurant, error)
	GetBySlug(ctx context.Context, slug string) (*Restaurant, error)
	List(ctx context.Context, activeOnly bool, page, pageSize int) ([]*Restaurant, int, error)
	Update(ctx context.Context, restaurant *Restaurant) error
	Delete(ctx context.Context, id string) error
	Reorder(ctx context.Context, ids []string) error
	ExistsBySlug(ctx context.Context, slug string) (bool, error)
	GetCustomization(ctx context.Context, restaurantID string) (*Customization, error)
	UpsertCustomization(ctx context.Context, customization *Customization) error
}

// ==================== Category ====================

type Category struct {
	ID           string
	RestaurantID string
	Name         string
	Position     int
	IsActive     bool
	Products     []*Product
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type CategoryRepository interface {
	Create(ctx context.Context, category *Category) error
	GetByID(ctx context.Context, id string) (*Category, error)
	ListByRestaurant(ctx context.Context, restaurantID string) ([]*Category, error)
	Update(ctx context.Context, category *Category) error
	Delete(ctx context.Context, id string) error
}

// ==================== Product ====================

type Product struct {
	ID              string
	CategoryID      string
	Name            string
	Description     *string
	Price           float64
	ImageURL        *string
	IsAvailable     bool
	Position        int
	Allergens       json.RawMessage
	NutritionalInfo json.RawMessage
	Options         []*ProductOption
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type ProductRepository interface {
	Create(ctx context.Context, product *Product) error
	GetByID(ctx context.Context, id string) (*Product, error)
	ListByCategory(ctx context.Context, categoryID string) ([]*Product, error)
	Update(ctx context.Context, product *Product) error
	Delete(ctx context.Context, id string) error
	SetAvailability(ctx context.Context, id string, available bool) error
}

// ==================== Product Options ====================

type ProductOption struct {
	ID            string
	ProductID     string
	Name          string
	Type          string // single or multiple
	IsRequired    bool
	MaxSelections int // 0 = unlimited
	Choices       []*OptionChoice
	CreatedAt     time.Time
}

type OptionChoice struct {
	ID            string
	OptionID      string
	Name          string
	PriceModifier float64
	CreatedAt     time.Time
}

type ProductOptionRepository interface {
	Create(ctx context.Context, option *ProductOption) error
	GetByID(ctx context.Context, id string) (*ProductOption, error)
	ListByProduct(ctx context.Context, productID string) ([]*ProductOption, error)
	Update(ctx context.Context, option *ProductOption) error
	Delete(ctx context.Context, id string) error
	AddChoice(ctx context.Context, choice *OptionChoice) error
	UpdateChoice(ctx context.Context, choice *OptionChoice) error
	DeleteChoice(ctx context.Context, id string) error
}

// ==================== Formula (combo menus) ====================

type Formula struct {
	ID          string
	CategoryID  string
	Name        string
	Description *string
	BasePrice   float64
	ImageURL    *string
	IsAvailable bool
	Position    int
	Products    []*FormulaProduct
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type FormulaProduct struct {
	ID         string
	FormulaID  string
	ProductID  string
	Product    *Product // loaded with options
	Position   int
	GroupLabel *string // nil = fixed product, non-nil = choice group label (e.g. "Boisson au choix")
	CreatedAt  time.Time
}

type FormulaProductInput struct {
	ProductID  string
	GroupLabel string // empty = fixed product
}

type FormulaRepository interface {
	Create(ctx context.Context, formula *Formula, products []FormulaProductInput) error
	GetByID(ctx context.Context, id string) (*Formula, error)
	ListByCategory(ctx context.Context, categoryID string) ([]*Formula, error)
	Update(ctx context.Context, formula *Formula, products []FormulaProductInput) error
	Delete(ctx context.Context, id string) error
	SetAvailability(ctx context.Context, id string, available bool) error
}

// ==================== Order ====================

type Order struct {
	ID                   string
	OrderNumber          int64
	UserID               string
	RestaurantID         string
	OrderType            string // delivery, pickup, dine_in
	Status               string
	Subtotal             float64
	DeliveryFee          float64
	Discount             float64
	Total                float64
	DeliveryAddress      *string
	DeliveryLat          *float64
	DeliveryLng          *float64
	DeliveryInstructions *string
	TableNumber          *string
	ScheduledPickupTime  *time.Time
	PaymentIntentID      *string
	PaymentStatus        string
	PromoCodeID          *string
	CustomerNotes        string
	EstimatedPrepMinutes *int32
	DriverID             *string
	Items                []*OrderItem
	StatusHistory        []*OrderStatusHistory
	CreatedAt            time.Time
	UpdatedAt            time.Time
	CompletedAt          *time.Time
	// Joined fields (not stored directly)
	CustomerName  string
	CustomerEmail string
	CustomerPhone string
	DriverName    string
	DriverPhone   string
}

type OrderItem struct {
	ID          string
	OrderID     string
	ProductID   *string // nullable for formula items
	ProductName string
	UnitPrice   float64
	Quantity    int
	Total       float64
	Notes       *string
	Options     []*OrderItemOption
	// Formula support
	ItemType        string // "product" or "formula"
	FormulaID       *string
	FormulaName     string
	FormulaProducts []*OrderFormulaProduct
	CreatedAt       time.Time
}

type OrderFormulaProduct struct {
	ID          string
	OrderItemID string
	ProductID   *string
	ProductName string
	Position    int
	Options     []*OrderFormulaProductOption
	CreatedAt   time.Time
}

type OrderFormulaProductOption struct {
	ID                    string
	OrderFormulaProductID string
	OptionChoiceID        *string
	OptionName            string
	ChoiceName            string
	PriceModifier         float64
	CreatedAt             time.Time
}

type OrderItemOption struct {
	ID             string
	OrderItemID    string
	OptionChoiceID *string
	OptionName     string
	ChoiceName     string
	PriceModifier  float64
	CreatedAt      time.Time
}

type OrderStatusHistory struct {
	ID        string
	OrderID   string
	Status    string
	ChangedBy *string
	Notes     *string
	CreatedAt time.Time
}

type OrderRepository interface {
	Create(ctx context.Context, order *Order) error
	GetByID(ctx context.Context, id string) (*Order, error)
	GetByPaymentIntentID(ctx context.Context, paymentIntentID string) (*Order, error)
	ListByUser(ctx context.Context, userID string, page, pageSize int) ([]*Order, int, error)
	ListByRestaurant(ctx context.Context, restaurantID string, status string, page, pageSize int) ([]*Order, int, error)
	UpdateStatus(ctx context.Context, id, status string, changedBy *string, notes *string) error
	UpdatePaymentStatus(ctx context.Context, id, paymentStatus string, paymentIntentID *string) error
	AddStatusHistory(ctx context.Context, history *OrderStatusHistory) error
	CountByUser(ctx context.Context, userID string) (int, error)
	// ConfirmPaymentTx confirme un paiement de façon atomique:
	// met à jour payment_status='paid', status='confirmed', insère un payment_event.
	ConfirmPaymentTx(ctx context.Context, orderID, mollieID string, amount float64) error
	// FailPaymentTx marque un paiement échoué/expiré de façon atomique.
	FailPaymentTx(ctx context.Context, orderID, mollieID, reason string) error
	// UpdatePrepTime met à jour le temps de préparation estimé (en minutes).
	UpdatePrepTime(ctx context.Context, id string, minutes int32) error
}

// ==================== Payment Webhook / Audit ====================

// PaymentWebhookEvent représente un événement webhook Mollie dans la table outbox.
type PaymentWebhookEvent struct {
	ID          string
	MollieID    string
	Status      string // pending | processed | failed
	Attempts    int
	LastError   *string
	ReceivedAt  time.Time
	ProcessedAt *time.Time
}

// PaymentEvent représente une entrée dans l'audit trail des paiements.
type PaymentEvent struct {
	ID        string
	OrderID   string
	MollieID  *string
	EventType string // created | paid | failed | refunded | expired | webhook_received
	Amount    *float64
	Metadata  *json.RawMessage
	CreatedAt time.Time
}

// PaymentWebhookRepository gère la table outbox des webhooks Mollie.
type PaymentWebhookRepository interface {
	// Upsert insère ou ignore un événement (idempotent sur mollie_id).
	Upsert(ctx context.Context, mollieID string) error
	// ListPending retourne les événements à traiter (status=pending, attempts<5).
	ListPending(ctx context.Context, limit int) ([]*PaymentWebhookEvent, error)
	// MarkProcessed marque un événement comme traité.
	MarkProcessed(ctx context.Context, id string) error
	// MarkFailed marque un événement comme définitivement échoué.
	MarkFailed(ctx context.Context, id, errMsg string) error
	// IncrementAttempts incrémente le compteur de tentatives et stocke l'erreur.
	IncrementAttempts(ctx context.Context, id, errMsg string) error
	// InsertPaymentEvent écrit une entrée dans l'audit trail.
	InsertPaymentEvent(ctx context.Context, event *PaymentEvent) error
}

// ==================== Promo Code ====================

type PromoCode struct {
	ID                string
	Code              string
	DiscountType      string // percentage, fixed_amount, free_delivery
	DiscountValue     float64
	MinOrderAmount    *float64
	MaxDiscountAmount *float64
	MaxTotalUses      *int
	MaxUsesPerUser    int
	FirstOrderOnly    bool
	StartsAt          time.Time
	ExpiresAt         *time.Time
	IsActive          bool
	CurrentUses       int
	Description       *string
	RestaurantIDs     []string // Populated from junction table
	IsPrivate         bool     // Private codes require assignment to users
	RequiresClaim     bool     // User must claim before using
	AssignedCount     int      // Computed: number of users assigned
	ClaimedCount      int      // Computed: number of users who claimed
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type PromoUsage struct {
	ID              string
	PromoCodeID     string
	UserID          string
	UserEmail       string // Joined from users table
	OrderID         *string
	DiscountApplied float64
	Source          string // direct, claimed, gifted, referral
	UserPromoCodeID *string
	CreatedAt       time.Time
}

type UserPromoCode struct {
	ID            string
	PromoCodeID   string
	UserID        string
	UserEmail     string // Joined from users table
	UserName      *string
	Status        string // assigned, claimed, used, revoked, expired
	AssignedBy    *string
	AssignedAt    time.Time
	ClaimedAt     *time.Time
	UsedAt        *time.Time
	UsedOrderID   *string
	RevokedAt     *time.Time
	RevokedBy     *string
	RevokedReason *string
	ExpiresAt     *time.Time // Per-user expiration
	Notes         *string
	Promo         *PromoCode // Full promo details (optional, loaded separately)
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type PromoStats struct {
	TotalAssignments   int
	ClaimedCount       int
	UsedCount          int
	RevokedCount       int
	ExpiredCount       int
	TotalDiscountGiven float64
	AverageDiscount    float64
	UniqueUsers        int
}

type PromoCodeRepository interface {
	// CRUD
	Create(ctx context.Context, promo *PromoCode) error
	GetByID(ctx context.Context, id string) (*PromoCode, error)
	GetByCode(ctx context.Context, code string) (*PromoCode, error)
	List(ctx context.Context, page, pageSize int, search string, activeOnly bool, typeFilter string) ([]*PromoCode, int, error)
	Update(ctx context.Context, promo *PromoCode) error
	Delete(ctx context.Context, id string) error

	// Restaurant restrictions
	SetRestaurantIDs(ctx context.Context, promoID string, restaurantIDs []string) error
	GetRestaurantIDs(ctx context.Context, promoID string) ([]string, error)

	// Usage tracking
	RecordUsage(ctx context.Context, usage *PromoUsage) error
	GetUsageByPromo(ctx context.Context, promoID string, page, pageSize int) ([]*PromoUsage, int, error)
	CountUsageByUser(ctx context.Context, promoID, userID string) (int, error)
	GetTotalDiscountByPromo(ctx context.Context, promoID string) (float64, error)

	// Counter
	IncrementUses(ctx context.Context, promoID string) error

	// Stats
	GetStats(ctx context.Context, promoID string) (*PromoStats, error)
}

type UserPromoCodeRepository interface {
	// CRUD
	Create(ctx context.Context, upc *UserPromoCode) error
	GetByID(ctx context.Context, id string) (*UserPromoCode, error)
	GetByPromoAndUser(ctx context.Context, promoID, userID string) (*UserPromoCode, error)
	Update(ctx context.Context, upc *UserPromoCode) error
	Delete(ctx context.Context, id string) error

	// Listing
	ListByPromo(ctx context.Context, promoID string, page, pageSize int, statusFilter string) ([]*UserPromoCode, int, error)
	ListByUser(ctx context.Context, userID string, page, pageSize int, statusFilter string) ([]*UserPromoCode, int, error)

	// Status updates
	Claim(ctx context.Context, id string) error
	MarkUsed(ctx context.Context, id, orderID string) error
	Revoke(ctx context.Context, id, revokedBy, reason string) error

	// Checks
	IsAssigned(ctx context.Context, promoID, userID string) (bool, error)
	IsClaimed(ctx context.Context, promoID, userID string) (bool, error)
	CanUse(ctx context.Context, promoID, userID string) (bool, string, error) // returns canUse, reason

	// Counts
	CountByPromoAndStatus(ctx context.Context, promoID, status string) (int, error)
	CountByPromo(ctx context.Context, promoID string) (int, error)

	// Expiration
	ExpireOldAssignments(ctx context.Context) (int, error) // Mark expired assignments
}

// ==================== Driver Tracking ====================

type DriverLocation struct {
	DriverID  string
	Lat       float64
	Lng       float64
	Heading   *float64
	Speed     *float64
	Accuracy  *float64
	UpdatedAt time.Time
}

type DriverStatus struct {
	DriverID       string
	Status         string // offline, available, busy, on_delivery
	CurrentOrderID *string
	Phone          *string
	TelegramChatID *int64 // Telegram chat ID for bot notifications
	LastSeenAt     time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type DeliveryAssignment struct {
	ID          string
	OrderID     string
	DriverID    string
	Status      string // pending, accepted, rejected, expired, completed, cancelled
	AssignedAt  time.Time
	RespondedAt *time.Time
	ExpiresAt   time.Time
	CompletedAt *time.Time
	Notes       *string
}

type DailyWorkEntry struct {
	Date  time.Time
	Hours float64
}

type DailyDeliveryCount struct {
	Date  time.Time
	Count int
}

type DriverStatsBatch struct {
	DeliveriesToday  int
	DeliveriesTotal  int
	HoursWorkedToday float64
}

type DriverRepository interface {
	// Location
	UpdateLocation(ctx context.Context, loc *DriverLocation) error
	GetLocation(ctx context.Context, driverID string) (*DriverLocation, error)
	GetLocationByOrderID(ctx context.Context, orderID string) (*DriverLocation, error)

	// Status
	GetStatus(ctx context.Context, driverID string) (*DriverStatus, error)
	UpsertStatus(ctx context.Context, status *DriverStatus) error
	SetAvailability(ctx context.Context, driverID, status string) error
	ListDriversByStatus(ctx context.Context, status string, page, pageSize int) ([]*DriverStatus, int, error)

	// Telegram linking
	SetTelegramChatID(ctx context.Context, driverID string, chatID int64) error
	GetDriverByTelegramChatID(ctx context.Context, chatID int64) (*DriverStatus, error)
	RemoveTelegramChatID(ctx context.Context, driverID string) error

	// Assignments
	CreateAssignment(ctx context.Context, assignment *DeliveryAssignment) error
	GetAssignment(ctx context.Context, id string) (*DeliveryAssignment, error)
	GetAssignmentByOrderAndDriver(ctx context.Context, orderID, driverID string) (*DeliveryAssignment, error)
	ListAssignmentsByDriver(ctx context.Context, driverID string, status string) ([]*DeliveryAssignment, error)
	ListAssignmentsByOrder(ctx context.Context, orderID string) ([]*DeliveryAssignment, error)
	UpdateAssignmentStatus(ctx context.Context, id, status string, notes *string) error
	CancelOtherPendingAssignments(ctx context.Context, orderID, acceptedAssignmentID string) error
	ResetAssignment(ctx context.Context, id string, expiresAt time.Time) error
	CompleteAssignment(ctx context.Context, id string) error
	ExpireOldAssignments(ctx context.Context) (int, error)

	// Order-Driver linking
	AssignDriverToOrder(ctx context.Context, orderID, driverID string) error
	UnassignDriverFromOrder(ctx context.Context, orderID string) error
	GetOrderDriver(ctx context.Context, orderID string) (*string, error)

	// Admin queries
	ListDriversWithDetails(ctx context.Context, status string, page, pageSize int) ([]*User, []*DriverStatus, []*DriverLocation, int, error)
	ListNearbyDrivers(ctx context.Context, lat, lng, radiusKm float64) ([]*User, []*DriverStatus, []*DriverLocation, error)

	// Stats
	CountDeliveriesToday(ctx context.Context, driverID string) (int, error)
	CountDeliveriesTotal(ctx context.Context, driverID string) (int, error)
	GetBatchDriverStats(ctx context.Context, driverIDs []string) (map[string]DriverStatsBatch, error)

	// Availability logging
	LogAvailabilityChange(ctx context.Context, driverID, newStatus string) error
	GetHoursWorkedToday(ctx context.Context, driverID string) (float64, error)
	GetDailyWorkSummary(ctx context.Context, driverID string, from, to time.Time) ([]DailyWorkEntry, error)
	GetDailyDeliveryCounts(ctx context.Context, driverID string, from, to time.Time) ([]DailyDeliveryCount, error)

	// Telegram linking codes
	CreateTelegramLinkCode(ctx context.Context, code, driverID string, expiresAt time.Time) error
	GetTelegramLinkCode(ctx context.Context, code string) (driverID string, err error)
	MarkTelegramLinkCodeUsed(ctx context.Context, code string) error
	DeleteExpiredTelegramLinkCodes(ctx context.Context) (int, error)
}
