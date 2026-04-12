package websocket

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Message types for WebSocket communication
const (
	MsgTypeDriverLocation   = "DRIVER_LOCATION"
	MsgTypeOrderStatus      = "ORDER_STATUS"
	MsgTypeNewAssignment    = "NEW_ASSIGNMENT"
	MsgTypeAssignmentUpdate = "ASSIGNMENT_UPDATE"
	MsgTypePing             = "PING"
	MsgTypePong             = "PONG"
)

// WSMessage represents a WebSocket message
type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// DriverLocationPayload contains driver position data
type DriverLocationPayload struct {
	Lat       float64  `json:"lat"`
	Lng       float64  `json:"lng"`
	Heading   *float64 `json:"heading,omitempty"`
	Speed     *float64 `json:"speed,omitempty"`
	UpdatedAt string   `json:"updatedAt"`
}

// OrderStatusPayload contains order status change data
type OrderStatusPayload struct {
	Status    string `json:"status"`
	UpdatedAt string `json:"updatedAt"`
}

// Hub manages WebSocket connections and message broadcasting
type Hub struct {
	// Registered clients
	clients     map[*Client]bool
	clientsLock sync.RWMutex

	// Client subscriptions by order ID (for tracking)
	orderSubscriptions map[string]map[*Client]bool
	orderSubLock       sync.RWMutex

	// Driver clients by driver ID
	driverClients map[string]*Client
	driverLock    sync.RWMutex

	// Channels for client registration/unregistration
	register   chan *Client
	unregister chan *Client
	broadcast  chan *BroadcastMessage

	// Redis pub/sub for multi-instance support
	redis       *redis.Client
	pubsubChan  string
	ctx         context.Context
	cancelFunc  context.CancelFunc
}

// BroadcastMessage represents a message to be broadcast
type BroadcastMessage struct {
	OrderID  string      // Target order ID (empty for driver messages)
	DriverID string      // Target driver ID (empty for order messages)
	Message  *WSMessage
}

// NewHub creates a new WebSocket hub
func NewHub(redisClient *redis.Client) *Hub {
	ctx, cancel := context.WithCancel(context.Background())
	return &Hub{
		clients:            make(map[*Client]bool),
		orderSubscriptions: make(map[string]map[*Client]bool),
		driverClients:      make(map[string]*Client),
		register:           make(chan *Client, 256),
		unregister:         make(chan *Client, 256),
		broadcast:          make(chan *BroadcastMessage, 256),
		redis:              redisClient,
		pubsubChan:         "beldys:ws:delivery",
		ctx:                ctx,
		cancelFunc:         cancel,
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	// Start Redis pub/sub listener for multi-instance support
	if h.redis != nil {
		go h.subscribeToRedis()
	}

	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case msg := <-h.broadcast:
			h.handleBroadcast(msg)

		case <-h.ctx.Done():
			return
		}
	}
}

// Stop gracefully shuts down the hub
func (h *Hub) Stop() {
	h.cancelFunc()

	h.clientsLock.Lock()
	for client := range h.clients {
		close(client.send)
	}
	h.clientsLock.Unlock()
}

// MaxClients is the maximum number of concurrent WebSocket connections allowed.
const MaxClients = 500

func (h *Hub) registerClient(client *Client) {
	h.clientsLock.Lock()
	if len(h.clients) >= MaxClients {
		h.clientsLock.Unlock()
		log.Printf("WS hub at capacity (%d clients), rejecting new connection", MaxClients)
		close(client.send)
		return
	}
	h.clients[client] = true
	h.clientsLock.Unlock()

	// Register order subscription
	if client.OrderID != "" {
		h.orderSubLock.Lock()
		if h.orderSubscriptions[client.OrderID] == nil {
			h.orderSubscriptions[client.OrderID] = make(map[*Client]bool)
		}
		h.orderSubscriptions[client.OrderID][client] = true
		h.orderSubLock.Unlock()
		log.Printf("Client subscribed to order %s", client.OrderID)
	}

	// Register driver client
	if client.DriverID != "" {
		h.driverLock.Lock()
		h.driverClients[client.DriverID] = client
		h.driverLock.Unlock()
		log.Printf("Driver %s connected", client.DriverID)
	}
}

func (h *Hub) unregisterClient(client *Client) {
	h.clientsLock.Lock()
	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		close(client.send)
	}
	h.clientsLock.Unlock()

	// Unregister order subscription
	if client.OrderID != "" {
		h.orderSubLock.Lock()
		if subs, ok := h.orderSubscriptions[client.OrderID]; ok {
			delete(subs, client)
			if len(subs) == 0 {
				delete(h.orderSubscriptions, client.OrderID)
			}
		}
		h.orderSubLock.Unlock()
	}

	// Unregister driver client
	if client.DriverID != "" {
		h.driverLock.Lock()
		if h.driverClients[client.DriverID] == client {
			delete(h.driverClients, client.DriverID)
		}
		h.driverLock.Unlock()
	}
}

