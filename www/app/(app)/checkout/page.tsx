"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Clock, Loader2, Tag, X, ChevronDown, Phone, Plus, Check, ShoppingBag } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import { useShallow } from "zustand/react/shallow"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/lib/store"
import { getRestaurant } from "@/lib/restaurant-client"
import type { Restaurant } from "@/lib/restaurant-types"
import { createOrder, createPayment } from "@/lib/payment-client"
import { listAddresses, createAddress, updateProfile } from "@/lib/account-client"
import type { DeliveryAddress } from "@/lib/auth-types"
import posthog from "posthog-js"

type OrderMode = "delivery" | "pickup"
type PaymentType = "online" | "on_site"

export default function CheckoutPage() {
  const router = useRouter()
  const { cart, address, setAddress, cartTotal, clearCart, user, setUser } = useAppStore(
    useShallow((s) => ({
      cart: s.cart, address: s.address, setAddress: s.setAddress,
      cartTotal: s.cartTotal, clearCart: s.clearCart, user: s.user, setUser: s.setUser,
    }))
  )
  const total = cartTotal()
  const restaurantSlug = cart[0]?.restaurantSlug

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [promoCode, setPromoCode] = useState("")
  const [promoApplied, setPromoApplied] = useState<{ code: string; discount: number; type: "percent" | "fixed" } | null>(null)
  const [promoLoading, setPromoLoading] = useState(false)

  // Order mode
  const [orderMode, setOrderMode] = useState<OrderMode>("delivery")
  const [paymentType, setPaymentType] = useState<PaymentType>("online")
  const [mounted, setMounted] = useState(false)
  const [pickupTime, setPickupTime] = useState("")
  const [deliveryScheduledTime, setDeliveryScheduledTime] = useState("")

  // Address management
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>([])
  const [showAddressDropdown, setShowAddressDropdown] = useState(false)
  const [showNewAddressForm, setShowNewAddressForm] = useState(false)
  const [newAddressLabel, setNewAddressLabel] = useState("")
  const [newAddressValue, setNewAddressValue] = useState("")
  const [savingAddress, setSavingAddress] = useState(false)

  // Customer notes
  const [customerNotes, setCustomerNotes] = useState("")

  // Phone management
  const [phoneInput, setPhoneInput] = useState("")
  const [savingPhone, setSavingPhone] = useState(false)
  const [userLoaded, setUserLoaded] = useState(false)
  const hasPhone = !!(user?.phone && user.phone.trim().length > 0)

  const isPickup = orderMode === "pickup"
  const pickupEnabled = !!restaurant?.pickupEnabled

  // If restaurant doesn't support pickup, force delivery
  useEffect(() => {
    if (!pickupEnabled && orderMode === "pickup") {
      setOrderMode("delivery")
    }
  }, [pickupEnabled, orderMode])

  useEffect(() => { setMounted(true) }, [])

  // Parallel fetch: restaurant, addresses, and profile
  useEffect(() => {
    const fetchData = async () => {
      const [restaurantData, addressesData, profileData] = await Promise.all([
        restaurantSlug ? getRestaurant(restaurantSlug) : Promise.resolve(null),
        listAddresses().catch(() => [] as DeliveryAddress[]),
        fetch("/api/auth/profile")
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
      ])

      if (restaurantData) setRestaurant(restaurantData)
      setSavedAddresses(addressesData)
      if (profileData) setUser(profileData)
      setUserLoaded(true)
    }

    fetchData()
  }, [restaurantSlug, setUser])

  const threshold = restaurant?.freeDeliveryThreshold ?? 0
  const rawDeliveryFee = isPickup ? 0 : (restaurant?.deliveryFee ?? 2.90)
  const freeDeliveryActive = !isPickup && threshold > 0 && total >= threshold
  const deliveryFee = freeDeliveryActive ? 0 : rawDeliveryFee
  const amountUntilFreeDelivery = !isPickup && threshold > 0 && total < threshold ? threshold - total : 0
  const deliveryTime = restaurant?.deliveryTime ?? "25-35 min"
  const discount = promoApplied
    ? promoApplied.type === "percent"
      ? total * (promoApplied.discount / 100)
      : promoApplied.discount
    : 0
  const grandTotal = Math.max(0, total - discount) + deliveryFee

  const handleSelectAddress = (addr: DeliveryAddress) => {
    setAddress(addr.address)
    setShowAddressDropdown(false)
  }

  const handleSaveNewAddress = async () => {
    if (!newAddressValue.trim()) return
    setSavingAddress(true)
    try {
      const created = await createAddress({
        label: newAddressLabel.trim() || "Nouvelle adresse",
        address: newAddressValue.trim(),
        isDefault: savedAddresses.length === 0,
      })
      setSavedAddresses((prev) => [...prev, created])
      setAddress(created.address)
      setShowNewAddressForm(false)
      setNewAddressLabel("")
      setNewAddressValue("")
      toast.success("Adresse enregistrée")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setSavingAddress(false)
    }
  }

  const handleSavePhone = async () => {
    const cleaned = phoneInput.trim().replace(/\s/g, "")
    if (!cleaned || cleaned.length < 8) {
      toast.error("Numéro de téléphone invalide")
      return
    }
    setSavingPhone(true)
    try {
      const updatedUser = await updateProfile({ phone: cleaned })
      setUser(updatedUser)
      toast.success("Téléphone enregistré")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setSavingPhone(false)
    }
  }

  useEffect(() => {
    if (!showAddressDropdown) return
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setShowAddressDropdown(false) }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [showAddressDropdown])

  // Delivery mode requires address + phone; pickup only requires phone
  const canProceed = isPickup
    ? userLoaded && hasPhone
    : userLoaded && !!address && hasPhone

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return
    setPromoLoading(true)
    try {
      const res = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promoCode.trim(),
          restaurantId: restaurant?.id,
          subtotal: total,
          deliveryFee: deliveryFee,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Code invalide" }))
        toast.error(err.message || "Code promo invalide")
        return
      }
      const data = await res.json()
      if (!data.valid) {
        toast.error(data.message || "Code promo invalide")
        return
      }
      const discountType = data.discountType === "percentage" ? "percent" : "fixed"
      setPromoApplied({
        code: promoCode.trim().toUpperCase(),
        discount: data.discountValue || 0,
        type: discountType,
      })
      toast.success("Code promo appliqué !")
    } catch {
      toast.error("Erreur lors de la validation du code")
    } finally {
      setPromoLoading(false)
    }
  }

  const handleProceedToPayment = async () => {
    if (!restaurant || isCreatingOrder) return

    // For pickup with on_site payment, no Mollie step needed
    const isOnSitePickup = isPickup && paymentType === "on_site"

    setIsCreatingOrder(true)
    try {
      const orderItems = cart.map((item) => {
        if (item.isFormula && item.formulaId) {
          return {
            quantity: item.quantity,
            itemType: "formula" as const,
            formulaId: item.formulaId,
            formulaSelections: item.formulaProducts?.map((fp) => ({
              productId: fp.productId,
              optionChoiceIds: fp.options.map((o) => o.choiceId),
            })) ?? [],
          }
        }
        return {
          productId: item.productId,
          quantity: item.quantity,
          itemType: "product" as const,
          options: item.options?.map((o) => ({ optionChoiceId: o.choiceId })),
        }
      })

      // Build scheduled time (pickup or delivery)
      let scheduledPickupTime: string | undefined
      if (isPickup && pickupTime) {
        const [h, m] = pickupTime.split(":").map(Number)
        const d = new Date()
        d.setHours(h, m, 0, 0)
        scheduledPickupTime = d.toISOString()
      } else if (!isPickup && deliveryScheduledTime) {
        const [h, m] = deliveryScheduledTime.split(":").map(Number)
        const d = new Date()
        d.setHours(h, m, 0, 0)
        scheduledPickupTime = d.toISOString()
      }

      const order = await createOrder({
        restaurantId: restaurant.id,
        orderType: isPickup ? "pickup" : "delivery",
        deliveryAddress: isPickup ? undefined : address,
        promoCode: promoApplied?.code,
        customerNotes: customerNotes.trim() || undefined,
        paymentType: isPickup ? paymentType : "online",
        scheduledPickupTime,
        items: orderItems,
      })

      // Track order placed with item details
      posthog.capture("order_placed", {
        order_id: order.id,
        restaurant: restaurantSlug,
        order_type: isPickup ? "pickup" : "delivery",
        total: cartTotal(),
        items: cart.map((i) => ({ name: i.name, product_id: i.productId, quantity: i.quantity, price: i.price })),
        item_count: cart.reduce((s, i) => s + i.quantity, 0),
      })

      if (isOnSitePickup) {
        // No Mollie — redirect directly to confirmation
        clearCart()
        router.push(`/confirmation/${order.id}?payment=on_site`)
      } else {
        // Online payment via Mollie — redirect first, cart clears on return
        const payment = await createPayment(order.id)
        clearCart()
        window.location.href = payment.checkoutUrl
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la commande"
      // Surface backend messages directly so they're actionable
      toast.error(msg, { duration: 6000 })
      setIsCreatingOrder(false)
    }
  }

  if (mounted && cart.length === 0 && !isCreatingOrder) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted-foreground">Votre panier est vide</p>
        <Link href="/restaurants" className="text-sm font-medium underline">
          Retour aux restaurants
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href={`/restaurant/${restaurantSlug}`}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold">Récapitulatif</h1>
      </div>

      {/* ── Mode selector ── */}
      <div className="mb-6 flex rounded-2xl border overflow-hidden">
        <button
          onClick={() => setOrderMode("delivery")}
          className={cn(
            "flex flex-1 flex-col items-center gap-1.5 px-4 py-3.5 text-sm font-semibold transition-all",
            !isPickup
              ? "bg-foreground text-background"
              : "bg-background text-muted-foreground hover:bg-muted"
          )}
        >
          <MapPin size={18} />
          <span>Livraison</span>
          {!isPickup && <span className="text-[10px] font-normal opacity-75">{restaurant?.deliveryTime ?? "25-35 min"}</span>}
        </button>
        <div className="w-px bg-border shrink-0" />
        <button
          onClick={() => pickupEnabled && setOrderMode("pickup")}
          disabled={!pickupEnabled}
          title={!pickupEnabled ? "Click & Collect non disponible" : undefined}
          className={cn(
            "flex flex-1 flex-col items-center gap-1.5 px-4 py-3.5 text-sm font-semibold transition-all",
            isPickup
              ? "bg-foreground text-background"
              : "bg-background text-muted-foreground hover:bg-muted",
            !pickupEnabled && "opacity-35 cursor-not-allowed hover:bg-background"
          )}
        >
          <ShoppingBag size={18} />
          <span>Click &amp; Collect</span>
          {isPickup && <span className="text-[10px] font-normal opacity-75">Gratuit</span>}
          {!pickupEnabled && <span className="text-[10px] font-normal opacity-75">Indisponible</span>}
        </button>
      </div>

      {/* ── DELIVERY branch ── */}
      {!isPickup && (
        <>
          {/* Address */}
          <div className="relative">
            <button
              onClick={() => setShowAddressDropdown(!showAddressDropdown)}
              aria-expanded={showAddressDropdown}
              aria-haspopup="listbox"
              className="w-full flex items-start gap-3 rounded-2xl border p-4 hover:bg-muted/50 transition-colors text-left"
            >
              <MapPin size={18} className="mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Adresse de livraison</p>
                <p className="text-sm text-muted-foreground truncate">
                  {address || "Sélectionner une adresse"}
                </p>
              </div>
              <ChevronDown size={16} className={cn("text-muted-foreground transition-transform", showAddressDropdown && "rotate-180")} />
            </button>

            {showAddressDropdown && (
              <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border bg-background shadow-lg z-50">
                <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                  {savedAddresses.length === 0 && !showNewAddressForm && (
                    <p className="text-sm text-muted-foreground px-3 py-2">Aucune adresse enregistrée</p>
                  )}
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      onClick={() => handleSelectAddress(addr)}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{addr.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{addr.address}</p>
                      </div>
                      {address === addr.address && <Check size={16} className="text-green-600 flex-shrink-0" />}
                    </button>
                  ))}

                  {showNewAddressForm ? (
                    <div className="p-3 border-t mt-1 space-y-3">
                      <input
                        type="text"
                        value={newAddressLabel}
                        onChange={(e) => setNewAddressLabel(e.target.value)}
                        placeholder="Label (ex: Maison)"
                        className="w-full rounded-xl border bg-background py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                      />
                      <input
                        type="text"
                        value={newAddressValue}
                        onChange={(e) => setNewAddressValue(e.target.value)}
                        placeholder="Adresse complète"
                        className="w-full rounded-xl border bg-background py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowNewAddressForm(false)}
                          className="flex-1 rounded-xl border py-2 text-sm font-medium hover:bg-muted transition-colors"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={handleSaveNewAddress}
                          disabled={savingAddress || !newAddressValue.trim()}
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-foreground text-background py-2 text-sm font-medium disabled:opacity-50"
                        >
                          {savingAddress ? <Loader2 size={14} className="animate-spin" /> : "Enregistrer"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewAddressForm(true)}
                      className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-muted transition-colors text-sm font-medium border-t mt-1 pt-3"
                    >
                      <Plus size={14} /> Ajouter une adresse
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Delivery time */}
          <div className="mt-3 flex items-start gap-3 rounded-2xl border p-4">
            <Clock size={18} className="mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Créneau de livraison</p>
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => setDeliveryScheduledTime("")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                    !deliveryScheduledTime ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  Dès que possible
                </button>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={deliveryScheduledTime}
                    onChange={(e) => setDeliveryScheduledTime(e.target.value)}
                    className="rounded-xl border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                  {deliveryScheduledTime && (
                    <span className="text-xs text-muted-foreground">planifiée</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PICKUP branch ── */}
      {isPickup && (
        <div className="space-y-3">
          {/* Restaurant address */}
          <div className="flex items-start gap-3 rounded-2xl border p-4 bg-muted/40">
            <ShoppingBag size={18} className="mt-0.5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Retrait au restaurant</p>
              <p className="text-sm text-muted-foreground">{restaurant?.address || "Adresse du restaurant"}</p>
            </div>
          </div>

          {/* Pickup time */}
          <div className="flex items-start gap-3 rounded-2xl border p-4">
            <Clock size={18} className="mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium mb-1.5">Heure de retrait souhaitée</p>
              <input
                type="time"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
              />
              {!pickupTime && (
                <p className="text-xs text-muted-foreground mt-1">Optionnel — dès que possible si vide</p>
              )}
            </div>
          </div>

          {/* Payment type */}
          <div className="rounded-2xl border p-4 space-y-2">
            <p className="text-sm font-medium mb-2">Mode de paiement</p>
            <label className={cn(
              "flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors",
              paymentType === "online" ? "border-foreground bg-foreground/5" : "hover:bg-muted"
            )}>
              <input
                type="radio"
                name="paymentType"
                value="online"
                checked={paymentType === "online"}
                onChange={() => setPaymentType("online")}
                className="accent-foreground"
              />
              <div>
                <p className="text-sm font-medium">Payer en ligne</p>
                <p className="text-xs text-muted-foreground">Carte bancaire sécurisée via Mollie</p>
              </div>
            </label>
            <label className={cn(
              "flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors",
              paymentType === "on_site" ? "border-foreground bg-foreground/5" : "hover:bg-muted"
            )}>
              <input
                type="radio"
                name="paymentType"
                value="on_site"
                checked={paymentType === "on_site"}
                onChange={() => setPaymentType("on_site")}
                className="accent-foreground"
              />
              <div>
                <p className="text-sm font-medium">Payer sur place</p>
                <p className="text-xs text-muted-foreground">Espèces ou carte à la caisse</p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* ── Phone (both modes) ── */}
      {userLoaded && !hasPhone && (
        <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <Phone size={16} className="text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <p className="text-sm font-medium text-orange-700 dark:text-orange-400">Téléphone requis</p>
          </div>
          <p className="text-xs text-orange-600 dark:text-orange-500 mb-3">
            {isPickup ? "Le restaurant doit pouvoir vous prévenir quand votre commande est prête" : "Votre livreur doit pouvoir vous contacter"}
          </p>
          <div className="flex gap-2">
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="+377 99 99 99 99"
              className="flex-1 min-w-0 rounded-xl border border-orange-200 dark:border-orange-700 bg-white dark:bg-orange-900/30 py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-300"
            />
            <button
              onClick={handleSavePhone}
              disabled={savingPhone || !phoneInput.trim()}
              className="shrink-0 rounded-xl bg-orange-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {savingPhone ? <Loader2 size={14} className="animate-spin" /> : "OK"}
            </button>
          </div>
        </div>
      )}

      {/* ── Items ── */}
      <div className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {restaurant?.name ?? "Restaurant"}
        </h2>
        {cart.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl">
              <Image src={item.image} alt={item.name} fill className="object-cover" sizes="48px" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                {item.isFormula && (
                  <span className="rounded bg-foreground/10 px-1 py-0.5 text-[9px] font-bold uppercase">Formule</span>
                )}
                <p className="text-sm font-medium">{item.quantity}x {item.name}</p>
              </div>
              {item.isFormula && item.formulaProducts && (
                <p className="text-xs text-muted-foreground">
                  {item.formulaProducts.map((fp) => fp.productName).join(" + ")}
                </p>
              )}
            </div>
            <p className="text-sm font-medium">{(item.price * item.quantity).toFixed(2)} €</p>
          </div>
        ))}
      </div>

      {/* ── Customer Notes ── */}
      <div className="mt-6">
        <label className="block text-sm font-medium mb-2">Note pour le restaurant (optionnel)</label>
        <textarea
          value={customerNotes}
          onChange={(e) => setCustomerNotes(e.target.value)}
          placeholder="Allergies, instructions spéciales..."
          rows={2}
          className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
        />
      </div>

      {/* ── Promo Code ── */}
      <div className="mt-6">
        {promoApplied ? (
          <div className="flex items-center justify-between rounded-2xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 p-4">
            <div className="flex items-center gap-2">
              <Tag size={16} className="text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">{promoApplied.code}</span>
              <span className="text-xs text-green-600 dark:text-green-500">
                {promoApplied.type === "percent" ? `-${promoApplied.discount}%` : `-${promoApplied.discount.toFixed(2)} €`}
              </span>
            </div>
            <button onClick={() => setPromoApplied(null)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                placeholder="Code promo"
                className="w-full rounded-full border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
            <button
              onClick={handleApplyPromo}
              disabled={promoLoading || !promoCode.trim()}
              className="rounded-full border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              {promoLoading ? <Loader2 size={14} className="animate-spin" /> : "Appliquer"}
            </button>
          </div>
        )}
      </div>

      {/* ── Free delivery progress banner ── */}
      {!isPickup && threshold > 0 && (
        <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${freeDeliveryActive ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
          {freeDeliveryActive ? (
            <span className="font-medium">🎉 Livraison gratuite appliquée !</span>
          ) : (
            <span>Plus que <strong>{amountUntilFreeDelivery.toFixed(2)} €</strong> pour la livraison gratuite</span>
          )}
        </div>
      )}

      {/* ── Totals ── */}
      <div className="mt-8 space-y-2 border-t pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Sous-total</span>
          <span>{total.toFixed(2)} €</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
            <span>Réduction ({promoApplied?.code})</span>
            <span>-{discount.toFixed(2)} €</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Frais de livraison</span>
          <span>
            {isPickup || freeDeliveryActive
              ? <span className="text-green-600 dark:text-green-400 font-medium">Gratuit</span>
              : `${deliveryFee.toFixed(2)} €`}
          </span>
        </div>
        <div className="flex justify-between text-base font-bold pt-2 border-t">
          <span>Total</span>
          <span>{grandTotal.toFixed(2)} €</span>
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="mt-8">
        {!canProceed && userLoaded && (
          <p className="text-sm text-center text-muted-foreground mb-3">
            {!isPickup && !address && !hasPhone
              ? "Renseignez votre adresse et téléphone pour continuer"
              : !isPickup && !address
                ? "Sélectionnez une adresse de livraison"
                : "Ajoutez votre numéro de téléphone"}
          </p>
        )}
        <button
          onClick={handleProceedToPayment}
          disabled={isCreatingOrder || !canProceed}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          {isCreatingOrder ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isPickup && paymentType === "on_site" ? (
            <>Confirmer la commande · {grandTotal.toFixed(2)} €</>
          ) : (
            <>Procéder au paiement · {grandTotal.toFixed(2)} €</>
          )}
        </button>
      </div>

      {showAddressDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowAddressDropdown(false)} />
      )}
    </div>
  )
}
