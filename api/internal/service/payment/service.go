package payment

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/klinkragency/e-snack/internal/mollie"
	"github.com/klinkragency/e-snack/internal/repository"
	"github.com/klinkragency/e-snack/internal/repository/postgres"
	"github.com/klinkragency/e-snack/internal/service/auth"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	paymentv1 "github.com/klinkragency/e-snack/gen/payment/v1"
)

type Service struct {
	paymentv1.UnimplementedPaymentServiceServer
	mollieClient *mollie.Client
	orderRepo    repository.OrderRepository
	webhookRepo  repository.PaymentWebhookRepository
	publicURL    string
}

func NewService(mollieClient *mollie.Client, orderRepo repository.OrderRepository, webhookRepo repository.PaymentWebhookRepository, publicURL string) *Service {
	return &Service{
		mollieClient: mollieClient,
		orderRepo:    orderRepo,
		webhookRepo:  webhookRepo,
		publicURL:    publicURL,
	}
}

func (s *Service) CreatePayment(ctx context.Context, req *paymentv1.CreatePaymentRequest) (*paymentv1.PaymentResponse, error) {
	userID, err := s.getUserID(ctx)
	if err != nil {
		return nil, err
	}

	if s.mollieClient == nil {
		return nil, status.Error(codes.Unavailable, "payment service not configured")
	}

	order, err := s.orderRepo.GetByID(ctx, req.OrderId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "order not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get order")
	}

	if order.UserID != userID {
		return nil, status.Error(codes.PermissionDenied, "access denied")
	}

	if order.Status != "pending" {
		return nil, status.Error(codes.FailedPrecondition, "order is not in pending status")
	}

	// Idempotence : si un paiement Mollie existe déjà, le retourner directement
	if order.PaymentIntentID != nil && *order.PaymentIntentID != "" {
		existing, err := s.mollieClient.GetPayment(*order.PaymentIntentID)
		if err == nil && existing.CheckoutURL != "" {
			return &paymentv1.PaymentResponse{
				Id:          existing.ID,
				CheckoutUrl: existing.CheckoutURL,
				Amount:      int64(order.Total * 100),
				Currency:    "EUR",
				Status:      existing.Status,
			}, nil
		}
	}

	amountStr := fmt.Sprintf("%.2f", order.Total)

	redirectURL := req.RedirectUrl
	if redirectURL == "" {
		// Default: web page that tries to deep-link back into the app
		// Works for both Expo Go (dev) and production builds
		redirectURL = fmt.Sprintf("%s/payment-return?orderId=%s", s.publicURL, order.ID)
	}

	payment, err := s.mollieClient.CreatePayment(&mollie.CreatePaymentParams{
		Amount:      amountStr,
		Currency:    "EUR",
		Description: fmt.Sprintf("Beldys Commande #%s", order.ID[:8]),
		OrderID:     order.ID,
		RedirectURL: redirectURL,
		WebhookURL:  fmt.Sprintf("%s/api/v1/webhook/mollie", s.publicURL),
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create payment: %v", err)
	}

	// Stocker le payment_intent_id. En cas de violation UNIQUE (race condition),
	// on relit l'ordre pour renvoyer le paiement existant.
	if err := s.orderRepo.UpdatePaymentStatus(ctx, order.ID, "pending", &payment.ID); err != nil {
		if isUniqueViolation(err) {
			refreshed, rerr := s.orderRepo.GetByID(ctx, order.ID)
			if rerr == nil && refreshed.PaymentIntentID != nil {
				existing, merr := s.mollieClient.GetPayment(*refreshed.PaymentIntentID)
				if merr == nil {
					return &paymentv1.PaymentResponse{
						Id:          existing.ID,
						CheckoutUrl: existing.CheckoutURL,
						Amount:      int64(order.Total * 100),
						Currency:    "EUR",
						Status:      existing.Status,
					}, nil
				}
			}
		}
		log.Printf("[Payment] Warning: failed to store payment intent for order %s: %v", order.ID, err)
	}

	// Audit : enregistrer l'événement de création
	if s.webhookRepo != nil {
		_ = s.webhookRepo.InsertPaymentEvent(ctx, &repository.PaymentEvent{
			OrderID:   order.ID,
			MollieID:  &payment.ID,
			EventType: "created",
			Amount:    &order.Total,
		})
	}

	return &paymentv1.PaymentResponse{
		Id:          payment.ID,
		CheckoutUrl: payment.CheckoutURL,
		Amount:      int64(order.Total * 100),
		Currency:    "EUR",
		Status:      payment.Status,
	}, nil
}

