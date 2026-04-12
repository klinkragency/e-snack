package menu

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"

	"github.com/beldys/api/internal/repository"
	"github.com/beldys/api/internal/repository/postgres"
	"github.com/beldys/api/internal/service/auth"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	menuv1 "github.com/beldys/api/gen/menu/v1"
)

type Service struct {
	menuv1.UnimplementedMenuServiceServer
	restaurantRepo repository.RestaurantRepository
	categoryRepo   repository.CategoryRepository
	productRepo    repository.ProductRepository
	optionRepo     repository.ProductOptionRepository
	formulaRepo    repository.FormulaRepository
	openaiKey   string
	mu          sync.RWMutex
}

func NewService(
	restaurantRepo repository.RestaurantRepository,
	categoryRepo repository.CategoryRepository,
	productRepo repository.ProductRepository,
	optionRepo repository.ProductOptionRepository,
	formulaRepo repository.FormulaRepository,
	openaiKey string,
) *Service {
	return &Service{
		restaurantRepo: restaurantRepo,
		categoryRepo:   categoryRepo,
		productRepo:    productRepo,
		optionRepo:     optionRepo,
		formulaRepo:    formulaRepo,
		openaiKey:   openaiKey,
	}
}

func (s *Service) GetMenu(ctx context.Context, req *menuv1.GetMenuRequest) (*menuv1.Menu, error) {
	if req.RestaurantSlug == "" {
		return nil, status.Error(codes.InvalidArgument, "restaurant_slug is required")
	}

	restaurant, err := s.restaurantRepo.GetBySlug(ctx, req.RestaurantSlug)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "restaurant not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get restaurant")
	}

	categories, err := s.categoryRepo.ListByRestaurant(ctx, restaurant.ID)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get categories")
	}

	protoCategories := make([]*menuv1.Category, 0, len(categories))
	for _, cat := range categories {
		if !cat.IsActive {
			continue
		}

		products, err := s.productRepo.ListByCategory(ctx, cat.ID)
		if err != nil {
			continue
		}

		protoProducts := make([]*menuv1.Product, 0, len(products))
		for _, p := range products {
			options, _ := s.optionRepo.ListByProduct(ctx, p.ID)
			protoProducts = append(protoProducts, s.productToProto(p, options))
		}

		// Load formulas for this category
		formulas, _ := s.formulaRepo.ListByCategory(ctx, cat.ID)
		protoFormulas := make([]*menuv1.Formula, 0, len(formulas))
		for _, f := range formulas {
			protoFormulas = append(protoFormulas, s.formulaToProto(f))
		}

		protoCategories = append(protoCategories, &menuv1.Category{
			Id:           cat.ID,
			RestaurantId: cat.RestaurantID,
			Name:         cat.Name,
			Position:     int32(cat.Position),
			IsActive:     cat.IsActive,
			Products:     protoProducts,
			CreatedAt:    timestamppb.New(cat.CreatedAt),
			Formulas:     protoFormulas,
		})
	}

	return &menuv1.Menu{
		RestaurantId:   restaurant.ID,
		RestaurantName: restaurant.Name,
		Categories:     protoCategories,
	}, nil
}

func (s *Service) CreateCategory(ctx context.Context, req *menuv1.CreateCategoryRequest) (*menuv1.Category, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.RestaurantId == "" || req.Name == "" {
		return nil, status.Error(codes.InvalidArgument, "restaurant_id and name are required")
	}

	_, err := s.restaurantRepo.GetByID(ctx, req.RestaurantId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "restaurant not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get restaurant")
	}

	category := &repository.Category{
		RestaurantID: req.RestaurantId,
		Name:         req.Name,
		Position:     int(req.Position),
	}

	if err := s.categoryRepo.Create(ctx, category); err != nil {
		return nil, status.Error(codes.Internal, "failed to create category")
	}

	return &menuv1.Category{
		Id:           category.ID,
		RestaurantId: category.RestaurantID,
		Name:         category.Name,
		Position:     int32(category.Position),
		IsActive:     category.IsActive,
		CreatedAt:    timestamppb.New(category.CreatedAt),
	}, nil
}

func (s *Service) UpdateCategory(ctx context.Context, req *menuv1.UpdateCategoryRequest) (*menuv1.Category, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	category, err := s.categoryRepo.GetByID(ctx, req.Id)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "category not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get category")
	}

	if req.Name != "" {
		category.Name = req.Name
	}
	category.Position = int(req.Position)
	category.IsActive = req.IsActive

	if err := s.categoryRepo.Update(ctx, category); err != nil {
		return nil, status.Error(codes.Internal, "failed to update category")
	}

	return &menuv1.Category{
		Id:           category.ID,
		RestaurantId: category.RestaurantID,
		Name:         category.Name,
		Position:     int32(category.Position),
		IsActive:     category.IsActive,
		CreatedAt:    timestamppb.New(category.CreatedAt),
	}, nil
}

