import { describe, it, expect, beforeEach } from "vitest"
import { useAppStore } from "@/lib/store"

describe("AppStore", () => {
  beforeEach(() => {
    useAppStore.getState().reset()
  })

  describe("cart", () => {
    const item = {
      id: "p1",
      productId: "p1",
      name: "Burger",
      price: 12.5,
      image: "/img.jpg",
      restaurantSlug: "test-resto",
    }

    it("adds item to empty cart", () => {
      useAppStore.getState().addToCart(item)
      const cart = useAppStore.getState().cart
      expect(cart).toHaveLength(1)
      expect(cart[0].name).toBe("Burger")
      expect(cart[0].quantity).toBe(1)
    })

    it("increments quantity for same item", () => {
      useAppStore.getState().addToCart(item)
      useAppStore.getState().addToCart(item)
      const cart = useAppStore.getState().cart
      expect(cart).toHaveLength(1)
      expect(cart[0].quantity).toBe(2)
    })

    it("adds different items as separate entries", () => {
      useAppStore.getState().addToCart(item)
      useAppStore.getState().addToCart({ ...item, id: "p2", name: "Fries", price: 5 })
      expect(useAppStore.getState().cart).toHaveLength(2)
    })

    it("removes item from cart", () => {
      useAppStore.getState().addToCart(item)
      useAppStore.getState().removeFromCart("p1")
      expect(useAppStore.getState().cart).toHaveLength(0)
    })

    it("updates quantity", () => {
      useAppStore.getState().addToCart(item)
      useAppStore.getState().updateQuantity("p1", 5)
      expect(useAppStore.getState().cart[0].quantity).toBe(5)
    })

    it("removes item when quantity set to 0", () => {
      useAppStore.getState().addToCart(item)
      useAppStore.getState().updateQuantity("p1", 0)
      expect(useAppStore.getState().cart).toHaveLength(0)
    })

    it("calculates cart total correctly", () => {
      useAppStore.getState().addToCart(item)
      useAppStore.getState().addToCart({ ...item, id: "p2", price: 5 })
      useAppStore.getState().updateQuantity("p1", 2)
      // 12.5 * 2 + 5 * 1 = 30
      expect(useAppStore.getState().cartTotal()).toBe(30)
    })

    it("calculates cart count correctly", () => {
      useAppStore.getState().addToCart(item)
      useAppStore.getState().updateQuantity("p1", 3)
      expect(useAppStore.getState().cartCount()).toBe(3)
    })

    it("returns restaurant slug from first item", () => {
      useAppStore.getState().addToCart(item)
      expect(useAppStore.getState().cartRestaurantSlug()).toBe("test-resto")
    })

    it("returns null slug for empty cart", () => {
      expect(useAppStore.getState().cartRestaurantSlug()).toBeNull()
    })

    it("clears cart", () => {
      useAppStore.getState().addToCart(item)
      useAppStore.getState().clearCart()
      expect(useAppStore.getState().cart).toHaveLength(0)
    })

    it("handles items with options (different cart IDs)", () => {
      useAppStore.getState().addToCart(item)
      useAppStore.getState().addToCart({
        ...item,
        id: "p1-cheese",
        options: [{ optionId: "o1", optionName: "Extra", choiceId: "c1", choiceName: "Cheese", priceModifier: 1.5 }],
      })
      expect(useAppStore.getState().cart).toHaveLength(2)
    })
  })

  describe("address", () => {
    it("sets address", () => {
      useAppStore.getState().setAddress("12 Avenue Monaco")
      expect(useAppStore.getState().address).toBe("12 Avenue Monaco")
    })
  })

  describe("user", () => {
    it("sets and clears user", () => {
      const user = { id: "u1", email: "a@b.com", phone: "", name: "Test", role: "user", emailVerified: true, createdAt: "" }
      useAppStore.getState().setUser(user)
      expect(useAppStore.getState().user?.email).toBe("a@b.com")

      useAppStore.getState().clearUser()
      expect(useAppStore.getState().user).toBeNull()
    })
  })

  describe("reset", () => {
    it("resets all state", () => {
      useAppStore.getState().setAddress("test")
      useAppStore.getState().addToCart({ id: "p1", productId: "p1", name: "X", price: 1, image: "", restaurantSlug: "s" })
      useAppStore.getState().reset()

      expect(useAppStore.getState().address).toBe("")
      expect(useAppStore.getState().cart).toHaveLength(0)
      expect(useAppStore.getState().user).toBeNull()
    })
  })
})