func (h *Hub) handleBroadcast(msg *BroadcastMessage) {
	data, err := json.Marshal(msg.Message)
	if err != nil {
		log.Printf("Failed to marshal WebSocket message: %v", err)
		return
	}

	// Broadcast to order subscribers
	if msg.OrderID != "" {
		h.orderSubLock.RLock()
		clients := h.orderSubscriptions[msg.OrderID]
		h.orderSubLock.RUnlock()

		for client := range clients {
			select {
			case client.send <- data:
			default:
				// Client buffer full, disconnect
				go func(c *Client) { h.unregister <- c }(client)
			}
		}
	}

	// Send to specific driver
	if msg.DriverID != "" {
		h.driverLock.RLock()
		client := h.driverClients[msg.DriverID]
		h.driverLock.RUnlock()

		if client != nil {
			select {
			case client.send <- data:
			default:
				go func(c *Client) { h.unregister <- c }(client)
			}
		}
	}
}

// subscribeToRedis listens for messages from other instances
func (h *Hub) subscribeToRedis() {
	pubsub := h.redis.Subscribe(h.ctx, h.pubsubChan)
	defer pubsub.Close()

	ch := pubsub.Channel()
	for {
		select {
		case msg := <-ch:
			if msg == nil {
				continue
			}
			var broadcast BroadcastMessage
			if err := json.Unmarshal([]byte(msg.Payload), &broadcast); err != nil {
				log.Printf("Failed to unmarshal Redis message: %v", err)
				continue
			}
			// Handle locally (don't re-publish to Redis)
			h.handleBroadcast(&broadcast)

		case <-h.ctx.Done():
			return
		}
	}
}

// publishToRedis sends a message to other instances
func (h *Hub) publishToRedis(msg *BroadcastMessage) {
	if h.redis == nil {
		return
	}

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal broadcast message: %v", err)
		return
	}

	h.redis.Publish(h.ctx, h.pubsubChan, string(data))
}

// ===== Public API (implements delivery.WebSocketHub interface) =====

// BroadcastDriverLocation sends driver position to order tracking clients
func (h *Hub) BroadcastDriverLocation(orderID string, lat, lng float64, heading, speed *float64) {
	msg := &BroadcastMessage{
		OrderID: orderID,
		Message: &WSMessage{
			Type: MsgTypeDriverLocation,
			Payload: DriverLocationPayload{
				Lat:       lat,
				Lng:       lng,
				Heading:   heading,
				Speed:     speed,
				UpdatedAt: time.Now().Format(time.RFC3339),
			},
		},
	}

	// Send locally
	select {
	case h.broadcast <- msg:
	default:
		log.Printf("Broadcast channel full, dropping driver location for order %s", orderID)
	}

	// Publish to other instances
	h.publishToRedis(msg)
}

// BroadcastOrderStatus sends order status change to tracking clients
func (h *Hub) BroadcastOrderStatus(orderID, status string) {
	msg := &BroadcastMessage{
		OrderID: orderID,
		Message: &WSMessage{
			Type: MsgTypeOrderStatus,
			Payload: OrderStatusPayload{
				Status:    status,
				UpdatedAt: time.Now().Format(time.RFC3339),
			},
		},
	}

	select {
	case h.broadcast <- msg:
	default:
		log.Printf("Broadcast channel full, dropping order status for order %s", orderID)
	}

	h.publishToRedis(msg)
}

// NotifyDriver sends a message to a specific driver
func (h *Hub) NotifyDriver(driverID string, message interface{}) {
	msg := &BroadcastMessage{
		DriverID: driverID,
		Message: &WSMessage{
			Type:    MsgTypeNewAssignment,
			Payload: message,
		},
	}

	select {
	case h.broadcast <- msg:
	default:
		log.Printf("Broadcast channel full, dropping notification for driver %s", driverID)
	}

	h.publishToRedis(msg)
}

// Register registers a client with the hub
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Unregister unregisters a client from the hub
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

// GetActiveOrderSubscriptions returns the number of active order subscriptions
func (h *Hub) GetActiveOrderSubscriptions() int {
	h.orderSubLock.RLock()
	defer h.orderSubLock.RUnlock()
	return len(h.orderSubscriptions)
}

// GetActiveDrivers returns the number of connected drivers
func (h *Hub) GetActiveDrivers() int {
	h.driverLock.RLock()
	defer h.driverLock.RUnlock()
	return len(h.driverClients)
}
