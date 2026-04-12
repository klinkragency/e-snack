/**
 * API client for driver/livreur operations
 */

export interface DeliveryAssignment {
  id: string
  orderId: string
  driverId: string
  status: "pending" | "accepted" | "rejected" | "expired" | "completed"
  assignedAt: string
  respondedAt?: string
  expiresAt: string
  completedAt?: string
  notes?: string
  order?: OrderSummary
}

export interface OrderItemSummary {
  productName: string
  quantity: number
  unitPrice: number
  total: number
  notes?: string
}

export interface OrderSummary {
  id: string
  restaurantName: string
  restaurantAddress: string
  restaurantLat: number
  restaurantLng: number
  deliveryAddress: string
  deliveryLat: number
  deliveryLng: number
  deliveryInstructions?: string
  total: number
  status: string
  customerName?: string
  customerPhone?: string
  itemCount: number
  items: OrderItemSummary[]
  createdAt: string
}

export interface DriverStatus {
  driverId: string
  status: "offline" | "available" | "busy" | "on_delivery"
  currentOrderId?: string
  phone?: string
  lastSeenAt: string
  updatedAt: string
}

async function driverFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erreur" }))
    throw new Error(err.message || `Erreur ${res.status}`)
  }
  return res.json()
}

// ─── Driver Status ───

export async function getMyStatus(): Promise<DriverStatus> {
  return driverFetch<DriverStatus>("/api/driver/status")
}

export async function setAvailability(status: "offline" | "available"): Promise<DriverStatus> {
  return driverFetch<DriverStatus>("/api/driver/availability", {
    method: "POST",
    body: JSON.stringify({ status }),
  })
}

// ─── Deliveries ───

export async function listMyDeliveries(status?: string): Promise<DeliveryAssignment[]> {
  const params = new URLSearchParams()
  if (status) params.set("status", status)
  const url = `/api/driver/deliveries${params.toString() ? `?${params}` : ""}`
  const data = await driverFetch<{ assignments: DeliveryAssignment[] }>(url)
  return data.assignments || []
}

export async function acceptDelivery(assignmentId: string): Promise<DeliveryAssignment> {
  return driverFetch<DeliveryAssignment>(`/api/driver/deliveries/${assignmentId}/accept`, {
    method: "POST",
  })
}

export async function rejectDelivery(assignmentId: string, reason?: string): Promise<DeliveryAssignment> {
  return driverFetch<DeliveryAssignment>(`/api/driver/deliveries/${assignmentId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason: reason || "" }),
  })
}

export async function updateDeliveryStatus(
  assignmentId: string,
  status: "picked_up" | "delivered"
): Promise<DeliveryAssignment> {
  return driverFetch<DeliveryAssignment>(`/api/driver/deliveries/${assignmentId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

// ─── Stats ───

export interface DriverStats {
  deliveriesToday: number
  deliveriesTotal: number
  hoursWorkedToday: number
}

export async function getMyStats(): Promise<DriverStats> {
  return driverFetch<DriverStats>("/api/driver/stats")
}

// ─── Driver Report / History ───

export interface DailyDriverSummary {
  date: string
  hoursWorked: number
  deliveriesCompleted: number
}

export interface DriverReport {
  days: DailyDriverSummary[]
  totalHours: number
  totalDeliveries: number
}

export async function getMyReport(from: string, to: string): Promise<DriverReport> {
  return driverFetch<DriverReport>(`/api/driver/report?from=${from}&to=${to}`)
}

// ─── Location ───

export async function updateLocation(
  lat: number,
  lng: number,
  heading?: number,
  speed?: number,
  accuracy?: number
): Promise<{ success: boolean }> {
  return driverFetch("/api/driver/location", {
    method: "POST",
    body: JSON.stringify({ lat, lng, heading, speed, accuracy }),
  })
}