func (s *Service) DeleteCategory(ctx context.Context, req *menuv1.DeleteCategoryRequest) (*emptypb.Empty, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	if err := s.categoryRepo.Delete(ctx, req.Id); err != nil {
		if errors.Is(err, postgres.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "category not found")
		}
		if isFKViolation(err) {
			return nil, status.Error(codes.FailedPrecondition, "Impossible de supprimer : cette catégorie contient des produits liés à des commandes. Rendez-la inactive à la place.")
		}
		return nil, status.Error(codes.Internal, "failed to delete category")
	}

	return &emptypb.Empty{}, nil
}

func (s *Service) CreateProduct(ctx context.Context, req *menuv1.CreateProductRequest) (*menuv1.Product, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.CategoryId == "" || req.Name == "" || req.Price <= 0 {
		return nil, status.Error(codes.InvalidArgument, "category_id, name and positive price are required")
	}

	_, err := s.categoryRepo.GetByID(ctx, req.CategoryId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "category not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get category")
	}

	var description, imageURL *string
	if req.Description != "" {
		description = &req.Description
	}
	if req.ImageUrl != "" {
		imageURL = &req.ImageUrl
	}

	var allergens json.RawMessage
	if len(req.Allergens) > 0 {
		allergens, _ = json.Marshal(req.Allergens)
	}

	var nutritionalInfo json.RawMessage
	if req.NutritionalInfo != "" {
		nutritionalInfo = json.RawMessage(req.NutritionalInfo)
	}

	product := &repository.Product{
		CategoryID:      req.CategoryId,
		Name:            req.Name,
		Description:     description,
		Price:           req.Price,
		ImageURL:        imageURL,
		Allergens:       allergens,
		NutritionalInfo: nutritionalInfo,
	}

	if err := s.productRepo.Create(ctx, product); err != nil {
		return nil, status.Error(codes.Internal, "failed to create product")
	}

	return s.productToProto(product, nil), nil
}

func (s *Service) UpdateProduct(ctx context.Context, req *menuv1.UpdateProductRequest) (*menuv1.Product, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	product, err := s.productRepo.GetByID(ctx, req.Id)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "product not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get product")
	}

	if req.Name != "" {
		product.Name = req.Name
	}
	if req.Description != "" {
		product.Description = &req.Description
	}
	if req.Price > 0 {
		product.Price = req.Price
	}
	if req.ImageUrl != "" {
		product.ImageURL = &req.ImageUrl
	}
	product.IsAvailable = req.IsAvailable

	if len(req.Allergens) > 0 {
		product.Allergens, _ = json.Marshal(req.Allergens)
	}
	if req.NutritionalInfo != "" {
		product.NutritionalInfo = json.RawMessage(req.NutritionalInfo)
	}

	if req.CategoryId != "" && req.CategoryId != product.CategoryID {
		if _, err := s.categoryRepo.GetByID(ctx, req.CategoryId); err != nil {
			if errors.Is(err, postgres.ErrNotFound) {
				return nil, status.Error(codes.NotFound, "target category not found")
			}
			return nil, status.Error(codes.Internal, "failed to validate category")
		}
		product.CategoryID = req.CategoryId
	}
	product.Position = int(req.Position)

	if err := s.productRepo.Update(ctx, product); err != nil {
		return nil, status.Error(codes.Internal, "failed to update product")
	}

	options, _ := s.optionRepo.ListByProduct(ctx, product.ID)
	return s.productToProto(product, options), nil
}

func (s *Service) DeleteProduct(ctx context.Context, req *menuv1.DeleteProductRequest) (*emptypb.Empty, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	if err := s.productRepo.Delete(ctx, req.Id); err != nil {
		if errors.Is(err, postgres.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "product not found")
		}
		if isFKViolation(err) {
			return nil, status.Error(codes.FailedPrecondition, "Impossible de supprimer : ce produit est lié à des commandes existantes. Rendez-le indisponible à la place.")
		}
		return nil, status.Error(codes.Internal, "failed to delete product")
	}

	return &emptypb.Empty{}, nil
}

