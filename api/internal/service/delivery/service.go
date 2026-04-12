package delivery

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/beldys/api/internal/repository"
	"github.com/beldys/api/internal/repository/postgres"
	"github.com/beldys/api/internal/service/auth"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	deliveryv1 "github.com/beldys/api/gen/delivery/v1"
)

type Service struct {
	deliveryv1.UnimplementedDeliveryServiceServer
	driverRepo      repository.DriverRepository
	orderRepo       repository.OrderRepository
	restaurantRepo  repository.RestaurantRepository
	userRepo        repository.UserRepository
	wsHub WebSocketHub // Interface for WebSocket notifications
}

// WebSocketHub interface for broadcasting real-time updates
type WebSocketHub interface {
	BroadcastDriverLocation(orderID string, lat, lng float64, heading, speed *float64)
	BroadcastOrderStatus(orderID, status string)
	NotifyDriver(driverID string, message interface{})
}

func NewService(
	driverRepo repository.DriverRepository,
	orderRepo repository.OrderRepository,
	restaurantRepo repository.RestaurantRepository,
	userRepo repository.UserRepository,
	wsHub WebSocketHub,
) *Service {
	return &Service{
		driverRepo:     driverRepo,
		orderRepo:      orderRepo,
		restaurantRepo: restaurantRepo,
		userRepo:       userRepo,
		wsHub:          wsHub,
	}
}

// ===== Driver Endpoints =====

func (s *Service) ListMyDeliveries(ctx context.Context, req *deliveryv1.ListMyDeliveriesRequest) (*deliveryv1.ListDeliveriesResponse, error) {
	driverID, err := s.getDriverID(ctx)
	if err != nil {
		return nil, err
	}

	assignments, err := s.driverRepo.ListAssignmentsByDriver(ctx, driverID, req.Status)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to list deliveries")
	}

	protoAssignments := make([]*deliveryv1.DeliveryAssignment, len(assignments))
	for i, a := range assignments {
		protoAssignments[i] = s.assignmentToProto(ctx, a)
	}

	return &deliveryv1.ListDeliveriesResponse{
		Assignments: protoAssignments,
	}, nil
}

func (s *Service) AcceptDelivery(ctx context.Context, req *deliveryv1.AcceptDeliveryRequest) (*deliveryv1.DeliveryAssignment, error) {
	driverID, err := s.getDriverID(ctx)
	if err != nil {
		return nil, err
	}

	assignment, err := s.driverRepo.GetAssignment(ctx, req.AssignmentId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "assignment not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get assignment")
	}

	if assignment.DriverID != driverID {
		return nil, status.Error(codes.PermissionDenied, "not your assignment")
	}

	if assignment.Status != "pending" {
		return nil, status.Error(codes.FailedPrecondition, "assignment already processed")
	}

	if time.Now().After(assignment.ExpiresAt) {
		return nil, status.Error(codes.FailedPrecondition, "assignment expired")
	}

	// Update assignment status
	if err := s.driverRepo.UpdateAssignmentStatus(ctx, req.AssignmentId, "accepted", nil); err != nil {
		return nil, status.Error(codes.Internal, "failed to accept assignment")
	}

	// Cancel all other pending assignments for this order (first-to-accept wins)
	go s.driverRepo.CancelOtherPendingAssignments(context.Background(), assignment.OrderID, req.AssignmentId)

	// Link driver to order
	if err := s.driverRepo.AssignDriverToOrder(ctx, assignment.OrderID, driverID); err != nil {
		return nil, status.Error(codes.Internal, "failed to assign driver to order")
	}

	// Update driver status to on_delivery
	if err := s.driverRepo.SetAvailability(ctx, driverID, "on_delivery"); err != nil {
		return nil, status.Error(codes.Internal, "failed to update driver status")
	}

	// Update driver_status with current order
	statusObj := &repository.DriverStatus{
		DriverID:       driverID,
		Status:         "on_delivery",
		CurrentOrderID: &assignment.OrderID,
	}
	s.driverRepo.UpsertStatus(ctx, statusObj)

	assignment.Status = "accepted"
	now := time.Now()
	assignment.RespondedAt = &now

	return s.assignmentToProto(ctx, assignment), nil
}

