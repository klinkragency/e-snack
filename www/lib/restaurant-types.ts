/** Types aligned with backend proto definitions */

export interface Restaurant {
  id: string
  slug: string
  name: string
  description: string
  logoUrl: string
  bannerUrl: string
  bannerPosition?: string | { x: number; y: number }
  address: string
  lat: number
  lng: number
  openingHours: Record<string, string>
  deliveryRadiusKm: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  customization?: Customization
  // Computed / UI-only fields from the listing endpoint
  category?: string
  deliveryTime?: string    // computed display: "25-35 min"
  deliveryTimeMin?: number // from DB (minutes)
  deliveryTimeMax?: number // from DB (minutes)
  deliveryFee?: number
  freeDeliveryThreshold?: number // 0 = disabled, >0 = free above this subtotal
  rating?: number
  isOpen?: boolean
  isNew?: boolean
  pickupEnabled?: boolean
  notificationSoundUrl?: string
}

export interface Customization {
  id: string
  restaurantId: string
  primaryColor: string
  secondaryColor: string
  font: string
  theme: string
}

export interface Category {
  id: string
  restaurantId: string
  name: string
  position: number
  isActive: boolean
  products: Product[]
  formulas?: Formula[]
}

export interface Formula {
  id: string
  categoryId: string
  name: string
  description: string
  basePrice: number
  imageUrl: string
  isAvailable: boolean
  products: FormulaProductEntry[]
  createdAt?: string
}

export interface FormulaProductEntry {
  productId: string
  product: Product
  position: number
  groupLabel?: string // empty = fixed product, non-empty = choice group (e.g. "Boisson au choix")
}

export interface Product {
  id: string
  categoryId: string
  name: string
  description: string
  price: number
  imageUrl: string
  isAvailable: boolean
  allergens: string[]
  nutritionalInfo: Record<string, unknown>
  options?: ProductOption[]
}

export interface ProductOption {
  id: string
  name: string
  type: "single" | "multiple"
  isRequired: boolean
  maxSelections: number
  choices: OptionChoice[]
}

export interface OptionChoice {
  id: string
  name: string
  priceModifier: number
}

export interface Menu {
  restaurantSlug: string
  categories: Category[]
}

export interface ListRestaurantsResponse {
  restaurants: Restaurant[]
}

export interface GetMenuResponse {
  menu: Menu
}
