"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

// This page is only reached from the WEB payment flow: the mobile Expo app
// builds its own deep-link redirect URL (Linking.createURL("payment-return"))
// and is redirected to it directly by Mollie, bypassing this page entirely.
//
// So on web we don't need a deep-link handshake — we just forward straight to
// the confirmation page, which polls the order status and renders the final
// state (paid / failed / pending).
function PaymentReturnContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get("orderId")

  useEffect(() => {
    if (!orderId) return
    router.replace(`/confirmation/${orderId}`)
  }, [orderId, router])

  return (
    <div className="min-h-screen bg-[#FCFCFA] flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="flex justify-center">
          <Loader2 className="animate-spin text-black" size={36} />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-[#1C1917]">Finalisation du paiement…</h1>
          <p className="text-sm text-[#79716B]">Vous allez être redirigé vers votre commande.</p>
        </div>
        {orderId && (
          <a
            href={`/confirmation/${orderId}`}
            className="inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white"
          >
            Voir ma commande
          </a>
        )}
      </div>
    </div>
  )
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FCFCFA] flex items-center justify-center">
          <Loader2 className="animate-spin text-black" size={36} />
        </div>
      }
    >
      <PaymentReturnContent />
    </Suspense>
  )
}