func (s *Service) RejectDelivery(ctx context.Context, req *deliveryv1.RejectDeliveryRequest) (*deliveryv1.DeliveryAssignment, error) {
	driverID, err := s.getDriverID(ctx)
	if err != nil {
		return nil, err
	}

	assignment, err := s.driverRepo.GetAssignment(ctx, req.AssignmentId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "assignment not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get assignment")
	}

	if assignment.DriverID != driverID {
		return nil, status.Error(codes.PermissionDenied, "not your assignment")
	}

	if assignment.Status != "pending" {
		return nil, status.Error(codes.FailedPrecondition, "assignment already processed")
	}

	notes := req.Reason
	if err := s.driverRepo.UpdateAssignmentStatus(ctx, req.AssignmentId, "rejected", &notes); err != nil {
		return nil, status.Error(codes.Internal, "failed to reject assignment")
	}

	assignment.Status = "rejected"
	now := time.Now()
	assignment.RespondedAt = &now
	assignment.Notes = &notes

	return s.assignmentToProto(ctx, assignment), nil
}

func (s *Service) UpdateDeliveryStatus(ctx context.Context, req *deliveryv1.UpdateDeliveryStatusRequest) (*deliveryv1.DeliveryAssignment, error) {
	driverID, err := s.getDriverID(ctx)
	if err != nil {
		return nil, err
	}

	assignment, err := s.driverRepo.GetAssignment(ctx, req.AssignmentId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "assignment not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get assignment")
	}

	if assignment.DriverID != driverID {
		return nil, status.Error(codes.PermissionDenied, "not your assignment")
	}

	if assignment.Status != "accepted" {
		return nil, status.Error(codes.FailedPrecondition, "assignment not accepted")
	}

	// Map delivery status to order status
	var orderStatus string
	switch req.Status {
	case "picked_up":
		orderStatus = "out_for_delivery"
	case "delivered":
		orderStatus = "delivered"
		// Complete the assignment
		if err := s.driverRepo.CompleteAssignment(ctx, req.AssignmentId); err != nil {
			return nil, status.Error(codes.Internal, "failed to complete assignment")
		}
		// Set driver back to available
		if err := s.driverRepo.SetAvailability(ctx, driverID, "available"); err != nil {
			return nil, status.Error(codes.Internal, "failed to update driver status")
		}
		// Clear current order from driver status
		statusObj := &repository.DriverStatus{
			DriverID:       driverID,
			Status:         "available",
			CurrentOrderID: nil,
		}
		s.driverRepo.UpsertStatus(ctx, statusObj)
	default:
		return nil, status.Error(codes.InvalidArgument, "invalid status: use picked_up or delivered")
	}

	// Update order status
	if err := s.orderRepo.UpdateStatus(ctx, assignment.OrderID, orderStatus, &driverID, nil); err != nil {
		return nil, status.Error(codes.Internal, "failed to update order status")
	}

	// Broadcast order status change via WebSocket
	if s.wsHub != nil {
		s.wsHub.BroadcastOrderStatus(assignment.OrderID, orderStatus)
	}

	// Refresh assignment
	assignment, _ = s.driverRepo.GetAssignment(ctx, req.AssignmentId)

	return s.assignmentToProto(ctx, assignment), nil
}

func (s *Service) UpdateLocation(ctx context.Context, req *deliveryv1.UpdateLocationRequest) (*deliveryv1.UpdateLocationResponse, error) {
	driverID, err := s.getDriverID(ctx)
	if err != nil {
		return nil, err
	}

	loc := &repository.DriverLocation{
		DriverID: driverID,
		Lat:      req.Lat,
		Lng:      req.Lng,
	}
	if req.Heading != 0 {
		loc.Heading = &req.Heading
	}
	if req.Speed != 0 {
		loc.Speed = &req.Speed
	}
	if req.Accuracy != 0 {
		loc.Accuracy = &req.Accuracy
	}

	if err := s.driverRepo.UpdateLocation(ctx, loc); err != nil {
		return nil, status.Error(codes.Internal, "failed to update location")
	}

	// Update last_seen_at
	s.driverRepo.SetAvailability(ctx, driverID, "") // This will update last_seen_at

	// Get current order and broadcast location to clients
	driverStatus, _ := s.driverRepo.GetStatus(ctx, driverID)
	if driverStatus != nil && driverStatus.CurrentOrderID != nil && s.wsHub != nil {
		s.wsHub.BroadcastDriverLocation(*driverStatus.CurrentOrderID, req.Lat, req.Lng, loc.Heading, loc.Speed)
	}

	return &deliveryv1.UpdateLocationResponse{Success: true}, nil
}

