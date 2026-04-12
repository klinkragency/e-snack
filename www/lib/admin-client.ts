import type { Restaurant } from "@/lib/restaurant-types"

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...init?.headers as Record<string, string>,
  }

  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erreur" }))
    throw new Error(err.message || `Erreur ${res.status}`)
  }
  return res.json()
}

// ─── Restaurants ───

export async function listAdminRestaurants(): Promise<Restaurant[]> {
  const data = await adminFetch<{ restaurants: Restaurant[] }>("/api/admin/restaurants")
  return data.restaurants || []
}

export async function createRestaurant(data: {
  name: string
  slug: string
  description: string
  address: string
  logoUrl?: string
  bannerUrl?: string
}): Promise<Restaurant> {
  return adminFetch<Restaurant>("/api/admin/restaurants", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateRestaurant(id: string, data: {
  name?: string
  description?: string
  address?: string
  isActive?: boolean
  logoUrl?: string
  bannerUrl?: string
  bannerPosition?: string // JSON string
  pickupEnabled?: boolean
  deliveryFee?: number
  freeDeliveryThreshold?: number
  deliveryTimeMin?: number
  deliveryTimeMax?: number
  notificationSoundUrl?: string
}): Promise<Restaurant> {
  return adminFetch<Restaurant>(`/api/admin/restaurants/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteRestaurant(id: string): Promise<void> {
  await adminFetch(`/api/admin/restaurants/${id}`, { method: "DELETE" })
}

export async function reorderRestaurants(ids: string[]): Promise<void> {
  await adminFetch(`/api/admin/restaurants/reorder`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  })
}

export async function updateCustomization(restaurantId: string, data: {
  primaryColor?: string
  secondaryColor?: string
  font?: string
  theme?: string
}): Promise<unknown> {
  return adminFetch(`/api/admin/restaurants/${restaurantId}/customization`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

// ─── Categories ───

export interface AdminCategory {
  id: string
  name: string
  position: number
  isActive: boolean
}

export async function createCategory(restaurantId: string, data: {
  name: string
  position?: number
}): Promise<AdminCategory> {
  return adminFetch<AdminCategory>(`/api/admin/restaurants/${restaurantId}/categories`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateCategory(id: string, data: {
  name?: string
  position?: number
  isActive?: boolean
}): Promise<AdminCategory> {
  return adminFetch<AdminCategory>(`/api/admin/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteCategory(id: string): Promise<void> {
  await adminFetch(`/api/admin/categories/${id}`, { method: "DELETE" })
}

// ─── Products ───

export interface AdminProduct {
  id: string
  name: string
  description: string
  price: number
  imageUrl: string
  isAvailable: boolean
  allergens: string[]
}

export async function createProduct(categoryId: string, data: {
  name: string
  description: string
  price: number
  imageUrl?: string
  allergens?: string[]
}): Promise<AdminProduct> {
  return adminFetch<AdminProduct>(`/api/admin/categories/${categoryId}/products`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateProduct(id: string, data: {
  name?: string
  description?: string
  price?: number
  imageUrl?: string
  isAvailable?: boolean
  allergens?: string[]
  categoryId?: string
  position?: number
}): Promise<AdminProduct> {
  // grpc-gateway needs snake_case for category_id
  const body: Record<string, unknown> = { ...data }
  if (data.categoryId !== undefined) {
    body.category_id = data.categoryId
    delete body.categoryId
  }
  return adminFetch<AdminProduct>(`/api/admin/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

export async function deleteProduct(id: string): Promise<void> {
  await adminFetch(`/api/admin/products/${id}`, { method: "DELETE" })
}

export async function toggleProductAvailability(id: string, isAvailable: boolean): Promise<AdminProduct> {
  return adminFetch<AdminProduct>(`/api/admin/products/${id}/availability`, {
    method: "PATCH",
    body: JSON.stringify({ isAvailable }),
  })
}

// ─── Orders ───

export interface AdminOrderItemOption {
  id: string
  optionName: string
  choiceName: string
  priceModifier: number
}

export interface AdminOrderItem {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  total: number
  notes?: string
  options?: AdminOrderItemOption[]
}

export interface AdminOrder {
  id: string
  orderNumber?: number
  userId: string
  restaurantId: string
  status: string
  orderType: string
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  deliveryAddress: string
  deliveryLat?: number
  deliveryLng?: number
  deliveryInstructions?: string
  customerNotes?: string
  paymentStatus: string
  driverId?: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  driverName?: string
  driverPhone?: string
  items: AdminOrderItem[]
  createdAt: string
  estimatedPrepMinutes?: number
  scheduledPickupTime?: string
}

export async function listRestaurantOrders(restaurantId: string, status?: string, orderType?: string): Promise<AdminOrder[]> {
  const params = new URLSearchParams()
  if (status) params.set("status", status)
  if (orderType) params.set("order_type", orderType)
  const data = await adminFetch<{ orders: AdminOrder[] }>(
    `/api/admin/restaurants/${restaurantId}/orders?${params}`
  )
  // Normalize field names defensively (handles both camelCase from protojson and snake_case)
  return (data.orders || []).map((o) => ({
    ...o,
    orderType: o.orderType ?? (o as unknown as Record<string, string>).order_type ?? "delivery",
    scheduledPickupTime: o.scheduledPickupTime ?? (o as unknown as Record<string, string>).scheduled_pickup_time,
  }))
}

export async function updateOrderStatus(orderId: string, status: string): Promise<AdminOrder> {
  return adminFetch<AdminOrder>(`/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

export async function updateOrderPrepTime(orderId: string, minutes: number): Promise<AdminOrder> {
  return adminFetch<AdminOrder>(`/api/admin/orders/${orderId}/prep-time`, {
    method: "PATCH",
    body: JSON.stringify({ minutes }),
  })
}

// ─── Product Options ───

export interface AdminProductOption {
  id: string
  productId: string
  name: string
  type: string
  isRequired: boolean
  maxSelections: number
  choices: AdminOptionChoice[]
}

export interface AdminOptionChoice {
  id: string
  optionId: string
  name: string
  priceModifier: number
}

export async function createProductOption(productId: string, data: {
  name: string
  type: string
  isRequired: boolean
  maxSelections?: number
  choices: { name: string; priceModifier: number }[]
}): Promise<AdminProductOption> {
  return adminFetch<AdminProductOption>(`/api/admin/products/${productId}/options`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function deleteProductOption(optionId: string): Promise<void> {
  await adminFetch(`/api/admin/options/${optionId}`, { method: "DELETE" })
}

export async function addOptionChoice(optionId: string, data: {
  name: string
  priceModifier: number
}): Promise<AdminOptionChoice> {
  return adminFetch<AdminOptionChoice>(`/api/admin/options/${optionId}/choices`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateProductOption(id: string, data: {
  name: string
  type: string
  isRequired: boolean
  maxSelections?: number
}): Promise<AdminProductOption> {
  return adminFetch<AdminProductOption>(`/api/admin/options/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function updateOptionChoice(id: string, data: {
  name: string
  priceModifier: number
}): Promise<AdminOptionChoice> {
  return adminFetch<AdminOptionChoice>(`/api/admin/choices/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteOptionChoice(id: string): Promise<void> {
  await adminFetch(`/api/admin/choices/${id}`, { method: "DELETE" })
}

// ─── AI Menu ───

export interface AISuggestedProduct {
  name: string
  description: string
  price: number
  allergens: string[]
  options: { name: string; type: string; isRequired: boolean; choices: { name: string; priceModifier: number }[] }[]
}

export interface AISuggestedCategory {
  name: string
  products: AISuggestedProduct[]
}

export async function generateMenuAI(restaurantId: string, cuisineType: string): Promise<AISuggestedCategory[]> {
  const data = await adminFetch<{ categories: AISuggestedCategory[] }>("/api/admin/menu/generate", {
    method: "POST",
    body: JSON.stringify({ restaurantId, cuisineType }),
  })
  return data.categories || []
}

export interface AISuggestion {
  description: string
  suggestedPrice: number
  allergens: string[]
  suggestedOptions: { name: string; type: string; isRequired: boolean; choices: { name: string; priceModifier: number }[] }[]
}

export async function suggestProductDetails(productName: string, cuisineContext?: string): Promise<AISuggestion> {
  return adminFetch<AISuggestion>("/api/admin/menu/suggest", {
    method: "POST",
    body: JSON.stringify({ productName, cuisineContext }),
  })
}

// ─── JSON Import ───

export interface ImportedCategory {
  name: string
  products: {
    name: string
    description: string
    price: number
    allergens: string[]
  }[]
}

export async function importMenuFromJSON(restaurantId: string, jsonInput: string): Promise<ImportedCategory[]> {
  const data = await adminFetch<{ categories: ImportedCategory[] }>("/api/admin/menu/import", {
    method: "POST",
    body: JSON.stringify({ restaurantId, jsonInput }),
  })
  return data.categories || []
}

// ─── Admin Users ───

export interface AdminUser {
  id: string
  email: string
  role: string
  name?: string
  phone?: string
  emailVerified: boolean
  twoFactorEnabled: boolean
  isBanned: boolean
  bannedAt?: string
  banReason?: string
  lastLoginAt?: string
  createdAt: string
}

export async function listAdminUsers(page = 1, pageSize = 20, role?: string): Promise<{ users: AdminUser[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (role) params.set("role", role)
  return adminFetch<{ users: AdminUser[]; total: number }>(`/api/admin/users?${params}`)
}

export async function updateAdminUser(userId: string, data: {
  name?: string
  phone?: string
  role?: string
}): Promise<AdminUser> {
  return adminFetch<AdminUser>(`/api/admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteAdminUser(userId: string): Promise<void> {
  await adminFetch(`/api/admin/users/${userId}`, { method: "DELETE" })
}

export async function banUser(userId: string, reason: string): Promise<void> {
  await adminFetch(`/api/admin/users/${userId}/ban`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}

export async function unbanUser(userId: string): Promise<void> {
  await adminFetch(`/api/admin/users/${userId}/unban`, { method: "POST" })
}

export async function verifyUserEmail(userId: string): Promise<void> {
  await adminFetch(`/api/admin/users/${userId}/verify-email`, { method: "POST" })
}

export async function toggleUser2FA(userId: string, enable: boolean): Promise<void> {
  await adminFetch(`/api/admin/users/${userId}/2fa`, {
    method: "POST",
    body: JSON.stringify({ enable }),
  })
}

// ─── Promo Codes ───

export interface PromoCode {
  id: string
  code: string
  discountType: "percentage" | "fixed_amount" | "free_delivery"
  discountValue: number
  minOrderAmount?: number
  maxDiscountAmount?: number
  maxTotalUses?: number
  maxUsesPerUser: number
  firstOrderOnly: boolean
  startsAt: string
  expiresAt?: string
  isActive: boolean
  currentUses: number
  description?: string
  restaurantIds: string[]
  isPrivate: boolean
  requiresClaim: boolean
  assignedCount: number
  claimedCount: number
  createdAt: string
  updatedAt: string
}

export interface PromoUsage {
  id: string
  promoCodeId: string
  userId: string
  userEmail: string
  orderId?: string
  discountApplied: number
  source: string
  createdAt: string
}

export interface UserPromoCode {
  id: string
  promoCodeId: string
  userId: string
  userEmail: string
  userName?: string
  status: "assigned" | "claimed" | "used" | "revoked" | "expired"
  assignedAt: string
  claimedAt?: string
  usedAt?: string
  usedOrderId?: string
  revokedAt?: string
  revokedReason?: string
  expiresAt?: string
  notes?: string
  promo?: PromoCode
  createdAt: string
}

export interface PromoStats {
  totalAssignments: number
  claimedCount: number
  usedCount: number
  revokedCount: number
  expiredCount: number
  totalDiscountGiven: number
  averageDiscount: number
  uniqueUsers: number
}

export async function listPromos(
  page = 1,
  pageSize = 20,
  search?: string,
  activeOnly = false
): Promise<{ promos: PromoCode[]; total: number }> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  if (search) params.set("search", search)
  if (activeOnly) params.set("activeOnly", "true")
  return adminFetch<{ promos: PromoCode[]; total: number }>(`/api/admin/promos?${params}`)
}

export async function getPromo(id: string): Promise<PromoCode> {
  return adminFetch<PromoCode>(`/api/admin/promos/${id}`)
}

export async function createPromo(data: {
  code: string
  discountType: "percentage" | "fixed_amount" | "free_delivery"
  discountValue: number
  minOrderAmount?: number
  maxDiscountAmount?: number
  maxTotalUses?: number
  maxUsesPerUser?: number
  firstOrderOnly?: boolean
  startsAt?: string
  expiresAt?: string
  description?: string
  restaurantIds?: string[]
  isPrivate?: boolean
  requiresClaim?: boolean
}): Promise<PromoCode> {
  return adminFetch<PromoCode>("/api/admin/promos", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updatePromo(
  id: string,
  data: {
    code?: string
    discountType?: "percentage" | "fixed_amount" | "free_delivery"
    discountValue?: number
    minOrderAmount?: number
    maxDiscountAmount?: number
    maxTotalUses?: number
    maxUsesPerUser?: number
    firstOrderOnly?: boolean
    startsAt?: string
    expiresAt?: string
    isActive?: boolean
    description?: string
    restaurantIds?: string[]
    isPrivate?: boolean
    requiresClaim?: boolean
  }
): Promise<PromoCode> {
  return adminFetch<PromoCode>(`/api/admin/promos/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deletePromo(id: string): Promise<void> {
  await adminFetch(`/api/admin/promos/${id}`, { method: "DELETE" })
}

export async function getPromoUsage(
  id: string,
  page = 1,
  pageSize = 20
): Promise<{ usage: PromoUsage[]; total: number; totalDiscountGiven: number }> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  return adminFetch<{ usage: PromoUsage[]; total: number; totalDiscountGiven: number }>(
    `/api/admin/promos/${id}/usage?${params}`
  )
}

export async function getPromoStats(id: string): Promise<PromoStats> {
  return adminFetch<PromoStats>(`/api/admin/promos/${id}/stats`)
}

export async function assignPromoToUser(
  promoId: string,
  data: {
    userId: string
    expiresAt?: string
    notes?: string
    sendNotification?: boolean
  }
): Promise<UserPromoCode> {
  return adminFetch<UserPromoCode>(`/api/admin/promos/${promoId}/assign`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function assignPromoToUsers(
  promoId: string,
  data: {
    userIds: string[]
    expiresAt?: string
    notes?: string
    sendNotification?: boolean
  }
): Promise<{ successCount: number; failedCount: number; failedUserIds: string[]; failedReasons: string[] }> {
  return adminFetch(`/api/admin/promos/${promoId}/assign-bulk`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function revokeUserPromo(
  promoId: string,
  userId: string,
  reason: string
): Promise<UserPromoCode> {
  return adminFetch<UserPromoCode>(`/api/admin/promos/${promoId}/revoke/${userId}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}

export async function listPromoAssignments(
  promoId: string,
  page = 1,
  pageSize = 20,
  statusFilter?: string
): Promise<{ assignments: UserPromoCode[]; total: number }> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  if (statusFilter) params.set("status", statusFilter)
  return adminFetch<{ assignments: UserPromoCode[]; total: number }>(
    `/api/admin/promos/${promoId}/assignments?${params}`
  )
}

// ─── Formulas ───

import type { Formula } from "@/lib/restaurant-types"

export interface FormulaProductInput {
  productId: string
  groupLabel?: string // empty = fixed product, non-empty = choice group label
}

export async function createFormula(categoryId: string, data: {
  name: string
  description?: string
  basePrice: number
  imageUrl?: string
  products: FormulaProductInput[]
}): Promise<Formula> {
  // Convert to snake_case for grpc-gateway
  const body = {
    categoryId,
    name: data.name,
    description: data.description,
    basePrice: data.basePrice,
    imageUrl: data.imageUrl,
    products: data.products.map((p) => ({
      product_id: p.productId,
      group_label: p.groupLabel || "",
    })),
  }
  return adminFetch<Formula>(`/api/admin/categories/${categoryId}/formulas`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function updateFormula(id: string, data: {
  name?: string
  description?: string
  basePrice?: number
  imageUrl?: string
  products?: FormulaProductInput[]
  categoryId?: string
  position?: number
}): Promise<Formula> {
  // Convert to snake_case for grpc-gateway
  const body: Record<string, unknown> = { ...data }
  if (data.products) {
    body.products = data.products.map((p) => ({
      product_id: p.productId,
      group_label: p.groupLabel || "",
    }))
  }
  if (data.categoryId !== undefined) {
    body.category_id = data.categoryId
    delete body.categoryId
  }
  return adminFetch<Formula>(`/api/admin/formulas/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

export async function deleteFormula(id: string): Promise<void> {
  await adminFetch(`/api/admin/formulas/${id}`, { method: "DELETE" })
}

export async function toggleFormulaAvailability(id: string, isAvailable: boolean): Promise<Formula> {
  return adminFetch<Formula>(`/api/admin/formulas/${id}/availability`, {
    method: "PATCH",
    body: JSON.stringify({ isAvailable }),
  })
}

// ─── Maintenance ───

export interface MaintenanceStatus {
  enabled: boolean
  message?: string
  updatedAt?: string
}

export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  return adminFetch<MaintenanceStatus>("/api/admin/maintenance")
}

export async function setMaintenanceMode(enabled: boolean, message?: string): Promise<MaintenanceStatus> {
  return adminFetch<MaintenanceStatus>("/api/admin/maintenance", {
    method: "PUT",
    body: JSON.stringify({ enabled, message: message || "" }),
  })
}

// ─── Drivers ───

export interface DriverStatus {
  driverId: string
  status: "offline" | "available" | "busy" | "on_delivery"
  currentOrderId?: string
  phone?: string
  lastSeenAt: string
  updatedAt: string
}

export interface DriverLocation {
  driverId: string
  lat: number
  lng: number
  heading?: number
  speed?: number
  accuracy?: number
  updatedAt: string
}

export interface DriverStats {
  deliveriesToday: number
  deliveriesTotal: number
  rating?: number
  earningsToday?: number
  hoursWorkedToday?: number
}

export interface DriverDetails {
  id: string
  name: string
  email: string
  phone?: string
  status?: DriverStatus
  location?: DriverLocation
  stats?: DriverStats
}

export interface DeliveryAssignment {
  id: string
  orderId: string
  driverId: string
  status: "pending" | "accepted" | "rejected" | "expired" | "completed" | "cancelled"
  assignedAt: string
  respondedAt?: string
  expiresAt: string
  completedAt?: string
  notes?: string
}

export async function listDrivers(
  status?: string,
  page = 1,
  pageSize = 20
): Promise<{ drivers: DriverDetails[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (status) params.set("status", status)
  return adminFetch<{ drivers: DriverDetails[]; total: number }>(`/api/admin/drivers?${params}`)
}

export async function listNearbyDrivers(
  lat: number,
  lng: number,
  radiusKm = 5
): Promise<{ drivers: DriverDetails[]; total: number }> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusKm: String(radiusKm),
  })
  return adminFetch<{ drivers: DriverDetails[]; total: number }>(`/api/admin/drivers/nearby?${params}`)
}

export async function unassignDriverFromOrder(
  orderId: string,
  reason?: string
): Promise<DeliveryAssignment> {
  return adminFetch<DeliveryAssignment>(`/api/admin/orders/${orderId}/unassign`, {
    method: "POST",
    body: JSON.stringify({ reason: reason || "" }),
  })
}

export async function assignDriverToOrder(
  orderId: string,
  driverId: string,
  options?: { sendNotification?: boolean; expiryMinutes?: number }
): Promise<DeliveryAssignment> {
  return adminFetch<DeliveryAssignment>(`/api/admin/orders/${orderId}/assign`, {
    method: "POST",
    body: JSON.stringify({
      driverId,
      sendNotification: options?.sendNotification ?? true,
      expiryMinutes: options?.expiryMinutes ?? 10,
    }),
  })
}

// ─── Driver Report ───

export interface DailyDriverSummary {
  date: string
  hoursWorked: number
  deliveriesCompleted: number
}

export interface DriverReport {
  driver: DriverDetails
  days: DailyDriverSummary[]
  totalHours: number
  totalDeliveries: number
}

export async function getDriverReport(
  driverId: string,
  from: string,
  to: string
): Promise<DriverReport> {
  const params = new URLSearchParams({ from, to })
  return adminFetch<DriverReport>(`/api/admin/drivers/${driverId}/report?${params}`)
}

export async function cancelOrder(
  orderId: string,
  reason?: string
): Promise<AdminOrder> {
  return adminFetch<AdminOrder>(`/api/admin/orders/${orderId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason: reason || "" }),
  })
}

export async function markOrderPaid(orderId: string): Promise<{ status: string; orderId: string }> {
  return adminFetch<{ status: string; orderId: string }>(`/api/admin/orders/${orderId}/mark-paid`, {
    method: 'PATCH',
  })
}