func (s *Service) SetProductAvailability(ctx context.Context, req *menuv1.SetAvailabilityRequest) (*menuv1.Product, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	if err := s.productRepo.SetAvailability(ctx, req.Id, req.IsAvailable); err != nil {
		if errors.Is(err, postgres.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "product not found")
		}
		return nil, status.Error(codes.Internal, "failed to update availability")
	}

	product, _ := s.productRepo.GetByID(ctx, req.Id)
	options, _ := s.optionRepo.ListByProduct(ctx, req.Id)
	return s.productToProto(product, options), nil
}

func (s *Service) CreateProductOption(ctx context.Context, req *menuv1.CreateOptionRequest) (*menuv1.ProductOption, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.ProductId == "" || req.Name == "" {
		return nil, status.Error(codes.InvalidArgument, "product_id and name are required")
	}

	_, err := s.productRepo.GetByID(ctx, req.ProductId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "product not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get product")
	}

	optType := req.Type
	if optType != "single" && optType != "multiple" {
		optType = "single"
	}

	choices := make([]*repository.OptionChoice, len(req.Choices))
	for i, c := range req.Choices {
		choices[i] = &repository.OptionChoice{
			Name:          c.Name,
			PriceModifier: c.PriceModifier,
		}
	}

	option := &repository.ProductOption{
		ProductID:     req.ProductId,
		Name:          req.Name,
		Type:          optType,
		IsRequired:    req.IsRequired,
		MaxSelections: int(req.MaxSelections),
		Choices:       choices,
	}

	if err := s.optionRepo.Create(ctx, option); err != nil {
		return nil, status.Error(codes.Internal, "failed to create option")
	}

	return s.optionToProto(option), nil
}

func (s *Service) AddOptionChoice(ctx context.Context, req *menuv1.AddChoiceRequest) (*menuv1.OptionChoice, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.OptionId == "" || req.Name == "" {
		return nil, status.Error(codes.InvalidArgument, "option_id and name are required")
	}

	choice := &repository.OptionChoice{
		OptionID:      req.OptionId,
		Name:          req.Name,
		PriceModifier: req.PriceModifier,
	}

	if err := s.optionRepo.AddChoice(ctx, choice); err != nil {
		return nil, status.Error(codes.Internal, "failed to add choice")
	}

	return &menuv1.OptionChoice{
		Id:            choice.ID,
		OptionId:      choice.OptionID,
		Name:          choice.Name,
		PriceModifier: choice.PriceModifier,
	}, nil
}

func (s *Service) DeleteProductOption(ctx context.Context, req *menuv1.DeleteOptionRequest) (*emptypb.Empty, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	if err := s.optionRepo.Delete(ctx, req.Id); err != nil {
		if errors.Is(err, postgres.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "option not found")
		}
		return nil, status.Error(codes.Internal, "failed to delete option")
	}

	return &emptypb.Empty{}, nil
}

func (s *Service) UpdateProductOption(ctx context.Context, req *menuv1.UpdateOptionRequest) (*menuv1.ProductOption, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" || req.Name == "" {
		return nil, status.Error(codes.InvalidArgument, "id and name are required")
	}

	option, err := s.optionRepo.GetByID(ctx, req.Id)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "option not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get option")
	}

	optType := req.Type
	if optType != "single" && optType != "multiple" {
		optType = "single"
	}

	option.Name = req.Name
	option.Type = optType
	option.IsRequired = req.IsRequired
	option.MaxSelections = int(req.MaxSelections)

	if err := s.optionRepo.Update(ctx, option); err != nil {
		return nil, status.Error(codes.Internal, "failed to update option")
	}

	// Reload to get choices
	option, _ = s.optionRepo.GetByID(ctx, req.Id)
	return s.optionToProto(option), nil
}

func (s *Service) UpdateOptionChoice(ctx context.Context, req *menuv1.UpdateChoiceRequest) (*menuv1.OptionChoice, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" || req.Name == "" {
		return nil, status.Error(codes.InvalidArgument, "id and name are required")
	}

	choice := &repository.OptionChoice{
		ID:            req.Id,
		Name:          req.Name,
		PriceModifier: req.PriceModifier,
	}

	if err := s.optionRepo.UpdateChoice(ctx, choice); err != nil {
		if errors.Is(err, postgres.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "choice not found")
		}
		return nil, status.Error(codes.Internal, "failed to update choice")
	}

	return &menuv1.OptionChoice{
		Id:            choice.ID,
		Name:          choice.Name,
		PriceModifier: choice.PriceModifier,
	}, nil
}