func (s *Service) SetAvailability(ctx context.Context, req *deliveryv1.SetAvailabilityRequest) (*deliveryv1.DriverStatus, error) {
	driverID, err := s.getDriverID(ctx)
	if err != nil {
		return nil, err
	}

	if req.Status != "offline" && req.Status != "available" {
		return nil, status.Error(codes.InvalidArgument, "status must be 'offline' or 'available'")
	}

	if err := s.driverRepo.SetAvailability(ctx, driverID, req.Status); err != nil {
		return nil, status.Error(codes.Internal, "failed to set availability")
	}

	// Log the availability change for hours tracking
	if err := s.driverRepo.LogAvailabilityChange(ctx, driverID, req.Status); err != nil {
		log.Printf("[SetAvailability] Failed to log availability change: %v", err)
	}

	driverStatus, _ := s.driverRepo.GetStatus(ctx, driverID)
	return s.statusToProto(driverStatus), nil
}

func (s *Service) GetMyStats(ctx context.Context, req *deliveryv1.GetMyStatsRequest) (*deliveryv1.DriverStats, error) {
	driverID, err := s.getDriverID(ctx)
	if err != nil {
		return nil, err
	}

	today, _ := s.driverRepo.CountDeliveriesToday(ctx, driverID)
	total, _ := s.driverRepo.CountDeliveriesTotal(ctx, driverID)
	hours, _ := s.driverRepo.GetHoursWorkedToday(ctx, driverID)

	return &deliveryv1.DriverStats{
		DeliveriesToday:  int32(today),
		DeliveriesTotal:  int32(total),
		HoursWorkedToday: hours,
	}, nil
}

func (s *Service) GetMyReport(ctx context.Context, req *deliveryv1.GetMyReportRequest) (*deliveryv1.GetMyReportResponse, error) {
	driverID, err := s.getDriverID(ctx)
	if err != nil {
		return nil, err
	}

	from, err := time.Parse("2006-01-02", req.FromDate)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid from_date, use YYYY-MM-DD")
	}
	to, err := time.Parse("2006-01-02", req.ToDate)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid to_date, use YYYY-MM-DD")
	}
	if to.Before(from) {
		return nil, status.Error(codes.InvalidArgument, "to_date must be >= from_date")
	}

	workEntries, err := s.driverRepo.GetDailyWorkSummary(ctx, driverID, from, to)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get work summary")
	}
	deliveryCounts, err := s.driverRepo.GetDailyDeliveryCounts(ctx, driverID, from, to)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get delivery counts")
	}

	deliveryMap := make(map[string]int)
	for _, dc := range deliveryCounts {
		deliveryMap[dc.Date.Format("2006-01-02")] = dc.Count
	}

	var days []*deliveryv1.DailyDriverSummary
	var totalHours float64
	var totalDeliveries int32
	for _, we := range workEntries {
		dateStr := we.Date.Format("2006-01-02")
		count := int32(deliveryMap[dateStr])
		days = append(days, &deliveryv1.DailyDriverSummary{
			Date:                dateStr,
			HoursWorked:         we.Hours,
			DeliveriesCompleted: count,
		})
		totalHours += we.Hours
		totalDeliveries += count
	}

	return &deliveryv1.GetMyReportResponse{
		Days:            days,
		TotalHours:      totalHours,
		TotalDeliveries: totalDeliveries,
	}, nil
}

func (s *Service) GetMyStatus(ctx context.Context, req *deliveryv1.GetMyStatusRequest) (*deliveryv1.DriverStatus, error) {
	driverID, err := s.getDriverID(ctx)
	if err != nil {
		return nil, err
	}

	driverStatus, err := s.driverRepo.GetStatus(ctx, driverID)
	if errors.Is(err, postgres.ErrNotFound) {
		// Return default offline status
		return &deliveryv1.DriverStatus{
			DriverId: driverID,
			Status:   "offline",
		}, nil
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get status")
	}

	return s.statusToProto(driverStatus), nil
}

