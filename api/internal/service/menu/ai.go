package menu

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	menuv1 "github.com/beldys/api/gen/menu/v1"
)

// ─── OpenAI types ───

type openaiRequest struct {
	Model    string           `json:"model"`
	Messages []openaiMessage  `json:"messages"`
}

type openaiMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openaiResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// ─── AI response types ───

type aiMenuResponse struct {
	Categories []aiCategory `json:"categories"`
}

type aiCategory struct {
	Name     string      `json:"name"`
	Products []aiProduct `json:"products"`
}

type aiProduct struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Price       float64    `json:"price"`
	Allergens   []string   `json:"allergens"`
	Options     []aiOption `json:"options"`
}

type aiOption struct {
	Name       string     `json:"name"`
	Type       string     `json:"type"`
	IsRequired bool       `json:"isRequired"`
	Choices    []aiChoice `json:"choices"`
}

type aiChoice struct {
	Name          string  `json:"name"`
	PriceModifier float64 `json:"priceModifier"`
}

type aiSuggestResponse struct {
	Description      string     `json:"description"`
	SuggestedPrice   float64    `json:"suggestedPrice"`
	Allergens        []string   `json:"allergens"`
	SuggestedOptions []aiOption `json:"suggestedOptions"`
}

// ─── RPC implementations ───

func (s *Service) GenerateMenuAI(ctx context.Context, req *menuv1.GenerateMenuAIRequest) (*menuv1.GenerateMenuAIResponse, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}
	if req.CuisineType == "" {
		return nil, status.Error(codes.InvalidArgument, "cuisine_type is required")
	}

	lang := req.Language
	if lang == "" {
		lang = "fr"
	}

	prompt := fmt.Sprintf(`Génère un menu complet pour un restaurant de type "%s".
Langue: %s

Retourne un JSON valide avec cette structure exacte:
{
  "categories": [
    {
      "name": "Nom de la catégorie",
      "products": [
        {
          "name": "Nom du produit",
          "description": "Description courte et appétissante",
          "price": 12.90,
          "allergens": ["Gluten", "Lait"],
          "options": [
            {
              "name": "Sauce",
              "type": "single",
              "isRequired": false,
              "choices": [
                {"name": "Ketchup", "priceModifier": 0},
                {"name": "Mayo", "priceModifier": 0.50}
              ]
            }
          ]
        }
      ]
    }
  ]
}

Génère 3-5 catégories avec 3-5 produits chacune. Les prix doivent être réalistes en euros. Inclus des options/suppléments pertinents. Retourne UNIQUEMENT le JSON, sans texte avant ou après.`, req.CuisineType, lang)

	result, err := s.callOpenAI(ctx, "Tu es un expert en restauration. Tu génères des menus et suggestions de produits au format JSON. Retourne uniquement du JSON valide.", prompt)
	if err != nil {
		return nil, status.Error(codes.Internal, "AI generation failed: "+err.Error())
	}

	var aiResp aiMenuResponse
	if err := json.Unmarshal([]byte(result), &aiResp); err != nil {
		return nil, status.Error(codes.Internal, "failed to parse AI response")
	}

	resp := &menuv1.GenerateMenuAIResponse{}
	for _, cat := range aiResp.Categories {
		protoCat := &menuv1.SuggestedCategory{Name: cat.Name}
		for _, p := range cat.Products {
			protoProd := &menuv1.SuggestedProduct{
				Name:        p.Name,
				Description: p.Description,
				Price:       p.Price,
				Allergens:   p.Allergens,
			}
			for _, o := range p.Options {
				protoOpt := &menuv1.SuggestedOption{
					Name:       o.Name,
					Type:       o.Type,
					IsRequired: o.IsRequired,
				}
				for _, c := range o.Choices {
					protoOpt.Choices = append(protoOpt.Choices, &menuv1.OptionChoiceInput{
						Name:          c.Name,
						PriceModifier: c.PriceModifier,
					})
				}
				protoProd.Options = append(protoProd.Options, protoOpt)
			}
			protoCat.Products = append(protoCat.Products, protoProd)
		}
		resp.Categories = append(resp.Categories, protoCat)
	}

	return resp, nil
}

