package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/smtp"
)

type EmailService interface {
	SendVerificationCode(ctx context.Context, to, code string) error
	SendPasswordResetCode(ctx context.Context, to, code string) error
}

// ==================== Resend Service (production) ====================

type resendService struct {
	apiKey string
	from   string
}

func NewResendService(apiKey, from string) EmailService {
	log.Printf("[EMAIL] Using Resend provider (from: %s)", from)
	return &resendService{apiKey: apiKey, from: from}
}

func (s *resendService) SendVerificationCode(ctx context.Context, to, code string) error {
	subject := "Vérifiez votre email - Beldys Club"
	html := fmt.Sprintf(verificationTemplate, code)
	return s.send(to, subject, html)
}

func (s *resendService) SendPasswordResetCode(ctx context.Context, to, code string) error {
	subject := "Réinitialisez votre mot de passe - Beldys Club"
	html := fmt.Sprintf(passwordResetTemplate, code)
	return s.send(to, subject, html)
}

func (s *resendService) send(to, subject, html string) error {
	payload := map[string]interface{}{
		"from":    s.from,
		"to":      []string{to},
		"subject": subject,
		"html":    html,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal email payload: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("[EMAIL] Resend request failed for %s: %v", to, err)
		return fmt.Errorf("resend request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("[EMAIL] Resend error %d for %s: %s", resp.StatusCode, to, string(respBody))
		return fmt.Errorf("resend error %d: %s", resp.StatusCode, string(respBody))
	}

	log.Printf("[EMAIL] Sent to %s: %s", to, subject)
	return nil
}

// ==================== SMTP Service (dev / Mailpit) ====================

type smtpService struct {
	host string
	port string
	from string
	name string
}

func NewSMTPService(host, port, from, name string) EmailService {
	log.Printf("[EMAIL] Using SMTP provider: %s:%s", host, port)
	return &smtpService{host: host, port: port, from: from, name: name}
}

func (s *smtpService) SendVerificationCode(ctx context.Context, to, code string) error {
	subject := "Vérifiez votre email - Beldys Club"
	html := fmt.Sprintf(verificationTemplate, code)
	return s.send(to, subject, html)
}

func (s *smtpService) SendPasswordResetCode(ctx context.Context, to, code string) error {
	subject := "Réinitialisez votre mot de passe - Beldys Club"
	html := fmt.Sprintf(passwordResetTemplate, code)
	return s.send(to, subject, html)
}

func (s *smtpService) send(to, subject, html string) error {
	addr := fmt.Sprintf("%s:%s", s.host, s.port)
	msg := fmt.Sprintf("From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
		s.name, s.from, to, subject, html)

	err := smtp.SendMail(addr, nil, s.from, []string{to}, []byte(msg))
	if err != nil {
		log.Printf("[EMAIL] Failed to send to %s: %v", to, err)
		return fmt.Errorf("failed to send email: %w", err)
	}
	log.Printf("[EMAIL] Sent to %s: %s", to, subject)
	return nil
}