// ===== Admin Endpoints =====

func (s *Service) AdminListDrivers(ctx context.Context, req *deliveryv1.AdminListDriversRequest) (*deliveryv1.AdminListDriversResponse, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	page := int(req.Page)
	pageSize := int(req.PageSize)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	users, statuses, locations, total, err := s.driverRepo.ListDriversWithDetails(ctx, req.Status, page, pageSize)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to list drivers")
	}

	drivers := make([]*deliveryv1.DriverDetails, len(users))

	// Collect driver IDs for batch stats query
	driverIDs := make([]string, len(users))
	for i, u := range users {
		driverIDs[i] = u.ID
	}
	batchStats, _ := s.driverRepo.GetBatchDriverStats(ctx, driverIDs)

	for i, u := range users {
		drivers[i] = &deliveryv1.DriverDetails{
			Id:    u.ID,
			Email: u.Email,
		}
		if u.Name != nil {
			drivers[i].Name = *u.Name
		}
		if u.Phone != nil {
			drivers[i].Phone = *u.Phone
		}
		if statuses[i] != nil {
			drivers[i].Status = s.statusToProto(statuses[i])
		}
		if locations[i] != nil {
			drivers[i].Location = s.locationToProto(locations[i])
		}

		st := batchStats[u.ID]
		drivers[i].Stats = &deliveryv1.DriverStats{
			DeliveriesToday:  int32(st.DeliveriesToday),
			DeliveriesTotal:  int32(st.DeliveriesTotal),
			HoursWorkedToday: st.HoursWorkedToday,
		}
	}

	return &deliveryv1.AdminListDriversResponse{
		Drivers: drivers,
		Total:   int32(total),
	}, nil
}

func (s *Service) AdminGetDriver(ctx context.Context, req *deliveryv1.AdminGetDriverRequest) (*deliveryv1.DriverDetails, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	user, err := s.userRepo.GetByID(ctx, req.DriverId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "driver not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get driver")
	}

	if user.Role != "livreur" {
		return nil, status.Error(codes.NotFound, "user is not a driver")
	}

	driver := &deliveryv1.DriverDetails{
		Id:    user.ID,
		Email: user.Email,
	}
	if user.Name != nil {
		driver.Name = *user.Name
	}
	if user.Phone != nil {
		driver.Phone = *user.Phone
	}

	if driverStatus, _ := s.driverRepo.GetStatus(ctx, user.ID); driverStatus != nil {
		driver.Status = s.statusToProto(driverStatus)
	}
	if location, _ := s.driverRepo.GetLocation(ctx, user.ID); location != nil {
		driver.Location = s.locationToProto(location)
	}

	today, _ := s.driverRepo.CountDeliveriesToday(ctx, user.ID)
	total, _ := s.driverRepo.CountDeliveriesTotal(ctx, user.ID)
	hours, _ := s.driverRepo.GetHoursWorkedToday(ctx, user.ID)
	driver.Stats = &deliveryv1.DriverStats{
		DeliveriesToday:  int32(today),
		DeliveriesTotal:  int32(total),
		HoursWorkedToday: hours,
	}

	return driver, nil
}