func (s *Service) DeleteOptionChoice(ctx context.Context, req *menuv1.DeleteChoiceRequest) (*emptypb.Empty, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	if err := s.optionRepo.DeleteChoice(ctx, req.Id); err != nil {
		if errors.Is(err, postgres.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "choice not found")
		}
		return nil, status.Error(codes.Internal, "failed to delete choice")
	}

	return &emptypb.Empty{}, nil
}

// ─── Formula CRUD ───

func (s *Service) CreateFormula(ctx context.Context, req *menuv1.CreateFormulaRequest) (*menuv1.Formula, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.CategoryId == "" || req.Name == "" || req.BasePrice <= 0 {
		return nil, status.Error(codes.InvalidArgument, "category_id, name and positive base_price are required")
	}
	if len(req.Products) == 0 {
		return nil, status.Error(codes.InvalidArgument, "at least one product is required")
	}

	// Validate category exists
	_, err := s.categoryRepo.GetByID(ctx, req.CategoryId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "category not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get category")
	}

	// Validate all products exist and build input list
	productInputs := make([]repository.FormulaProductInput, len(req.Products))
	for i, p := range req.Products {
		if _, err := s.productRepo.GetByID(ctx, p.ProductId); err != nil {
			if errors.Is(err, postgres.ErrNotFound) {
				return nil, status.Errorf(codes.NotFound, "product not found: %s", p.ProductId)
			}
			return nil, status.Error(codes.Internal, "failed to validate product")
		}
		productInputs[i] = repository.FormulaProductInput{
			ProductID:  p.ProductId,
			GroupLabel: p.GroupLabel,
		}
	}

	var description, imageURL *string
	if req.Description != "" {
		description = &req.Description
	}
	if req.ImageUrl != "" {
		imageURL = &req.ImageUrl
	}

	formula := &repository.Formula{
		CategoryID:  req.CategoryId,
		Name:        req.Name,
		Description: description,
		BasePrice:   req.BasePrice,
		ImageURL:    imageURL,
	}

	if err := s.formulaRepo.Create(ctx, formula, productInputs); err != nil {
		return nil, status.Error(codes.Internal, "failed to create formula")
	}

	// Reload to get full product data
	formula, _ = s.formulaRepo.GetByID(ctx, formula.ID)
	return s.formulaToProto(formula), nil
}

func (s *Service) UpdateFormula(ctx context.Context, req *menuv1.UpdateFormulaRequest) (*menuv1.Formula, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	formula, err := s.formulaRepo.GetByID(ctx, req.Id)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "formula not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get formula")
	}

	if req.Name != "" {
		formula.Name = req.Name
	}
	if req.Description != "" {
		formula.Description = &req.Description
	}
	if req.BasePrice > 0 {
		formula.BasePrice = req.BasePrice
	}
	if req.ImageUrl != "" {
		formula.ImageURL = &req.ImageUrl
	}
	if req.CategoryId != "" && req.CategoryId != formula.CategoryID {
		if _, err := s.categoryRepo.GetByID(ctx, req.CategoryId); err != nil {
			if errors.Is(err, postgres.ErrNotFound) {
				return nil, status.Error(codes.NotFound, "target category not found")
			}
			return nil, status.Error(codes.Internal, "failed to validate category")
		}
		formula.CategoryID = req.CategoryId
	}
	formula.Position = int(req.Position)

	var productInputs []repository.FormulaProductInput
	if len(req.Products) > 0 {
		productInputs = make([]repository.FormulaProductInput, len(req.Products))
		for i, p := range req.Products {
			if _, err := s.productRepo.GetByID(ctx, p.ProductId); err != nil {
				if errors.Is(err, postgres.ErrNotFound) {
					return nil, status.Errorf(codes.NotFound, "product not found: %s", p.ProductId)
				}
				return nil, status.Error(codes.Internal, "failed to validate product")
			}
			productInputs[i] = repository.FormulaProductInput{
				ProductID:  p.ProductId,
				GroupLabel: p.GroupLabel,
			}
		}
	}

	if err := s.formulaRepo.Update(ctx, formula, productInputs); err != nil {
		return nil, status.Error(codes.Internal, "failed to update formula")
	}

	formula, _ = s.formulaRepo.GetByID(ctx, formula.ID)
	return s.formulaToProto(formula), nil
}