func (s *Service) RefundPayment(ctx context.Context, req *paymentv1.RefundPaymentRequest) (*paymentv1.RefundResult, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if s.mollieClient == nil {
		return nil, status.Error(codes.Unavailable, "payment service not configured")
	}

	order, err := s.orderRepo.GetByID(ctx, req.OrderId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "order not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get order")
	}

	if order.PaymentIntentID == nil || *order.PaymentIntentID == "" {
		return nil, status.Error(codes.FailedPrecondition, "order has no payment")
	}

	if order.PaymentStatus != "paid" {
		return nil, status.Error(codes.FailedPrecondition, "order payment is not completed")
	}

	var amountStr string
	if req.Amount > 0 {
		amountStr = fmt.Sprintf("%.2f", float64(req.Amount)/100)
	} else {
		amountStr = fmt.Sprintf("%.2f", order.Total)
	}

	description := "Remboursement Beldys"
	if req.Reason != "" {
		description = req.Reason
	}

	refund, err := s.mollieClient.CreateRefund(*order.PaymentIntentID, amountStr, description)
	if err != nil {
		return &paymentv1.RefundResult{
			Status:       "failed",
			ErrorMessage: err.Error(),
		}, nil
	}

	adminID, _ := s.getUserID(ctx)
	notes := "Remboursé via admin"
	if req.Reason != "" {
		notes = fmt.Sprintf("Remboursé: %s", req.Reason)
	}

	_ = s.orderRepo.UpdatePaymentStatus(ctx, order.ID, "refunded", order.PaymentIntentID)
	_ = s.orderRepo.UpdateStatus(ctx, order.ID, "refunded", &adminID, &notes)

	// Audit
	if s.webhookRepo != nil {
		refundAmount := float64(req.Amount) / 100
		if req.Amount == 0 {
			refundAmount = order.Total
		}
		_ = s.webhookRepo.InsertPaymentEvent(ctx, &repository.PaymentEvent{
			OrderID:   order.ID,
			MollieID:  order.PaymentIntentID,
			EventType: "refunded",
			Amount:    &refundAmount,
		})
	}

	var refundCents int64
	var v float64
	if _, err := fmt.Sscanf(refund.Amount.Value, "%f", &v); err == nil {
		refundCents = int64(v * 100)
	}

	return &paymentv1.RefundResult{
		RefundId: refund.ID,
		Status:   refund.Status,
		Amount:   refundCents,
	}, nil
}

func (s *Service) GetPaymentStatus(ctx context.Context, req *paymentv1.GetPaymentStatusRequest) (*paymentv1.PaymentStatus, error) {
	userID, err := s.getUserID(ctx)
	if err != nil {
		return nil, err
	}

	order, err := s.orderRepo.GetByID(ctx, req.OrderId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "order not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get order")
	}

	if order.UserID != userID && !s.isAdmin(ctx) {
		return nil, status.Error(codes.PermissionDenied, "access denied")
	}

	result := &paymentv1.PaymentStatus{
		OrderId:  order.ID,
		Status:   order.PaymentStatus,
		Amount:   int64(order.Total * 100),
		Currency: "EUR",
	}

	if order.PaymentIntentID != nil {
		result.PaymentId = *order.PaymentIntentID
	}

	return result, nil
}