func (s *Service) AdminAssignDriver(ctx context.Context, req *deliveryv1.AdminAssignDriverRequest) (*deliveryv1.DeliveryAssignment, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	// Verify order exists and is in valid state
	order, err := s.orderRepo.GetByID(ctx, req.OrderId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "order not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get order")
	}

	if order.Status != "confirmed" && order.Status != "preparing" && order.Status != "ready" {
		return nil, status.Error(codes.FailedPrecondition, "order not ready for delivery assignment")
	}

	// Verify driver exists and is a livreur
	driver, err := s.userRepo.GetByID(ctx, req.DriverId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "driver not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get driver")
	}

	if driver.Role != "livreur" {
		return nil, status.Error(codes.InvalidArgument, "user is not a driver")
	}

	// Calculate expiry time
	expiryMinutes := int(req.ExpiryMinutes)
	if expiryMinutes <= 0 {
		expiryMinutes = 10
	}
	expiresAt := time.Now().Add(time.Duration(expiryMinutes) * time.Minute)

	// Check if assignment already exists for this order+driver pair
	existing, _ := s.driverRepo.GetAssignmentByOrderAndDriver(ctx, req.OrderId, req.DriverId)
	var assignment *repository.DeliveryAssignment

	if existing != nil {
		if existing.Status == "pending" || existing.Status == "accepted" {
			return nil, status.Error(codes.AlreadyExists, "assignment already exists")
		}
		// Re-use the existing cancelled/rejected/expired row (UNIQUE constraint)
		if err := s.driverRepo.ResetAssignment(ctx, existing.ID, expiresAt); err != nil {
			return nil, status.Error(codes.Internal, "failed to reset assignment")
		}
		existing.Status = "pending"
		existing.ExpiresAt = expiresAt
		existing.AssignedAt = time.Now()
		existing.RespondedAt = nil
		existing.CompletedAt = nil
		existing.Notes = nil
		assignment = existing
	} else {
		assignment = &repository.DeliveryAssignment{
			OrderID:   req.OrderId,
			DriverID:  req.DriverId,
			Status:    "pending",
			ExpiresAt: expiresAt,
		}
		if err := s.driverRepo.CreateAssignment(ctx, assignment); err != nil {
			if errors.Is(err, postgres.ErrDuplicateAssignment) {
				return nil, status.Error(codes.AlreadyExists, "order already assigned to another driver")
			}
			return nil, status.Error(codes.Internal, "failed to create assignment")
		}
	}

	// Notify driver via WebSocket
	if s.wsHub != nil {
		s.wsHub.NotifyDriver(req.DriverId, map[string]interface{}{
			"type":         "NEW_ASSIGNMENT",
			"assignmentId": assignment.ID,
			"orderId":      req.OrderId,
		})
	}

	return s.assignmentToProto(ctx, assignment), nil
}

func (s *Service) AdminUnassignDriver(ctx context.Context, req *deliveryv1.AdminUnassignDriverRequest) (*deliveryv1.DeliveryAssignment, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	// Verify order exists
	_, err := s.orderRepo.GetByID(ctx, req.OrderId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "order not found")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get order")
	}

	// Get all assignments for this order
	assignments, err := s.driverRepo.ListAssignmentsByOrder(ctx, req.OrderId)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to list assignments")
	}

	var lastCancelled *repository.DeliveryAssignment
	reason := req.Reason
	if reason == "" {
		reason = "Unassigned by admin"
	}

	for _, a := range assignments {
		if a.Status != "pending" && a.Status != "accepted" {
			continue
		}

		wasAccepted := a.Status == "accepted"

		// Cancel the assignment
		if err := s.driverRepo.UpdateAssignmentStatus(ctx, a.ID, "cancelled", &reason); err != nil {
			return nil, status.Error(codes.Internal, "failed to cancel assignment")
		}

		a.Status = "cancelled"
		a.Notes = &reason
		lastCancelled = a

		// If driver had accepted, reset their state
		if wasAccepted {
			// Remove driver from order
			if err := s.driverRepo.UnassignDriverFromOrder(ctx, req.OrderId); err != nil {
				log.Printf("[AdminUnassign] Failed to unassign driver from order: %v", err)
			}

			// Reset driver status to available and clear current order
			statusObj := &repository.DriverStatus{
				DriverID:       a.DriverID,
				Status:         "available",
				CurrentOrderID: nil,
			}
			if err := s.driverRepo.UpsertStatus(ctx, statusObj); err != nil {
				log.Printf("[AdminUnassign] Failed to reset driver status: %v", err)
			}
		}

		// Notify driver via WebSocket
		if s.wsHub != nil {
			s.wsHub.NotifyDriver(a.DriverID, map[string]interface{}{
				"type":    "ASSIGNMENT_CANCELLED",
				"orderId": req.OrderId,
				"reason":  reason,
			})
		}
	}

	if lastCancelled == nil {
		return nil, status.Error(codes.FailedPrecondition, "no active assignments to cancel")
	}

	return s.assignmentToProto(ctx, lastCancelled), nil
}

