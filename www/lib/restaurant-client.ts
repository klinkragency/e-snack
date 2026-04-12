import type { Restaurant, Menu } from "@/lib/restaurant-types"
import { restaurants as mockRestaurants, type Restaurant as MockRestaurant, type Product as MockProduct } from "@/lib/mock-data"

/** Convert backend restaurant to the shape components expect */
function normalizeRestaurant(r: Restaurant): Restaurant {
  const timeMin = r.deliveryTimeMin ?? 25
  const timeMax = r.deliveryTimeMax ?? 35
  return {
    ...r,
    // Ensure UI fields have sensible defaults
    category: r.category ?? "",
    deliveryTimeMin: timeMin,
    deliveryTimeMax: timeMax,
    deliveryTime: r.deliveryTime ?? `${timeMin}-${timeMax} min`,
    deliveryFee: r.deliveryFee ?? 2.9,
    freeDeliveryThreshold: r.freeDeliveryThreshold ?? 0,
    rating: r.rating ?? 0,
    isOpen: r.isOpen ?? r.isActive,
    isNew: r.isNew ?? false,
  }
}

/** Map mock data to Restaurant type for fallback */
function mockToRestaurant(m: MockRestaurant): Restaurant {
  return {
    id: m.id,
    slug: m.slug,
    name: m.name,
    description: m.description,
    logoUrl: m.logo,
    bannerUrl: m.image,
    address: "",
    lat: 0,
    lng: 0,
    openingHours: {},
    deliveryRadiusKm: 5,
    isActive: m.isOpen,
    createdAt: "",
    updatedAt: "",
    category: m.category,
    deliveryTime: m.deliveryTime,
    deliveryFee: m.deliveryFee,
    rating: m.rating,
    isOpen: m.isOpen,
    isNew: m.isNew,
  }
}

function mockToMenu(m: MockRestaurant): Menu {
  const categoryNames = [...new Set(m.products.map((p) => p.category))]
  return {
    restaurantSlug: m.slug,
    categories: categoryNames.map((name, i) => ({
      id: `cat-${i}`,
      restaurantId: m.id,
      name,
      position: i,
      isActive: true,
      products: m.products
        .filter((p) => p.category === name)
        .map((p) => ({
          id: p.id,
          categoryId: `cat-${i}`,
          name: p.name,
          description: p.description,
          price: p.price,
          imageUrl: p.image,
          isAvailable: true,
          allergens: [],
          nutritionalInfo: {},
        })),
    })),
  }
}

export async function listRestaurants(): Promise<Restaurant[]> {
  try {
    const res = await fetch("/api/restaurants")
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return (data.restaurants || []).map(normalizeRestaurant)
  } catch {
    // Fallback to mock data in development
    console.warn("[restaurant-client] Backend unavailable, using mock data")
    return mockRestaurants.map(mockToRestaurant)
  }
}

export async function getRestaurant(slug: string): Promise<Restaurant | null> {
  try {
    const res = await fetch(`/api/restaurants/${slug}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return normalizeRestaurant(data.restaurant || data)
  } catch {
    const mock = mockRestaurants.find((r) => r.slug === slug)
    if (!mock) return null
    return mockToRestaurant(mock)
  }
}

export async function getMenu(slug: string): Promise<Menu | null> {
  try {
    const res = await fetch(`/api/restaurants/${slug}/menu`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.menu || data
  } catch {
    const mock = mockRestaurants.find((r) => r.slug === slug)
    if (!mock) return null
    return mockToMenu(mock)
  }
}