func (s *Service) SuggestProductDetails(ctx context.Context, req *menuv1.SuggestProductRequest) (*menuv1.SuggestProductResponse, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}
	if req.ProductName == "" {
		return nil, status.Error(codes.InvalidArgument, "product_name is required")
	}

	lang := req.Language
	if lang == "" {
		lang = "fr"
	}

	contextStr := ""
	if req.CuisineContext != "" {
		contextStr = fmt.Sprintf(" dans un restaurant de type %s", req.CuisineContext)
	}

	prompt := fmt.Sprintf(`Pour le produit "%s"%s, suggère des détails.
Langue: %s

Retourne un JSON valide avec cette structure exacte:
{
  "description": "Description courte et appétissante",
  "suggestedPrice": 12.90,
  "allergens": ["Gluten", "Lait"],
  "suggestedOptions": [
    {
      "name": "Sauce",
      "type": "single",
      "isRequired": false,
      "choices": [
        {"name": "Ketchup", "priceModifier": 0},
        {"name": "Mayo", "priceModifier": 0.50}
      ]
    }
  ]
}

Retourne UNIQUEMENT le JSON, sans texte avant ou après.`, req.ProductName, contextStr, lang)

	result, err := s.callOpenAI(ctx, "Tu es un expert en restauration. Tu génères des suggestions de produits au format JSON. Retourne uniquement du JSON valide.", prompt)
	if err != nil {
		return nil, status.Error(codes.Internal, "AI suggestion failed: "+err.Error())
	}

	var aiResp aiSuggestResponse
	if err := json.Unmarshal([]byte(result), &aiResp); err != nil {
		return nil, status.Error(codes.Internal, "failed to parse AI response")
	}

	resp := &menuv1.SuggestProductResponse{
		Description:    aiResp.Description,
		SuggestedPrice: aiResp.SuggestedPrice,
		Allergens:      aiResp.Allergens,
	}

	for _, o := range aiResp.SuggestedOptions {
		protoOpt := &menuv1.SuggestedOption{
			Name:       o.Name,
			Type:       o.Type,
			IsRequired: o.IsRequired,
		}
		for _, c := range o.Choices {
			protoOpt.Choices = append(protoOpt.Choices, &menuv1.OptionChoiceInput{
				Name:          c.Name,
				PriceModifier: c.PriceModifier,
			})
		}
		resp.SuggestedOptions = append(resp.SuggestedOptions, protoOpt)
	}

	return resp, nil
}

// ─── OpenAI API call ───

func (s *Service) callOpenAI(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	key := s.GetOpenAIKey()
	if key == "" {
		return "", fmt.Errorf("clé API OpenAI non configurée. Ajoutez-la dans les paramètres admin.")
	}

	reqBody := openaiRequest{
		Model: "gpt-4o-mini",
		Messages: []openaiMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+key)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("OpenAI API error (%d): %s", resp.StatusCode, string(respBody))
	}

	var apiResp openaiResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return "", err
	}

	if len(apiResp.Choices) == 0 {
		return "", fmt.Errorf("empty response from AI")
	}

	text := apiResp.Choices[0].Message.Content

	// Extract JSON from response (handle markdown code blocks)
	if idx := findJSONStart(text); idx >= 0 {
		text = text[idx:]
		if end := findJSONEnd(text); end > 0 {
			text = text[:end+1]
		}
	}

	return text, nil
}

func findJSONStart(s string) int {
	for i, c := range s {
		if c == '{' {
			return i
		}
	}
	return -1
}

func findJSONEnd(s string) int {
	depth := 0
	for i, c := range s {
		if c == '{' {
			depth++
		} else if c == '}' {
			depth--
			if depth == 0 {
				return i
			}
		}
	}
	return -1
}
