export interface UserProfile {
  id: string
  email: string
  phone: string
  name: string
  role: string
  emailVerified: boolean
  twoFactorEnabled?: boolean
  createdAt: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: UserProfile
  requires2fa?: boolean
  twoFaToken?: string
}


export interface DeliveryAddress {
  id: string
  userId: string
  label: string
  address: string
  lat: number
  lng: number
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface OrderSummary {
  id: string
  restaurantId: string
  status: string
  total: number
  orderType: string
  items: OrderItemSummary[]
  createdAt: string
}

export interface OrderItemSummary {
  productName: string
  quantity: number
  total: number
}
