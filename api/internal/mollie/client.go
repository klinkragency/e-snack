package mollie

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

const baseURL = "https://api.mollie.com/v2"

type Client struct {
	apiKey     string
	httpClient *http.Client
}

func NewClient(apiKey string) *Client {
	return &Client{
		apiKey:     apiKey,
		httpClient: &http.Client{},
	}
}

// Payment represents a Mollie payment response.
type Payment struct {
	ID          string `json:"id"`
	Status      string `json:"status"`
	CheckoutURL string // extracted from _links.checkout.href
	Amount      Amount `json:"amount"`
	PaidAt      string `json:"paidAt,omitempty"`
}

type Amount struct {
	Currency string `json:"currency"`
	Value    string `json:"value"` // e.g. "15.00"
}

type Refund struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	Amount Amount `json:"amount"`
}

// CreatePaymentParams contains the parameters for creating a payment.
type CreatePaymentParams struct {
	Amount      string // e.g. "15.00"
	Currency    string // e.g. "EUR"
	Description string
	OrderID     string
	RedirectURL string
	WebhookURL  string
}

type createPaymentBody struct {
	Amount      Amount            `json:"amount"`
	Description string            `json:"description"`
	RedirectURL string            `json:"redirectUrl"`
	WebhookURL  string            `json:"webhookUrl,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

type linksResponse struct {
	Checkout *struct {
		Href string `json:"href"`
	} `json:"checkout,omitempty"`
}

type paymentResponse struct {
	ID     string        `json:"id"`
	Status string        `json:"status"`
	Amount Amount        `json:"amount"`
	PaidAt string        `json:"paidAt,omitempty"`
	Links  linksResponse `json:"_links"`
}

func (c *Client) CreatePayment(params *CreatePaymentParams) (*Payment, error) {
	currency := params.Currency
	if currency == "" {
		currency = "EUR"
	}

	body := createPaymentBody{
		Amount:      Amount{Currency: currency, Value: params.Amount},
		Description: params.Description,
		RedirectURL: params.RedirectURL,
		WebhookURL:  params.WebhookURL,
		Metadata:    map[string]string{"order_id": params.OrderID},
	}

	data, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payment request: %w", err)
	}

	resp, err := c.do("POST", "/payments", bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to create payment: %w", err)
	}

	var pr paymentResponse
	if err := json.Unmarshal(resp, &pr); err != nil {
		return nil, fmt.Errorf("failed to parse payment response: %w", err)
	}

	payment := &Payment{
		ID:     pr.ID,
		Status: pr.Status,
		Amount: pr.Amount,
	}
	if pr.Links.Checkout != nil {
		payment.CheckoutURL = pr.Links.Checkout.Href
	}

	return payment, nil
}

func (c *Client) GetPayment(paymentID string) (*Payment, error) {
	resp, err := c.do("GET", "/payments/"+paymentID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get payment: %w", err)
	}

	var pr paymentResponse
	if err := json.Unmarshal(resp, &pr); err != nil {
		return nil, fmt.Errorf("failed to parse payment response: %w", err)
	}

	return &Payment{
		ID:     pr.ID,
		Status: pr.Status,
		Amount: pr.Amount,
		PaidAt: pr.PaidAt,
	}, nil
}

type createRefundBody struct {
	Amount      Amount `json:"amount"`
	Description string `json:"description,omitempty"`
}

func (c *Client) CreateRefund(paymentID, amount, description string) (*Refund, error) {
	body := createRefundBody{
		Amount:      Amount{Currency: "EUR", Value: amount},
		Description: description,
	}

	data, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal refund request: %w", err)
	}

	resp, err := c.do("POST", "/payments/"+paymentID+"/refunds", bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to create refund: %w", err)
	}

	var r Refund
	if err := json.Unmarshal(resp, &r); err != nil {
		return nil, fmt.Errorf("failed to parse refund response: %w", err)
	}

	return &r, nil
}

// do performs an authenticated HTTP request to the Mollie API.
func (c *Client) do(method, path string, body io.Reader) ([]byte, error) {
	req, err := http.NewRequest(method, baseURL+path, body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("mollie API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}
