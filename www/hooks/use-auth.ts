"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import type { UserProfile } from "@/lib/auth-types"
import * as authClient from "@/lib/auth-client"
import { listAddresses } from "@/lib/account-client"

/**
 * Load the user's default address from DB and set it in Zustand.
 * Returns true if a default address was found and set.
 */
export async function hydrateDefaultAddress(): Promise<boolean> {
  try {
    const addresses = await listAddresses()
    const defaultAddr = addresses.find((a) => a.isDefault)
    if (defaultAddr) {
      useAppStore.getState().setAddress(defaultAddr.address)
      return true
    }
  } catch {
    // Silently ignore
  }
  return false
}

export function useAuth(options?: { skipInitialFetch?: boolean }) {
  const { user, setUser, clearUser } = useAppStore()
  const skip = options?.skipInitialFetch ?? false
  const [isLoading, setIsLoading] = useState(!skip)

  const reset = useAppStore((s) => s.reset)

  useEffect(() => {
    if (skip) return
    authClient
      .getMe()
      .then((u) => {
        setUser(u)
        hydrateDefaultAddress()
      })
      .catch(() => clearUser())
      .finally(() => setIsLoading(false))
  }, [setUser, clearUser, skip])

  const login = useCallback(
    async (email: string, password: string) => {
      const u = await authClient.login(email, password)
      reset()
      setUser(u)
      return u
    },
    [reset, setUser]
  )

  const register = useCallback(
    async (email: string, password: string, phone?: string) => {
      const u = await authClient.register(email, password, phone)
      reset()
      setUser(u)
      return u
    },
    [reset, setUser]
  )

  const googleLogin = useCallback(
    async (idToken: string) => {
      const u = await authClient.oauthLogin("google", idToken)
      reset()
      setUser(u)
      return u
    },
    [reset, setUser]
  )

  const logout = useCallback(async () => {
    // Navigate directly — do NOT call reset() first.
    // reset() sets user=null which can trigger useEffect redirects that race
    // with the actual logout navigation, causing blank pages and the logout GET
    // to never complete (cookies never cleared).
    window.location.href = "/api/auth/logout"
  }, [])

  const refetch = useCallback(async () => {
    try {
      const u = await authClient.getMe()
      setUser(u)
    } catch { /* ignore */ }
  }, [setUser])

  return { user: user as UserProfile | null, isLoading, login, register, googleLogin, logout, refetch }
}
