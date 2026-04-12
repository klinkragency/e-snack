"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, RotateCcw, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

type Step = "email" | "code" | "reset" | "done"

const CODE_LENGTH = 6
const RESEND_COOLDOWN = 60

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [resetToken, setResetToken] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  // Step 1: Send reset email
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = z.string().email("Email invalide").safeParse(email)
    if (!result.success) {
      toast.error(result.error.errors[0].message)
      return
    }

    setIsPending(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Erreur")
      toast.success("Code envoyé par email")
      setResendTimer(RESEND_COOLDOWN)
      startResendCountdown()
      setStep("code")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi")
    } finally {
      setIsPending(false)
    }
  }

  // Step 2: Verify reset code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== CODE_LENGTH) {
      toast.error("Entrez le code à 6 chiffres")
      return
    }

    setIsPending(true)
    try {
      const res = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Code incorrect")
      setResetToken(data.resetToken)
      setStep("reset")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Code incorrect")
    } finally {
      setIsPending(false)
    }
  }

  // Step 3: Reset password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const passwordSchema = z
      .string()
      .min(8, "8 caractères minimum")
      .regex(/[A-Z]/, "Au moins une majuscule")
      .regex(/[0-9]/, "Au moins un chiffre")
    const result = passwordSchema.safeParse(password)
    if (!result.success) {
      toast.error(result.error.errors[0].message)
      return
    }
    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas")
      return
    }

    setIsPending(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, newPassword: password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Erreur")
      setStep("done")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la réinitialisation")
    } finally {
      setIsPending(false)
    }
  }

  const startResendCountdown = () => {
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleResend = async () => {
    setIsPending(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Erreur")
      toast.success("Code renvoyé !")
      setResendTimer(RESEND_COOLDOWN)
      startResendCountdown()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Back link */}
        <Link
          href="/authentification"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          Retour
        </Link>

        {/* Step: Email */}
        {step === "email" && (
          <>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Mot de passe oublié</h1>
              <p className="text-sm text-muted-foreground">
                Entrez votre email et nous vous enverrons un code de réinitialisation
              </p>
            </div>
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-full border bg-background py-3.5 pl-11 pr-4 text-sm outline-none transition-all focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground"
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : <>Envoyer le code <ArrowRight size={16} /></>}
              </button>
            </form>
          </>
        )}

        {/* Step: Code verification */}
        {step === "code" && (
          <>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Vérification</h1>
              <p className="text-sm text-muted-foreground">
                Code envoyé à <span className="font-medium text-foreground">{email}</span>
              </p>
            </div>
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-full border bg-background py-3.5 text-center text-lg font-bold tracking-[0.5em] outline-none transition-all focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground placeholder:tracking-[0.5em]"
                autoFocus
              />
              <button
                type="submit"
                disabled={isPending || code.length !== CODE_LENGTH}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : <>Vérifier <ArrowRight size={16} /></>}
              </button>
            </form>
            <div className="text-center">
              <button
                onClick={handleResend}
                disabled={resendTimer > 0 || isPending}
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                <RotateCcw size={14} />
                {resendTimer > 0 ? `Renvoyer dans ${resendTimer}s` : "Renvoyer le code"}
              </button>
            </div>
          </>
        )}

        {/* Step: New password */}
        {step === "reset" && (
          <>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Nouveau mot de passe</h1>
              <p className="text-sm text-muted-foreground">
                Choisissez un mot de passe sécurisé
              </p>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Nouveau mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-full border bg-background py-3.5 pl-11 pr-11 text-sm outline-none transition-all focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground"
                  required
                  minLength={8}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirmer le mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-full border bg-background py-3.5 pl-11 pr-4 text-sm outline-none transition-all focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground"
                  required
                  minLength={8}
                />
              </div>
              <p className="text-xs text-muted-foreground px-2">
                8 caractères minimum, 1 majuscule, 1 chiffre
              </p>
              <button
                type="submit"
                disabled={isPending}
                className="!mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : "Réinitialiser"}
              </button>
            </form>
          </>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="space-y-6 text-center">
            <CheckCircle2 size={48} className="mx-auto text-green-500" />
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Mot de passe réinitialisé</h1>
              <p className="text-sm text-muted-foreground">
                Vous pouvez maintenant vous connecter avec votre nouveau mot de passe
              </p>
            </div>
            <Link
              href="/authentification"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-8 py-3.5 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Se connecter
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