func (s *Service) AdminListNearbyDrivers(ctx context.Context, req *deliveryv1.AdminListNearbyDriversRequest) (*deliveryv1.AdminListDriversResponse, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	radiusKm := req.RadiusKm
	if radiusKm <= 0 {
		radiusKm = 5.0
	}

	users, statuses, locations, err := s.driverRepo.ListNearbyDrivers(ctx, req.Lat, req.Lng, radiusKm)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to list nearby drivers")
	}

	drivers := make([]*deliveryv1.DriverDetails, len(users))
	for i, u := range users {
		drivers[i] = &deliveryv1.DriverDetails{
			Id:       u.ID,
			Email:    u.Email,
			Status:   s.statusToProto(statuses[i]),
			Location: s.locationToProto(locations[i]),
		}
		if u.Name != nil {
			drivers[i].Name = *u.Name
		}
		if u.Phone != nil {
			drivers[i].Phone = *u.Phone
		}
	}

	return &deliveryv1.AdminListDriversResponse{
		Drivers: drivers,
		Total:   int32(len(drivers)),
	}, nil
}

func (s *Service) AdminGetDriverReport(ctx context.Context, req *deliveryv1.AdminGetDriverReportRequest) (*deliveryv1.AdminGetDriverReportResponse, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return nil, err
	}

	// Parse date range
	from, err := time.Parse("2006-01-02", req.FromDate)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid from_date format, use YYYY-MM-DD")
	}
	to, err := time.Parse("2006-01-02", req.ToDate)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "invalid to_date format, use YYYY-MM-DD")
	}
	if to.Before(from) {
		return nil, status.Error(codes.InvalidArgument, "to_date must be >= from_date")
	}

	// Fetch driver details (reuse AdminGetDriver logic)
	driver, err := s.AdminGetDriver(ctx, &deliveryv1.AdminGetDriverRequest{DriverId: req.DriverId})
	if err != nil {
		return nil, err
	}

	// Fetch daily breakdowns
	workEntries, err := s.driverRepo.GetDailyWorkSummary(ctx, req.DriverId, from, to)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get work summary")
	}
	deliveryCounts, err := s.driverRepo.GetDailyDeliveryCounts(ctx, req.DriverId, from, to)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get delivery counts")
	}

	// Build a map of delivery counts by date for merging
	deliveryMap := make(map[string]int)
	for _, dc := range deliveryCounts {
		deliveryMap[dc.Date.Format("2006-01-02")] = dc.Count
	}

	// Merge into daily summaries
	var days []*deliveryv1.DailyDriverSummary
	var totalHours float64
	var totalDeliveries int32
	for _, we := range workEntries {
		dateStr := we.Date.Format("2006-01-02")
		count := int32(deliveryMap[dateStr])
		days = append(days, &deliveryv1.DailyDriverSummary{
			Date:                dateStr,
			HoursWorked:         we.Hours,
			DeliveriesCompleted: count,
		})
		totalHours += we.Hours
		totalDeliveries += count
	}

	return &deliveryv1.AdminGetDriverReportResponse{
		Driver:          driver,
		Days:            days,
		TotalHours:      totalHours,
		TotalDeliveries: totalDeliveries,
	}, nil
}

func (s *Service) GetOrderDriverLocation(ctx context.Context, req *deliveryv1.GetOrderDriverLocationRequest) (*deliveryv1.DriverLocation, error) {
	// Anyone authenticated can check their order's driver location
	userID, err := s.getUserID(ctx)
	if err != nil {
		return nil, err
	}

	// Verify order belongs to user or user is admin
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

	// Get driver location
	location, err := s.driverRepo.GetLocationByOrderID(ctx, req.OrderId)
	if errors.Is(err, postgres.ErrNotFound) {
		return nil, status.Error(codes.NotFound, "driver location not available")
	}
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get driver location")
	}

	return s.locationToProto(location), nil
}

// ===== Helpers =====

func (s *Service) getUserID(ctx context.Context) (string, error) {
	userID, ok := ctx.Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		return "", status.Error(codes.Unauthenticated, "authentication required")
	}
	return userID, nil
}