func (s *Service) DeleteFormula(ctx context.Context, req *menuv1.DeleteFormulaRequest) (*emptypb.Empty, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	if err := s.formulaRepo.Delete(ctx, req.Id); err != nil {
		if errors.Is(err, postgres.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "formula not found")
		}
		if isFKViolation(err) {
			return nil, status.Error(codes.FailedPrecondition, "Impossible de supprimer : cette formule est liée à des commandes existantes. Rendez-la indisponible à la place.")
		}
		return nil, status.Error(codes.Internal, "failed to delete formula")
	}
	return &emptypb.Empty{}, nil
}

func (s *Service) SetFormulaAvailability(ctx context.Context, req *menuv1.SetFormulaAvailabilityRequest) (*menuv1.Formula, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	if req.Id == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	if err := s.formulaRepo.SetAvailability(ctx, req.Id, req.IsAvailable); err != nil {
		if errors.Is(err, postgres.ErrNotFound) {
			return nil, status.Error(codes.NotFound, "formula not found")
		}
		return nil, status.Error(codes.Internal, "failed to update availability")
	}

	formula, _ := s.formulaRepo.GetByID(ctx, req.Id)
	return s.formulaToProto(formula), nil
}

func (s *Service) formulaToProto(f *repository.Formula) *menuv1.Formula {
	proto := &menuv1.Formula{
		Id:          f.ID,
		CategoryId:  f.CategoryID,
		Name:        f.Name,
		BasePrice:   f.BasePrice,
		IsAvailable: f.IsAvailable,
		Position:    int32(f.Position),
		CreatedAt:   timestamppb.New(f.CreatedAt),
	}
	if f.Description != nil {
		proto.Description = *f.Description
	}
	if f.ImageURL != nil {
		proto.ImageUrl = *f.ImageURL
	}

	proto.Products = make([]*menuv1.FormulaProduct, len(f.Products))
	for i, fp := range f.Products {
		fpProto := &menuv1.FormulaProduct{
			ProductId: fp.ProductID,
			Position:  int32(fp.Position),
		}
		if fp.GroupLabel != nil {
			fpProto.GroupLabel = *fp.GroupLabel
		}
		if fp.Product != nil {
			// Product.Options are already loaded by formulaRepo.loadFormulaProducts
			fpProto.Product = s.productToProto(fp.Product, fp.Product.Options)
		}
		proto.Products[i] = fpProto
	}
	return proto
}

func (s *Service) SetOpenAIKey(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.openaiKey = key
}

func (s *Service) GetOpenAIKey() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.openaiKey
}

func (s *Service) requireAdmin(ctx context.Context) error {
	role, ok := ctx.Value(auth.UserRoleKey).(string)
	if !ok || role != "admin" {
		return status.Error(codes.PermissionDenied, "admin access required")
	}
	return nil
}

func (s *Service) productToProto(p *repository.Product, options []*repository.ProductOption) *menuv1.Product {
	proto := &menuv1.Product{
		Id:          p.ID,
		CategoryId:  p.CategoryID,
		Name:        p.Name,
		Price:       p.Price,
		IsAvailable: p.IsAvailable,
		Position:    int32(p.Position),
		CreatedAt:   timestamppb.New(p.CreatedAt),
	}

	if p.Description != nil {
		proto.Description = *p.Description
	}
	if p.ImageURL != nil {
		proto.ImageUrl = *p.ImageURL
	}
	if p.Allergens != nil {
		var allergens []string
		json.Unmarshal(p.Allergens, &allergens)
		proto.Allergens = allergens
	}
	if p.NutritionalInfo != nil {
		proto.NutritionalInfo = string(p.NutritionalInfo)
	}

	if options != nil {
		proto.Options = make([]*menuv1.ProductOption, len(options))
		for i, opt := range options {
			proto.Options[i] = s.optionToProto(opt)
		}
	}

	return proto
}

func (s *Service) optionToProto(opt *repository.ProductOption) *menuv1.ProductOption {
	proto := &menuv1.ProductOption{
		Id:            opt.ID,
		ProductId:     opt.ProductID,
		Name:          opt.Name,
		Type:          opt.Type,
		IsRequired:    opt.IsRequired,
		MaxSelections: int32(opt.MaxSelections),
	}

	if opt.Choices != nil {
		proto.Choices = make([]*menuv1.OptionChoice, len(opt.Choices))
		for i, c := range opt.Choices {
			proto.Choices[i] = &menuv1.OptionChoice{
				Id:            c.ID,
				OptionId:      c.OptionID,
				Name:          c.Name,
				PriceModifier: c.PriceModifier,
			}
		}
	}

	return proto
}

// isFKViolation checks if a database error is a foreign key constraint violation (Postgres error code 23503).
func isFKViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "violates foreign key constraint")
}
