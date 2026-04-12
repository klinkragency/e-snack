"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowRight, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"

const CODE_LENGTH = 6
const RESEND_COOLDOWN = 60

interface OtpVerifyFormProps {
  /** Called after successful verification */
  onVerified: () => void
}

export function OtpVerifyForm({ onVerified }: OtpVerifyFormProps) {
  const user = useAppStore((s) => s.user)
  const setUser = useAppStore((s) => s.setUser)
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(""))
  const [verifying, setVerifying] = useState(false)
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN)
  const [resending, setResending] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setTimeout(() => setResendTimer((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [resendTimer])

  const handleChange = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1)
    setDigits((prev) => {
      const next = [...prev]
      next[index] = digit
      return next
    })
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [])

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    },
    [digits]
  )

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH)
    if (!pasted) return
    const newDigits = Array(CODE_LENGTH).fill("")
    for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i]
    setDigits(newDigits)
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus()
  }, [])

  const handleVerify = useCallback(async () => {
    const code = digits.join("")
    if (code.length !== CODE_LENGTH) {
      toast.error("Entrez le code à 6 chiffres")
      return
    }
    setVerifying(true)
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (data.success) {
        if (user) setUser({ ...user, emailVerified: true })
        toast.success("Email vérifié !")
        onVerified()
      } else {
        toast.error(data.message || "Code incorrect")
        setDigits(Array(CODE_LENGTH).fill(""))
        inputRefs.current[0]?.focus()
      }
    } catch {
      toast.error("Erreur lors de la vérification")
    } finally {
      setVerifying(false)
    }
  }, [digits, user, setUser, onVerified])

  // Auto-submit when all digits filled
  useEffect(() => {
    if (digits.every((d) => d !== "") && !verifying) {
      handleVerify()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits])

  const handleResend = async () => {
    setResending(true)
    try {
      const res = await fetch("/api/auth/verify-email/send", { method: "POST" })
      const data = await res.json()
      if (data.success) {
        toast.success("Code renvoyé !")
        setResendTimer(RESEND_COOLDOWN)
      } else {
        toast.error(data.message || "Erreur lors de l'envoi")
      }
    } catch {
      toast.error("Erreur lors de l'envoi")
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="space-y-6">
      {user?.email && (
        <p className="text-center text-sm text-muted-foreground">
          Code envoyé à <span className="font-medium text-foreground">{user.email}</span>
        </p>
      )}

      {/* OTP inputs */}
      <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="h-14 w-11 rounded-xl border-2 bg-background text-center text-xl font-bold outline-none transition-all focus:border-foreground focus:ring-2 focus:ring-foreground/20"
            autoFocus={i === 0}
          />
        ))}
      </div>

      {/* Verify button */}
      <button
        onClick={handleVerify}
        disabled={verifying || digits.some((d) => !d)}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
      >
        {verifying ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <>
            Vérifier
            <ArrowRight size={16} />
          </>
        )}
      </button>

      {/* Resend */}
      <div className="space-y-2 text-center">
        <p className="text-xs text-muted-foreground">Vous n&apos;avez pas reçu le code ?</p>
        <button
          onClick={handleResend}
          disabled={resendTimer > 0 || resending}
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          <RotateCcw size={14} />
          {resendTimer > 0
            ? `Renvoyer dans ${resendTimer}s`
            : resending
              ? "Envoi..."
              : "Renvoyer le code"}
        </button>
      </div>
    </div>
  )
}