// HandleWebhook traite les webhooks Mollie via le pattern outbox :
// 1. Persiste immédiatement l'événement en base
// 2. Retourne 200 OK à Mollie sans attendre le traitement
// 3. Le worker traite l'événement de façon asynchrone avec retries
func (s *Service) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	paymentID := r.FormValue("id")
	if paymentID == "" {
		http.Error(w, "missing payment id", http.StatusBadRequest)
		return
	}

	// Sauvegarder l'événement immédiatement — si la DB est down, on retourne 500
	// pour que Mollie retente (comportement souhaité dans ce cas précis)
	if s.webhookRepo != nil {
		if err := s.webhookRepo.Upsert(r.Context(), paymentID); err != nil {
			log.Printf("[Webhook] Failed to persist event for payment %s: %v", paymentID, err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
	}

	// Retourner 200 immédiatement — le worker traite de façon asynchrone
	w.WriteHeader(http.StatusOK)
}

// StartWorker démarre le worker de traitement des webhooks en arrière-plan.
// Il doit être lancé dans une goroutine et s'arrête quand ctx est annulé.
func (s *Service) StartWorker(ctx context.Context) {
	if s.webhookRepo == nil || s.mollieClient == nil {
		log.Println("[PaymentWorker] Mollie ou webhookRepo non configuré, worker désactivé")
		return
	}

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	log.Println("[PaymentWorker] Démarré (intervalle: 10s)")

	for {
		select {
		case <-ctx.Done():
			log.Println("[PaymentWorker] Arrêté")
			return
		case <-ticker.C:
			s.processWebhookBatch(ctx)
		}
	}
}

// processWebhookBatch traite un lot d'événements webhook en attente.
func (s *Service) processWebhookBatch(ctx context.Context) {
	events, err := s.webhookRepo.ListPending(ctx, 20)
	if err != nil {
		log.Printf("[PaymentWorker] Erreur lecture events: %v", err)
		return
	}

	for _, event := range events {
		if err := s.processWebhookEvent(ctx, event); err != nil {
			log.Printf("[PaymentWorker] Erreur traitement event %s (mollie: %s, tentative %d): %v",
				event.ID, event.MollieID, event.Attempts+1, err)

			if event.Attempts+1 >= 5 {
				_ = s.webhookRepo.MarkFailed(ctx, event.ID, err.Error())
				log.Printf("[PaymentWorker] Event %s marqué FAILED après 5 tentatives", event.ID)
			} else {
				_ = s.webhookRepo.IncrementAttempts(ctx, event.ID, err.Error())
			}
		}
	}
}

// processWebhookEvent traite un événement webhook unique de façon atomique.
func (s *Service) processWebhookEvent(ctx context.Context, event *repository.PaymentWebhookEvent) error {
	// Vérifier le statut réel auprès de Mollie (ne jamais faire confiance au seul ID)
	payment, err := s.mollieClient.GetPayment(event.MollieID)
	if err != nil {
		return fmt.Errorf("mollie GetPayment: %w", err)
	}

	order, err := s.orderRepo.GetByPaymentIntentID(ctx, event.MollieID)
	if errors.Is(err, postgres.ErrNotFound) || order == nil {
		// Pas de commande associée — marquer comme traité pour ne pas retraiter
		log.Printf("[PaymentWorker] Aucune commande pour le paiement %s, ignoré", event.MollieID)
		return s.webhookRepo.MarkProcessed(ctx, event.ID)
	}
	if err != nil {
		return fmt.Errorf("getByPaymentIntentID: %w", err)
	}

	switch payment.Status {
	case "paid":
		if order.PaymentStatus == "paid" {
			// Déjà traité (idempotence)
			return s.webhookRepo.MarkProcessed(ctx, event.ID)
		}
		var amount float64
		fmt.Sscanf(payment.Amount.Value, "%f", &amount)
		if err := s.orderRepo.ConfirmPaymentTx(ctx, order.ID, event.MollieID, amount); err != nil {
			return fmt.Errorf("confirmPaymentTx: %w", err)
		}
		log.Printf("[PaymentWorker] Commande %s confirmée (paiement %s)", order.ID, event.MollieID)

	case "failed", "expired", "canceled":
		if order.PaymentStatus == "failed" {
			return s.webhookRepo.MarkProcessed(ctx, event.ID)
		}
		if err := s.orderRepo.FailPaymentTx(ctx, order.ID, event.MollieID, payment.Status); err != nil {
			return fmt.Errorf("failPaymentTx: %w", err)
		}
		log.Printf("[PaymentWorker] Paiement %s pour commande %s: %s", event.MollieID, order.ID, payment.Status)

	default:
		// Statut intermédiaire (open, pending...) — pas d'action, on retraitera
		log.Printf("[PaymentWorker] Paiement %s statut intermédiaire: %s (pas d'action)", event.MollieID, payment.Status)
	}

	return s.webhookRepo.MarkProcessed(ctx, event.ID)
}

func (s *Service) getUserID(ctx context.Context) (string, error) {
	userID, ok := ctx.Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		return "", status.Error(codes.Unauthenticated, "authentication required")
	}
	return userID, nil
}

func (s *Service) isAdmin(ctx context.Context) bool {
	role, ok := ctx.Value(auth.UserRoleKey).(string)
	return ok && role == "admin"
}

func (s *Service) requireAdmin(ctx context.Context) error {
	if !s.isAdmin(ctx) {
		return status.Error(codes.PermissionDenied, "admin access required")
	}
	return nil
}

// isUniqueViolation détecte une violation de contrainte UNIQUE PostgreSQL (code 23505).
func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "23505")
}