func (s *Service) getDriverID(ctx context.Context) (string, error) {
	userID, err := s.getUserID(ctx)
	if err != nil {
		return "", err
	}

	role, ok := ctx.Value(auth.UserRoleKey).(string)
	if !ok || role != "livreur" {
		return "", status.Error(codes.PermissionDenied, "driver access required")
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

func (s *Service) assignmentToProto(ctx context.Context, a *repository.DeliveryAssignment) *deliveryv1.DeliveryAssignment {
	if a == nil {
		return nil
	}

	proto := &deliveryv1.DeliveryAssignment{
		Id:         a.ID,
		OrderId:    a.OrderID,
		DriverId:   a.DriverID,
		Status:     a.Status,
		AssignedAt: timestamppb.New(a.AssignedAt),
		ExpiresAt:  timestamppb.New(a.ExpiresAt),
	}

	if a.RespondedAt != nil {
		proto.RespondedAt = timestamppb.New(*a.RespondedAt)
	}
	if a.CompletedAt != nil {
		proto.CompletedAt = timestamppb.New(*a.CompletedAt)
	}
	if a.Notes != nil {
		proto.Notes = *a.Notes
	}

	// Fetch order summary
	if order, err := s.orderRepo.GetByID(ctx, a.OrderID); err == nil {
		proto.Order = s.orderSummaryToProto(ctx, order)
	}

	return proto
}

func (s *Service) orderSummaryToProto(ctx context.Context, o *repository.Order) *deliveryv1.OrderSummary {
	if o == nil {
		return nil
	}

	summary := &deliveryv1.OrderSummary{
		Id:        o.ID,
		Total:     o.Total,
		Status:    o.Status,
		ItemCount: int32(len(o.Items)),
		CreatedAt: timestamppb.New(o.CreatedAt),
	}

	if o.DeliveryAddress != nil {
		summary.DeliveryAddress = *o.DeliveryAddress
	}
	if o.DeliveryLat != nil {
		summary.DeliveryLat = *o.DeliveryLat
	}
	if o.DeliveryLng != nil {
		summary.DeliveryLng = *o.DeliveryLng
	}
	if o.DeliveryInstructions != nil {
		summary.DeliveryInstructions = *o.DeliveryInstructions
	}

	// Fetch restaurant info
	if restaurant, err := s.restaurantRepo.GetByID(ctx, o.RestaurantID); err == nil {
		summary.RestaurantName = restaurant.Name
		summary.RestaurantAddress = restaurant.Address
		if restaurant.Lat != nil {
			summary.RestaurantLat = *restaurant.Lat
		}
		if restaurant.Lng != nil {
			summary.RestaurantLng = *restaurant.Lng
		}
	}

	// Fetch customer info
	if user, err := s.userRepo.GetByID(ctx, o.UserID); err == nil {
		if user.Name != nil {
			summary.CustomerName = *user.Name
		}
		if user.Phone != nil {
			summary.CustomerPhone = *user.Phone
		}
	}

	// Include order items so drivers can see the order content
	for _, item := range o.Items {
		itemSummary := &deliveryv1.OrderItemSummary{
			ProductName: item.ProductName,
			Quantity:    int32(item.Quantity),
			UnitPrice:   item.UnitPrice,
			Total:       item.Total,
		}
		if item.Notes != nil {
			itemSummary.Notes = *item.Notes
		}
		summary.Items = append(summary.Items, itemSummary)
	}

	return summary
}

func (s *Service) statusToProto(ds *repository.DriverStatus) *deliveryv1.DriverStatus {
	if ds == nil {
		return nil
	}

	proto := &deliveryv1.DriverStatus{
		DriverId:       ds.DriverID,
		Status:         ds.Status,
		LastSeenAt: timestamppb.New(ds.LastSeenAt),
		UpdatedAt:  timestamppb.New(ds.UpdatedAt),
	}

	if ds.CurrentOrderID != nil {
		proto.CurrentOrderId = *ds.CurrentOrderID
	}
	if ds.Phone != nil {
		proto.Phone = *ds.Phone
	}

	return proto
}

func (s *Service) locationToProto(loc *repository.DriverLocation) *deliveryv1.DriverLocation {
	if loc == nil {
		return nil
	}

	proto := &deliveryv1.DriverLocation{
		DriverId:  loc.DriverID,
		Lat:       loc.Lat,
		Lng:       loc.Lng,
		UpdatedAt: timestamppb.New(loc.UpdatedAt),
	}

	if loc.Heading != nil {
		proto.Heading = *loc.Heading
	}
	if loc.Speed != nil {
		proto.Speed = *loc.Speed
	}
	if loc.Accuracy != nil {
		proto.Accuracy = *loc.Accuracy
	}

	return proto
}
