"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { UserProfile } from "@/lib/auth-types"

// PostHog is imported lazily to avoid SSR issues
function trackAddToCart(item: { name: string; productId: string; price: number; restaurantSlug: string; categoryName?: string }) {
  try {
    if (typeof window === "undefined") return
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const posthog = require("posthog-js").default
    posthog.capture?.("product_added_to_cart", {
      product_id: item.productId,
      product_name: item.name,
      price: item.price,
      restaurant: item.restaurantSlug,
      category: item.categoryName ?? null,
    })
  } catch {}
}

export interface SelectedOption {
  optionId: string
  optionName: string
  choiceId: string
  choiceName: string
  priceModifier: number
}

export interface FormulaProductSelection {
  productId: string
  productName: string
  options: SelectedOption[]
}

export interface CartItem {
  id: string          // unique cart key (productId or productId-optionHash)
  productId: string
  name: string
  price: number       // base price + sum of option modifiers
  image: string
  quantity: number
  restaurantSlug: string
  categoryName?: string  // for grouping in cart
  options?: SelectedOption[]
  // Formula-specific fields
  isFormula?: boolean
  formulaId?: string
  formulaProducts?: FormulaProductSelection[]
}

interface AppState {
  _hydrated: boolean

  address: string
  setAddress: (address: string) => void

  cart: CartItem[]
  addToCart: (item: Omit<CartItem, "quantity" | "productId"> & { productId?: string }) => void
  removeFromCart: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  cartTotal: () => number
  cartCount: () => number
  cartRestaurantSlug: () => string | null

  user: UserProfile | null
  setUser: (user: UserProfile) => void
  clearUser: () => void

  reset: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      _hydrated: false,

      address: "",
      setAddress: (address) => set({ address }),

      cart: [],
      addToCart: (item) =>
        set((state) => {
          const cartItem = { ...item, productId: item.productId || item.id, quantity: 1 }
          // Clear cart if switching restaurant
          const existingSlug = state.cart[0]?.restaurantSlug
          if (existingSlug && existingSlug !== cartItem.restaurantSlug) {
            trackAddToCart(cartItem)
            return { cart: [cartItem] }
          }
          const existing = state.cart.find((i) => i.id === cartItem.id)
          if (existing) {
            trackAddToCart(cartItem)
            return {
              cart: state.cart.map((i) =>
                i.id === cartItem.id ? { ...i, quantity: i.quantity + 1 } : i
              ),
            }
          }
          trackAddToCart(cartItem)
          return { cart: [...state.cart, cartItem] }
        }),
      removeFromCart: (id) =>
        set((state) => ({ cart: state.cart.filter((i) => i.id !== id) })),
      updateQuantity: (id, quantity) =>
        set((state) => {
          if (quantity <= 0) return { cart: state.cart.filter((i) => i.id !== id) }
          return {
            cart: state.cart.map((i) => (i.id === id ? { ...i, quantity } : i)),
          }
        }),
      clearCart: () => set({ cart: [] }),
      cartTotal: () => get().cart.reduce((sum, i) => sum + i.price * i.quantity, 0),
      cartCount: () => get().cart.reduce((sum, i) => sum + i.quantity, 0),
      cartRestaurantSlug: () => get().cart[0]?.restaurantSlug ?? null,

      user: null,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),

      reset: () => {
        set({ address: "", cart: [], user: null })
        if (typeof window !== "undefined") {
          localStorage.removeItem("esnack-store")
        }
      },
    }),
    {
      name: "esnack-store",
      onRehydrateStorage: () => (state) => {
        if (state) state._hydrated = true
      },
      partialize: (state) => ({
        // Only persist cart — user is fetched from server, address is hydrated from DB
        cart: state.cart,
      }),
    }
  )
)
