"use client"

import { useState, useRef } from "react"
import { X, Printer, User, ChefHat, Check, Clock, MapPin, Phone, Mail, AlertTriangle } from "lucide-react"
import type { AdminOrder } from "@/lib/admin-client"

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(euros: number) {
  return euros.toFixed(2).replace(".", ",") + " €"
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function orderRef(order: AdminOrder) {
  if (order.orderNumber) return String(order.orderNumber).padStart(4, "0")
  return order.id.slice(-8).toUpperCase()
}

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #0a0a0a; }
  @page { margin: 0; size: 80mm auto; }
`

// ─── Client Ticket ─────────────────────────────────────────────────────────────

function ClientTicket({ order, restaurantName }: { order: AdminOrder; restaurantName: string }) {
  const ref = orderRef(order)
  const isDelivery = order.orderType === "delivery"
  const isPickup   = order.orderType === "pickup"
  const typeMeta = isDelivery
    ? { label: "Livraison", emoji: "🛵", accent: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" }
    : isPickup
    ? { label: "À emporter", emoji: "🏪", accent: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" }
    : { label: "Sur place",  emoji: "🍽", accent: "#059669", bg: "#f0fdf4", border: "#bbf7d0" }

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#fff", color: "#0a0a0a", width: 320, position: "relative" }}>

      {/* ── Gradient header ── */}
      <div style={{
        background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)",
        padding: "22px 20px 18px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* decorative circles */}
        <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", bottom: -30, left: -15, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />
        <p style={{ fontSize: 10, letterSpacing: "0.35em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: 6, position: "relative" }}>
          e-Snack
        </p>
        <p style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "0.03em", textTransform: "uppercase", lineHeight: 1.1, position: "relative" }}>
          {restaurantName}
        </p>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 6, position: "relative" }}>{fmtDate(order.createdAt)}</p>
      </div>

      {/* ── Torn edge SVG ── */}
      <svg viewBox="0 0 320 16" style={{ display: "block", width: "100%", height: 16, background: "#0a0a0a", marginTop: -1 }}>
        <path d="M0,0 Q20,16 40,8 Q60,0 80,10 Q100,20 120,6 Q140,-4 160,8 Q180,20 200,4 Q220,-8 240,8 Q260,24 280,6 Q300,-8 320,10 L320,0 Z" fill="#fff" />
      </svg>

      {/* ── Order number ── */}
      <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#bbb", marginBottom: 3 }}>Commande</p>
          <p style={{ fontSize: 28, fontWeight: 900, letterSpacing: "0.04em", lineHeight: 1 }}>#{ref}</p>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: typeMeta.bg, color: typeMeta.accent,
          border: `1.5px solid ${typeMeta.border}`,
          borderRadius: 8, padding: "6px 12px",
        }}>
          <span style={{ fontSize: 15 }}>{typeMeta.emoji}</span>
          <span style={{ fontSize: 11, fontWeight: 800 }}>{typeMeta.label}</span>
        </div>
      </div>

      {/* ── Customer ── */}
      {(order.customerName || order.customerPhone || order.customerEmail) && (
        <div style={{ padding: "10px 20px", borderBottom: "1px solid #f0f0f0" }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#bbb", marginBottom: 8 }}>Client</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {order.customerName && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}>
                <User size={11} color="#888" style={{ flexShrink: 0 }} />
                {order.customerName}
              </div>
            )}
            {order.customerPhone && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#555" }}>
                <Phone size={10} color="#aaa" style={{ flexShrink: 0 }} />
                {order.customerPhone}
              </div>
            )}
            {order.customerEmail && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#888" }}>
                <Mail size={10} color="#aaa" style={{ flexShrink: 0 }} />
                {order.customerEmail}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Items ── */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid #f0f0f0" }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#bbb", marginBottom: 10 }}>Détail de la commande</p>
        {order.items.map((item, i) => (
          <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < order.items.length - 1 ? "1px dashed #ececec" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, paddingRight: 12 }}>
                <span style={{
                  minWidth: 22, height: 22, borderRadius: 5,
                  background: "#0a0a0a", color: "#fff",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 900, flexShrink: 0,
                }}>
                  {item.quantity}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{item.productName}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(item.total)}</span>
            </div>
            {item.options?.map((opt, j) => (
              <div key={j} style={{ fontSize: 10, color: "#777", paddingLeft: 30, marginTop: 2, lineHeight: 1.4 }}>
                · {opt.optionName}: <b style={{ color: "#444" }}>{opt.choiceName}</b>
                {opt.priceModifier > 0 && <span style={{ color: "#aaa" }}> +{fmt(opt.priceModifier)}</span>}
              </div>
            ))}
            {item.notes && (
              <div style={{ fontSize: 10, color: "#b45309", fontStyle: "italic", paddingLeft: 30, marginTop: 2 }}>
                ✎ {item.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Totals ── */}
      <div style={{ padding: "12px 20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11, color: "#666", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Sous-total</span><span>{fmt(order.subtotal)}</span>
          </div>
          {order.deliveryFee > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Frais de livraison</span><span>{fmt(order.deliveryFee)}</span>
            </div>
          )}
          {order.discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a", fontWeight: 600 }}>
              <span>Réduction</span><span>−{fmt(order.discount)}</span>
            </div>
          )}
        </div>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "#0a0a0a", color: "#fff",
          borderRadius: 10, padding: "12px 16px",
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Total</span>
          <span style={{ fontSize: 22, fontWeight: 900 }}>{fmt(order.total)}</span>
        </div>
      </div>

      {/* ── Payment ── */}
      <div style={{ padding: "0 20px 12px" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 20,
          background: order.paymentStatus === "paid" ? "#f0fdf4" : order.paymentStatus === "on_site" ? "#eff6ff" : "#fffbeb",
          border: `1px solid ${order.paymentStatus === "paid" ? "#bbf7d0" : order.paymentStatus === "on_site" ? "#bfdbfe" : "#fde68a"}`,
        }}>
          {order.paymentStatus === "paid"
            ? <><Check size={10} color="#16a34a" /><span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>Paiement confirmé en ligne</span></>
            : order.paymentStatus === "on_site"
            ? <span style={{ fontSize: 11, fontWeight: 600, color: "#2563eb" }}>💳 Paiement sur place</span>
            : <><Clock size={10} color="#d97706" /><span style={{ fontSize: 11, fontWeight: 600, color: "#d97706" }}>Paiement en attente</span></>
          }
        </div>
      </div>

      {/* ── Delivery address ── */}
      {isDelivery && order.deliveryAddress && (
        <div style={{ margin: "0 20px 12px", padding: "10px 12px", background: "#f8faff", border: "1px solid #e0eaff", borderRadius: 8 }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#93c5fd", marginBottom: 5 }}>Adresse de livraison</p>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <MapPin size={12} color="#3b82f6" style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.5, color: "#1e3a8a" }}>{order.deliveryAddress}</p>
          </div>
          {order.deliveryInstructions && (
            <p style={{ fontSize: 10, color: "#64748b", fontStyle: "italic", marginTop: 4, paddingLeft: 18 }}>
              "{order.deliveryInstructions}"
            </p>
          )}
        </div>
      )}

      {/* ── Customer notes ── */}
      {order.customerNotes && (
        <div style={{ margin: "0 20px 12px", padding: "10px 12px", background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
            <AlertTriangle size={10} color="#d97706" />
            <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#d97706" }}>Note client</p>
          </div>
          <p style={{ fontSize: 11, fontStyle: "italic", color: "#92400e" }}>"{order.customerNotes}"</p>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{
        borderTop: "1px solid #f0f0f0",
        padding: "14px 20px 16px",
        textAlign: "center",
        background: "linear-gradient(to bottom, #fff 0%, #fafafa 100%)",
      }}>
        {/* barcode lines decoration */}
        <div style={{ display: "flex", justifyContent: "center", gap: 2, marginBottom: 10 }}>
          {[3,1.5,2.5,1,3,1.5,2,1,3,2,1.5,2.5,1,3].map((w, i) => (
            <div key={i} style={{ width: w * 2, height: 20, background: "#0a0a0a", borderRadius: 1, opacity: 0.7 + (i % 3) * 0.1 }} />
          ))}
        </div>
        <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Merci de votre commande 🙏</p>
        <p style={{ fontSize: 9, color: "#bbb", letterSpacing: "0.15em", textTransform: "uppercase" }}>e-snack</p>
      </div>
    </div>
  )
}

// ─── Kitchen Ticket ────────────────────────────────────────────────────────────

function RestaurantTicket({ order, restaurantName }: { order: AdminOrder; restaurantName: string }) {
  const ref = orderRef(order)
  const isDelivery = order.orderType === "delivery"
  const isPickup   = order.orderType === "pickup"
  const typeMeta = isDelivery
    ? { label: "LIVRAISON", emoji: "🛵", accent: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd" }
    : isPickup
    ? { label: "EMPORTER",  emoji: "🏪", accent: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd" }
    : { label: "SUR PLACE", emoji: "🍽", accent: "#059669", bg: "#f0fdf4", border: "#6ee7b7" }

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#fff", color: "#0a0a0a", width: 320 }}>

      {/* ── Top stripe ── */}
      <div style={{
        background: typeMeta.accent,
        padding: "6px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>{typeMeta.emoji}</span>
          <span style={{ fontSize: 11, fontWeight: 900, color: "#fff", letterSpacing: "0.15em" }}>{typeMeta.label}</span>
        </div>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>BON DE CUISINE</span>
      </div>

      {/* ── Header ── */}
      <div style={{ padding: "16px 20px 14px", textAlign: "center", borderBottom: "1.5px solid #0a0a0a" }}>
        <p style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{restaurantName}</p>
        <p style={{ fontSize: 10, color: "#888", marginTop: 3 }}>{fmtDate(order.createdAt)}</p>
      </div>

      {/* ── Big order number + time ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr auto",
        padding: "16px 20px", borderBottom: "1.5px dashed #ccc", gap: 8, alignItems: "center",
      }}>
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#aaa", marginBottom: 4 }}>Commande</p>
          <p style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>#{ref}</p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#aaa", marginBottom: 4 }}>Heure</p>
          <p style={{ fontSize: 22, fontWeight: 900, lineHeight: 1, whiteSpace: "nowrap" }}>{fmtTime(order.createdAt)}</p>
          {order.estimatedPrepMinutes && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4, marginTop: 5,
              background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 20, padding: "2px 8px"
            }}>
              <Clock size={9} color="#ea580c" />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#ea580c" }}>{order.estimatedPrepMinutes} min</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Customer line ── */}
      {order.customerName && (
        <div style={{ padding: "8px 20px", borderBottom: "1px dashed #e5e7eb", display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <User size={11} color="#888" />
          <b style={{ fontWeight: 700 }}>{order.customerName}</b>
          {order.customerPhone && <span style={{ color: "#888" }}> · {order.customerPhone}</span>}
        </div>
      )}

      {/* ── Customer notes ── */}
      {order.customerNotes && (
        <div style={{ margin: "10px 20px 0", padding: "10px 12px", background: "#fef2f2", border: "2px solid #fca5a5", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
            <AlertTriangle size={10} color="#dc2626" />
            <p style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#dc2626" }}>ATTENTION</p>
          </div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#7f1d1d" }}>"{order.customerNotes}"</p>
        </div>
      )}

      {/* ── Items ── */}
      <div style={{ padding: "14px 20px", borderTop: "none", borderBottom: "1.5px dashed #ccc" }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#aaa", marginBottom: 12 }}>À préparer</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {order.items.map((item, i) => (
            <div key={i} style={{
              padding: "10px 12px", borderRadius: 10,
              border: "1.5px solid #e5e7eb", background: "#fafafa",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  minWidth: 34, height: 34, borderRadius: 8,
                  background: "#0a0a0a", color: "#fff",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 900, flexShrink: 0,
                }}>
                  {item.quantity}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>{item.productName}</span>
              </div>
              {item.options && item.options.length > 0 && (
                <div style={{ paddingLeft: 44, marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                  {item.options.map((opt, j) => (
                    <div key={j} style={{ fontSize: 11, color: "#555" }}>
                      · {opt.optionName}: <b style={{ color: "#111" }}>{opt.choiceName}</b>
                    </div>
                  ))}
                </div>
              )}
              {item.notes && (
                <div style={{ marginTop: 6, padding: "4px 8px", background: "#fffbeb", border: "1.5px solid #fbbf24", borderRadius: 5, fontSize: 11, fontWeight: 700, color: "#92400e" }}>
                  ⚠ {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Delivery info ── */}
      {isDelivery && (
        <div style={{ padding: "10px 20px" }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#aaa", marginBottom: 5 }}>Adresse de livraison</p>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <MapPin size={12} color="#3b82f6" style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>{order.deliveryAddress || "—"}</p>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ borderTop: "1.5px solid #0a0a0a", padding: "8px 20px 12px", textAlign: "center" }}>
        <p style={{ fontSize: 9, color: "#bbb", letterSpacing: "0.15em", textTransform: "uppercase" }}>Bon cuisine · e-snack</p>
      </div>
    </div>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

type TicketType = "client" | "restaurant"

interface TicketModalProps {
  order: AdminOrder
  restaurantName: string
  defaultType?: TicketType
  onClose: () => void
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente", confirmed: "Confirmée", preparing: "En préparation",
  ready: "Prête", out_for_delivery: "En livraison", delivered: "Livrée", cancelled: "Annulée",
}
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending:          { bg: "#fff7ed", text: "#d97706", border: "#fed7aa" },
  confirmed:        { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  preparing:        { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" },
  ready:            { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  out_for_delivery: { bg: "#f5f3ff", text: "#7c3aed", border: "#ddd6fe" },
  delivered:        { bg: "#f0fdf4", text: "#059669", border: "#6ee7b7" },
  cancelled:        { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
}

export function TicketModal({ order, restaurantName, defaultType = "client", onClose }: TicketModalProps) {
  const [type, setType] = useState<TicketType>(defaultType)
  const printRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    const content = printRef.current?.innerHTML
    if (!content) return
    const win = window.open("", "_blank", "width=420,height=820")
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>#${orderRef(order)} — ${type === "client" ? "Client" : "Cuisine"}</title>
<style>${PRINT_CSS}</style>
<script>window.onload=function(){window.print();window.close();}<\/script>
</head><body>${content}</body></html>`)
    win.document.close()
  }

  const ref = orderRef(order)
  const sc = STATUS_COLORS[order.status] ?? { bg: "#f3f4f6", text: "#666", border: "#e5e7eb" }
  const statusLabel = STATUS_LABELS[order.status] ?? order.status
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: "100%", maxWidth: 420, maxHeight: "94vh",
          background: "#fff", borderRadius: 20,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.06)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal header ── */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 17, fontWeight: 900 }}>Commande #{ref}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                  background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                  flexShrink: 0,
                }}>
                  {statusLabel}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#888" }}>{restaurantName} · {fmtDate(order.createdAt)}</p>
            </div>
            <button
              onClick={onClose}
              style={{
                flexShrink: 0, width: 30, height: 30, borderRadius: "50%",
                background: "#f5f5f5", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#666",
              }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Quick stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
            {[
              { label: "Total", value: fmt(order.total), accent: "#0a0a0a" },
              { label: "Articles", value: `${itemCount} article${itemCount > 1 ? "s" : ""}`, accent: "#555" },
              {
                label: "Paiement",
                value: order.paymentStatus === "paid" ? "✓ Payé" : order.paymentStatus === "on_site" ? "Sur place" : "En attente",
                accent: order.paymentStatus === "paid" ? "#16a34a" : order.paymentStatus === "on_site" ? "#2563eb" : "#d97706",
              },
            ].map((s, i) => (
              <div key={i} style={{ background: "#fafafa", borderRadius: 10, padding: "8px 10px", border: "1px solid #f0f0f0" }}>
                <p style={{ fontSize: 9, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>{s.label}</p>
                <p style={{ fontSize: 11, fontWeight: 800, color: s.accent }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", borderBottom: "1px solid #f0f0f0", background: "#fafafa" }}>
          {(["client", "restaurant"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 700,
                background: type === t ? "#fff" : "transparent",
                color: type === t ? "#0a0a0a" : "#aaa",
                borderBottom: type === t ? "2px solid #0a0a0a" : "2px solid transparent",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "color 0.15s",
              }}
            >
              {t === "client" ? <User size={12} /> : <ChefHat size={12} />}
              {t === "client" ? "Ticket client" : "Bon cuisine"}
            </button>
          ))}
        </div>

        {/* ── Ticket preview ── */}
        <div style={{ flex: 1, overflowY: "auto", background: "#f0f0f0", padding: "20px 16px" }}>
          <div style={{
            maxWidth: 320, margin: "0 auto",
            background: "#fff", borderRadius: 12, overflow: "hidden",
            boxShadow: "0 4px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)",
          }}>
            <div ref={printRef}>
              {type === "client"
                ? <ClientTicket order={order} restaurantName={restaurantName} />
                : <RestaurantTicket order={order} restaurantName={restaurantName} />}
            </div>
          </div>
        </div>

        {/* ── Print button ── */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #f0f0f0", background: "#fff" }}>
          <button
            onClick={handlePrint}
            style={{
              width: "100%", padding: "13px", background: "#0a0a0a", color: "#fff",
              border: "none", borderRadius: 12, cursor: "pointer",
              fontSize: 13, fontWeight: 800, letterSpacing: "0.03em",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "transform 0.1s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#222")}
            onMouseLeave={e => (e.currentTarget.style.background = "#0a0a0a")}
            onMouseDown={e => (e.currentTarget.style.transform = "scale(0.98)")}
            onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
          >
            <Printer size={15} />
            Imprimer {type === "client" ? "le ticket client" : "le bon cuisine"}
          </button>
        </div>
      </div>
    </div>
  )
}
