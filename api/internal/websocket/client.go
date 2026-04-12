package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 4096
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Mobile apps (React Native / Expo) don't send Origin headers.
		// Allow if a JWT token is provided in the query string — JWT auth
		// handles authorization; origin check is a browser-only CSRF concern.
		if r.URL.Query().Get("token") != "" {
			return true
		}
		origin := r.Header.Get("Origin")
		if origin == "" {
			// No origin and no token — only allow in non-production envs.
			env := os.Getenv("ENV")
			if env == "production" {
				log.Printf("WebSocket: rejected no-origin/no-token connection from %s", r.RemoteAddr)
				return false
			}
			return true
		}
		allowed := os.Getenv("ALLOWED_ORIGINS")
		if allowed == "" {
			// Dev default: allow localhost
			allowed = "http://localhost:3000,http://localhost:8080"
		}
		for _, a := range strings.Split(allowed, ",") {
			if strings.TrimSpace(a) == origin {
				return true
			}
		}
		log.Printf("WebSocket: rejected origin %s", origin)
		return false
	},
}

// Client represents a WebSocket connection
type Client struct {
	hub *Hub

	// WebSocket connection
	conn *websocket.Conn

	// Buffered channel for outgoing messages
	send chan []byte

	// Order ID this client is tracking (for client tracking)
	OrderID string

	// Driver ID if this is a driver connection
	DriverID string

	// User ID for authentication
	UserID string
}

// NewClient creates a new WebSocket client
func NewClient(hub *Hub, conn *websocket.Conn, userID, orderID, driverID string) *Client {
	return &Client{
		hub:      hub,
		conn:     conn,
		send:     make(chan []byte, 256),
		OrderID:  orderID,
		DriverID: driverID,
		UserID:   userID,
	}
}

// readPump pumps messages from the WebSocket connection to the hub
func (c *Client) readPump() {
	defer func() {
		c.hub.Unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Parse incoming message
		var msg WSMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Failed to parse WebSocket message: %v", err)
			continue
		}

		c.handleMessage(&msg)
	}
}

// writePump pumps messages from the hub to the WebSocket connection
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Write any queued messages
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte("\n"))
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage processes incoming WebSocket messages
func (c *Client) handleMessage(msg *WSMessage) {
	switch msg.Type {
	case MsgTypePing:
		// Respond with pong
		response := &WSMessage{Type: MsgTypePong}
		data, _ := json.Marshal(response)
		select {
		case c.send <- data:
		default:
		}

	case MsgTypeDriverLocation:
		// Driver sending location update
		if c.DriverID == "" {
			return // Only drivers can send location
		}

		payload, ok := msg.Payload.(map[string]interface{})
		if !ok {
			return
		}

		lat, _ := payload["lat"].(float64)
		lng, _ := payload["lng"].(float64)

		var heading, speed *float64
		if h, ok := payload["heading"].(float64); ok {
			heading = &h
		}
		if s, ok := payload["speed"].(float64); ok {
			speed = &s
		}

		// Log location update with optional heading/speed
		if heading != nil && speed != nil {
			log.Printf("Driver %s location: lat=%f, lng=%f, heading=%f, speed=%f", c.DriverID, lat, lng, *heading, *speed)
		} else {
			log.Printf("Driver %s location: lat=%f, lng=%f", c.DriverID, lat, lng)
		}

	default:
		log.Printf("Unknown message type: %s", msg.Type)
	}
}

// Start begins the client's read/write pumps
func (c *Client) Start() {
	go c.writePump()
	go c.readPump()
}

// ServeOrderTrackingWS handles WebSocket requests for order tracking (client side)
func ServeOrderTrackingWS(hub *Hub, w http.ResponseWriter, r *http.Request, orderID, userID, initialStatus string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	client := NewClient(hub, conn, userID, orderID, "")
	hub.Register(client)

	// Send initial CONNECTED message with current order status
	if initialStatus != "" {
		msg := WSMessage{
			Type: "ORDER_STATUS",
			Payload: map[string]interface{}{
				"status":    initialStatus,
				"updatedAt": time.Now().UTC().Format(time.RFC3339),
			},
		}
		if data, err := json.Marshal(msg); err == nil {
			client.send <- data
		}
	}

	client.Start()
}

// ServeDriverWS handles WebSocket requests for driver connections
func ServeDriverWS(hub *Hub, w http.ResponseWriter, r *http.Request, driverID, userID string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	client := NewClient(hub, conn, userID, "", driverID)
	hub.Register(client)
	client.Start()
}
