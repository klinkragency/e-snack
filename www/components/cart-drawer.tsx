"use client"

import { useMemo } from "react"
import { Drawer } from "vaul"
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react"
import { useAppStore, type CartItem } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { useRouter } from "next/navigation"
import Image from "next/image"

export function CartDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()

  // Batched selector with shallow comparison
  const { cart, updateQuantity, removeFromCart, total, count } = useAppStore(
    useShallow((s) => {
      const totals = s.cart.reduce(
        (acc, item) => ({
          total: acc.total + item.price * item.quantity,
          count: acc.count + item.quantity,
        }),
        { total: 0, count: 0 }
      )
      return {
        cart: s.cart,
        updateQuantity: s.updateQuantity,
        removeFromCart: s.removeFromCart,
        total: totals.total,
        count: totals.count,
      }
    })
  )

  // Group items by category
  const groupedCart = useMemo(() => {
    const groups: Record<string, CartItem[]> = {}
    cart.forEach((item) => {
      const category = item.categoryName || "Autres"
      if (!groups[category]) groups[category] = []
      groups[category].push(item)
    })
    return groups
  }, [cart])

  return (
    <Drawer.Root direction="right" open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-md flex-col bg-background">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-2">
              <ShoppingBag size={20} />
              <Drawer.Title className="text-lg font-semibold">
                Mon panier {count > 0 && `(${count})`}
              </Drawer.Title>
            </div>
            <button onClick={() => onOpenChange(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          {cart.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-muted-foreground">
              <ShoppingBag size={48} strokeWidth={1} />
              <p>Votre panier est vide</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {Object.entries(groupedCart).map(([category, items]) => (
                  <div key={category}>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{category}</h3>
                    <div className="space-y-3">
                      {items.map((item) => (
                        <div key={item.id} className="flex gap-3">
                          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl">
                            <Image src={item.image} alt={item.name} fill className="object-cover" sizes="64px" />
                          </div>
                          <div className="flex flex-1 flex-col justify-between">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  {item.isFormula && (
                                    <span className="rounded bg-foreground/10 px-1 py-0.5 text-[9px] font-bold uppercase">Formule</span>
                                  )}
                                  <p className="font-medium text-sm">{item.name}</p>
                                </div>
                                {item.isFormula && item.formulaProducts ? (
                                  <div className="mt-0.5 space-y-0.5">
                                    {item.formulaProducts.map((fp) => (
                                      <p key={fp.productId} className="text-[11px] text-muted-foreground">
                                        {fp.productName}
                                        {fp.options.length > 0 && (
                                          <span className="text-muted-foreground/60"> — {fp.options.map((o) => o.choiceName).join(", ")}</span>
                                        )}
                                      </p>
                                    ))}
                                  </div>
                                ) : item.options && item.options.length > 0 ? (
                                  <p className="text-[11px] text-muted-foreground">
                                    {item.options.map((o) => o.choiceName).join(", ")}
                                  </p>
                                ) : null}
                              </div>
                              <button onClick={() => removeFromCart(item.id)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  className="flex h-7 w-7 items-center justify-center rounded-full border hover:bg-muted transition-colors"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  className="flex h-7 w-7 items-center justify-center rounded-full border hover:bg-muted transition-colors"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                              <p className="text-sm font-semibold">{(item.price * item.quantity).toFixed(2)} €</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t px-6 py-4 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span className="font-medium">{total.toFixed(2)} €</span>
                </div>
                <button
                  onClick={() => {
                    onOpenChange(false)
                    router.push("/checkout")
                  }}
                  className="w-full rounded-full bg-foreground py-3.5 text-center text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Commander · {total.toFixed(2)} €
                </button>
              </div>
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
